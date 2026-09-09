import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { createIntentDraftService } from '@steer/data/intent-draft-service';
import { createDraftLifecycleStore } from '@steer/data/draft-lifecycle';
import type { DatabasePool } from '@steer/data/runtime-pool';
import { createIdentityRuntime } from '../src/runtime.ts';
import { intentJourneyRuntimeFixture } from './intent-journey-runtime.fixture.ts';
import { intentJourneyFixture } from './intent-journey.fixture.ts';

/** Actual signed-JWT/native-Git authorization and encrypted SQL through the
 * production identity composition. Issuer, records authority and keys are
 * synthetic. Other bundle capabilities deny; this is not full I1–I6 acceptance. */
export async function testManagedIntentJourneyRuntime({ admin, connect, check }: {
  admin: Pool; connect(role: string): Pool; check(name: string, run: () => Promise<void>): Promise<void>;
}) {
  await check('managed authenticated journey retains exact encrypted draft across lost acknowledgement and runtime reconstruction with current policy and Git revocation', async () => {
    const cleanup: Array<() => void> = [], identity = await intentJourneyRuntimeFixture({ after: run => cleanup.push(run) });
    const runtimes: Awaited<ReturnType<typeof createIdentityRuntime>>[] = [], key = { keyId: 'synthetic-managed-draft', bytes: randomBytes(32) };
    const { itemIds: _items, ...records } = identity.configuration, pool = connect('steer_draft_runtime');
    const scope = { organizationId: records.organizationId, productId: records.productId, repository: records.repository };
    let lost = false, allowed = true, closed = 0, active = 0;
    const uncertain: DatabasePool = { async connect() {
      const client = await pool.connect(); let inserted = false;
      return { query: async (sql: string, values?: unknown[]) => {
        const result = await client.query(sql, values);
        if (sql.includes('INSERT INTO steer_drafts.draft_revisions')) inserted = true;
        if (sql === 'COMMIT' && inserted && !lost) { lost = true; throw new Error('PRIVATE lost managed draft acknowledgement'); }
        return result;
      }, release: (broken: boolean) => client.release(broken) } as PoolClient;
    } };
    const authority = async () => { if (!allowed) throw new Error('PRIVATE current synthetic policy denied'); };
    const make = async () => {
      const runtime = await createIdentityRuntime(identity.profile, identity.secrets, { ...identity.ports,
        createIntentJourney: async () => {
          const fixture = intentJourneyFixture(identity.configuration);
          const draft = createIntentDraftService(uncertain, records, { lifecycle: { authorize: authority },
            revisions: { authorize: authority, keyForDraft: async () => key } });
          (fixture.services as any).intentDrafts = draft;
          fixture.owned.shutdown = async () => { closed++; active--; draft.close(); }; active++;
          return fixture.owned;
        }, authorizeIntentJourney: authority });
      runtimes.push(runtime); return runtime;
    };
    const post = (runtime: Awaited<ReturnType<typeof make>>, name: string, input: unknown) => runtime.fetch(identity.request(`intent.draft.${name}`, input));
    try {
      const first = await make(), request = { ...scope, requestId: randomUUID() };
      const create = await post(first, 'create', request); assert.equal(create.status, 200, await create.clone().text());
      const created = await create.json(); assert.equal(created.outcome, 'created');
      const content = { originalText: ' Keep the human intent exactly 🌸\r\n', clarificationTurns: [' Exact answer '],
        documents: { brief: '# Brief\r\nExact source ', spec: '# Spec\nNo guessed claims ', exam: '# Exam\nNOT RUN ' } };
      const append = { ...scope, draftId: created.draftId, mutationId: randomUUID(), expectedRevision: 0, expectedDigest: null, content };
      const response = await post(first, 'append', append); assert.equal(response.status, 200); assert.equal((await response.json()).outcome, 'unknown'); assert.equal(lost, true);
      const rows = async () => (await admin.query('SELECT * FROM steer_drafts.draft_revisions WHERE organization_id=$1 AND draft_id=$2', [scope.organizationId, created.draftId])).rows;
      const encrypted = await rows(); assert.equal(encrypted.length, 1); assert.doesNotMatch(JSON.stringify(encrypted), /human intent|Exact answer|No guessed claims|NOT RUN/);
      assert.equal(first.status().database.connections, 0); await first.shutdown(); assert.equal(closed, 1);
      const restored = await make(), recovery = await post(restored, 'append', append);
      assert.equal(recovery.status, 200); const ack = await recovery.json(); assert.equal(ack.outcome, 'acknowledged'); assert.equal(ack.revision, 1);
      assert.deepEqual(await rows(), encrypted);
      const read = { ...scope, draftId: created.draftId, revision: 'latest' };
      const exact = await post(restored, 'read', read); assert.equal(exact.status, 200); const value = await exact.json();
      assert.deepEqual(value.content, content); assert.equal(value.revisionDigest, ack.revisionDigest); assert.equal(value.savedToGit, false);
      assert.equal((await post(restored, 'read', { ...read, productId: 'foreign' })).status, 403);
      allowed = false; const denied = await post(restored, 'read', read); assert.equal(denied.status, 503); assert.doesNotMatch(await denied.text(), /PRIVATE|human intent/); allowed = true;
      identity.publish({ ...identity.grant, toolGrants: [] }); assert.equal((await post(restored, 'read', read)).status, 403);
      identity.publish({ ...identity.grant, active: false }); assert.equal((await post(restored, 'read', read)).status, 401);
      identity.publish();
      const lifecycle = createDraftLifecycleStore(pool, records, { authorize: authority, verifyHold: async () => {} });
      try { assert.equal((await lifecycle.hold({ draftId: created.draftId, holdReference: randomUUID() })).outcome, 'ok'); } finally { lifecycle.close(); }
      const held = await post(restored, 'read', read); assert.equal(held.status, 503); assert.doesNotMatch(await held.text(), /human intent|Exact answer/);
      assert.deepEqual(await rows(), encrypted); assert.equal(identity.source.mutations(), 0); assert.equal(restored.status().database.connections, 0);
      assert.equal((await admin.query('SELECT published_at FROM steer_drafts.draft_lifecycles WHERE draft_id=$1', [created.draftId])).rows[0].published_at, null);
      await restored.shutdown(); assert.equal(closed, 2); assert.equal(active, 0);
    } finally {
      try { await Promise.all(runtimes.map(runtime => runtime.shutdown())); }
      finally { key.bytes.fill(0); cleanup.forEach(run => run()); }
    }
  });
}
