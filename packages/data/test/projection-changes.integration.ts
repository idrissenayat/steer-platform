import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Pool } from 'pg';
import type { Principal } from '@steer/tool-registry';
import { withTenant } from '../src/index.ts';
import { ingestVerifiedArtifact } from '../src/ingestion.ts';
import { createProjectionChangeReader, ProjectionCursorResetRequiredError } from '../src/projection-changes.ts';

export async function testProjectionChanges({ admin, app, projector, connect, check }: {
  admin: Pool; app: Pool; projector: Pool; connect: (user: string) => Pool;
  check: (name: string, run: () => Promise<void>) => Promise<void>;
}) {
  const identity: Principal = { subject: 'synthetic-feed-reader', organizationId: 'org-feed', type: 'human', hats: [], toolGrants: ['projection.changes.read'], expiresAt: new Date(Date.now() + 300000).toISOString() };
  const agent: Principal = { ...identity, subject: 'synthetic-projector', type: 'agent', toolGrants: ['projection.ingest'] };
  const scope = { organizationId: identity.organizationId, repository: 'github:44' };
  const reader = createProjectionChangeReader(app, scope);
  const source = (path: string, content = path) => ({ ...scope, path, revision: 'a'.repeat(40), content,
    contentDigest: createHash('sha256').update(content).digest('hex'),
    blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex') });
  const page = (cursor: Parameters<typeof reader.read>[0]['cursor'] = null, limit = 100) => reader.read({ cursor, limit }, identity);
  await check('projection feed pages exact committed references, duplicates stay silent and repairs append atomically', async () => {
    assert.deepEqual(await page(), { events: [], cursor: null, hasMore: false, snapshotRequired: true });
    for (const path of ['items/a.md', 'items/b.md', 'items/c.md']) assert.equal(await ingestVerifiedArtifact(projector, agent, source(path), null), 'applied');
    const first = await page(null, 2); assert.equal(first.snapshotRequired, true); assert.equal(first.hasMore, true);
    assert.deepEqual(first.events.map((event) => event.position), ['1', '2']);
    const second = await page(first.cursor); assert.deepEqual(second.events.map((event) => event.position), ['3']);
    assert.equal(second.hasMore, false); assert.equal(second.snapshotRequired, false);
    assert.deepEqual((await page(second.cursor)).events, []);
    assert.equal(await ingestVerifiedArtifact(projector, agent, source('items/a.md'), null), 'duplicate');
    assert.deepEqual((await page(second.cursor)).events, []);
    // Only this run's disposable synthetic projection is corrupted, then repaired.
    await admin.query("UPDATE steer.projection_records SET value='null' WHERE organization_id=$1 AND value->>'path'='items/a.md'", [scope.organizationId]);
    assert.equal(await ingestVerifiedArtifact(projector, agent, source('items/a.md'), 'a'.repeat(40)), 'repaired');
    assert.deepEqual((await page(second.cursor)).events.map((event) => event.position), ['4', '5']);
    assert.equal(JSON.stringify(await page()).includes('content"'), false);
  });
  await check('stream lock prevents later commit overtaking, and rollback consumes no visible cursor position', async () => {
    const before = (await page()).cursor!;
    let unblock!: () => void; const hold = new Promise<void>((resolve) => { unblock = resolve; });
    let ready!: () => void; const inserted = new Promise<void>((resolve) => { ready = resolve; });
    const first = withTenant(projector, agent, async (client) => {
      await client.query('INSERT INTO steer.projection_records VALUES ($1,$2,$3,$4,$5,$6)', [scope.organizationId, 'concurrent-first', scope.repository, 'a'.repeat(40), 'b'.repeat(64), {}]);
      ready(); await hold;
    });
    // Ensure failures do not leak an unhandled rejection or leave the held transaction open.
    void first.catch(() => undefined);
    let second: Promise<unknown> | undefined;
    try {
      await Promise.race([inserted, first.then(() => { throw new Error('First transaction ended before hold'); })]);
      const other = connect('steer_projector'); let backendPid = 0;
      second = withTenant(other, agent, async (client) => {
        backendPid = (await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
        await client.query('INSERT INTO steer.projection_records VALUES ($1,$2,$3,$4,$5,$6)', [scope.organizationId, 'concurrent-second', scope.repository, 'a'.repeat(40), 'b'.repeat(64), {}]);
      });
      void second.catch(() => undefined);
      let blocked = false;
      for (let i = 0; i < 50; i++) {
        if (backendPid && (await admin.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [backendPid])).rows[0]?.wait_event_type === 'Lock') { blocked = true; break; }
        await delay(20);
      }
      assert.equal(blocked, true, 'Later transaction must wait on the stream lock');
      assert.deepEqual((await page(before)).events, []);
    } finally { unblock(); await Promise.all([first, ...(second ? [second] : [])]); }
    const committed = await page(before);
    assert.deepEqual(committed.events.map((event) => event.recordKey), ['concurrent-first', 'concurrent-second']);
    await assert.rejects(withTenant(projector, agent, async (client) => {
      await client.query('INSERT INTO steer.projection_records VALUES ($1,$2,$3,$4,$5,$6)', [scope.organizationId, 'rollback', scope.repository, 'a'.repeat(40), 'b'.repeat(64), {}]);
      throw new Error('synthetic rollback');
    }), /synthetic rollback/);
    assert.deepEqual((await page(committed.cursor)).events, []);
    await ingestVerifiedArtifact(projector, agent, source('items/after-rollback.md'), null);
    assert.equal((await page(committed.cursor)).events[0]!.position, String(BigInt(committed.cursor!.position) + 1n));
  });
  await check('feed scope, runtime roles, RLS and immutable history deny cross-tenant access and mutation', async () => {
    const cursor = (await page()).cursor!;
    await assert.rejects(page({ ...cursor, repository: 'github:foreign' }), /not allowed/);
    await assert.rejects(createProjectionChangeReader(projector, scope).read({ cursor: null, limit: 1 }, identity), /Unsafe projection reader/);
    assert.deepEqual((await createProjectionChangeReader(app, { ...scope, organizationId: 'org-other' }).read({ cursor: null, limit: 100 }, { ...identity, organizationId: 'org-other' })).events, []);
    assert.deepEqual((await createProjectionChangeReader(app, { ...scope, repository: 'github:other' }).read({ cursor: null, limit: 100 }, identity)).events, []);
    for (const table of ['projection_changes', 'projection_streams']) {
      assert.equal((await app.query(`SELECT * FROM steer.${table}`)).rowCount, 0);
      await assert.rejects(withTenant(projector, agent, (client) => client.query(`DELETE FROM steer.${table}`)), /permission denied/);
      await assert.rejects(withTenant(app, identity, (client) => client.query(`UPDATE steer.${table} SET position=position`)), /permission denied/);
    }
    await assert.rejects(withTenant(projector, agent, (client) => client.query('UPDATE steer.projection_changes SET position=position')), /permission denied/);
    await assert.rejects(withTenant(projector, agent, (client) => client.query("UPDATE steer.projection_records SET repository='moved' WHERE record_key='concurrent-first'")), /cannot move/);
  });
  await check('old generations, future cursors and missing committed events require explicit resnapshot', async () => {
    for (let i = 0; i < 12; i++) await ingestVerifiedArtifact(projector, agent, source(`items/paging-${i}.md`), null);
    const all = await page();
    assert.ok(all.events.length > 10);
    assert.deepEqual(all.events.map((event) => event.position), Array.from({ length: all.events.length }, (_, index) => String(index + 1)));
    const cursor = (await page()).cursor!;
    await assert.rejects(page({ ...cursor, generation: '00000000-0000-4000-8000-000000000000' }), ProjectionCursorResetRequiredError);
    await assert.rejects(page({ ...cursor, position: String(BigInt(cursor.position) + 1n) }), ProjectionCursorResetRequiredError);
    // Test-only loss, restricted to a single event in this run's tmpfs database.
    await admin.query('DELETE FROM steer.projection_changes WHERE organization_id=$1 AND repository=$2 AND position=1', [scope.organizationId, scope.repository]);
    await assert.rejects(page(), ProjectionCursorResetRequiredError);
  });
}
