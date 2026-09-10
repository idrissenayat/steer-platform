import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createPostgresBrowserSessionStore } from '../src/browser-session.ts';
import { createIntentDraftService } from '../src/intent-draft-service.ts';
import { intentDraftCreateOutputSchema, intentDraftAppendOutputSchema, intentDraftReadOutputSchema } from '@steer/tool-registry/intent-draft-contracts';

/** Rehearsal on the existing harness's disposable PostgreSQL ONLY. Uses the real
 * migrator and draft/session stores, but synthetic identities, policy and keys.
 * No real profile, credentials, external providers or activation decision. */
export async function testLocalRecordsUpgrade({ admin, connect, check, migrationsFolder, provisionDraftRole }: {
  admin: Pool; connect(role: string): Pool; migrationsFolder: string;
  provisionDraftRole(): Promise<void>; check(name: string, run: () => Promise<void>): Promise<void>;
}) {
  assert.equal((await admin.query('SELECT current_database() AS name')).rows[0].name, 'steer_test');
  assert.equal((await admin.query("SELECT count(*)::int AS count FROM pg_namespace WHERE nspname IN ('steer','steer_auth','steer_usage','steer_drafts','steer_execution','drizzle')")).rows[0].count, 0);
  const directory = await mkdtemp(join(tmpdir(), 'steer-records-upgrade-'));
  const sessionKey = randomBytes(32), draftKey = randomBytes(32);
  const journal = JSON.parse(await readFile(join(migrationsFolder, 'meta/_journal.json'), 'utf8')) as {
    version: string; dialect: string; entries: Array<{ idx: number; tag: string; when: number; version: string; breakpoints: boolean }>;
  };
  const known = await Promise.all(journal.entries.map(async (entry, index) => {
    assert.equal(entry.idx, index); assert.match(entry.tag, /^[0-9]{4}_[a-z0-9_]+$/);
    const sql = await readFile(join(migrationsFolder, `${entry.tag}.sql`));
    return { ...entry, sql, hash: createHash('sha256').update(sql).digest('hex') };
  }));
  assert.equal(known.length, 28);
  assert.deepEqual(known.slice(0, 5).map(row => row.tag), ['0000_tenant_foundation', '0001_runtime_isolation', '0002_browser_sessions', '0003_auth_isolation', '0004_projection_change_feed']);
  const folder = async (name: string, count: number, injectFailure = false) => {
    const target = join(directory, name); await mkdir(join(target, 'meta'), { recursive: true });
    await writeFile(join(target, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, count) }));
    for (const [index, entry] of known.slice(0, count).entries()) await writeFile(join(target, `${entry.tag}.sql`),
      injectFailure && index === count - 1 ? Buffer.concat([entry.sql, Buffer.from('\n--> statement-breakpoint\nSELECT 1/0;\n')]) : entry.sql);
    return target;
  };
  const oldTables = ['steer.ingestion_events', 'steer.projection_records', 'steer.projection_streams', 'steer.projection_changes', 'steer_auth.browser_sessions', 'steer_auth.login_transactions'];
  const snapshot = async () => Object.fromEntries(await Promise.all(oldTables.map(async table => [table,
    (await admin.query(`SELECT to_jsonb(t) AS value FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows.map(row => row.value)] as const)));
  const installed = async () => (await admin.query('SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at')).rows.map(row => row.hash);
  const operationalTables = async () => (await admin.query("SELECT n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('steer_usage','steer_drafts','steer_execution') AND c.relkind='r' ORDER BY n.nspname,c.relname")).rows;
  const binding = { issuer: 'https://synthetic-upgrade.example/realm', clientId: 'steer', redirectUri: 'https://synthetic-upgrade.example/callback' };
  const auth = connect('steer_auth_runtime');
  let observedBefore: Awaited<ReturnType<typeof snapshot>>, clock = 0;
  const sessionId = 'a'.repeat(64), loginId = 'b'.repeat(64);
  const sessionValue = () => ({ accessToken: 'synthetic-upgrade-access', subject: 'synthetic-human', organizationId: 'synthetic-upgrade', createdAt: clock, expiresAt: clock + 240000 });
  const sessionStore = () => createPostgresBrowserSessionStore(auth, { binding, keyring: { currentKeyId: 'synthetic', keys: { synthetic: sessionKey } }, now: () => new Date(clock + 1000) });
  try {
    await check('upgrade starts from exact five-migration installed state with retained synthetic session and projection canaries', async () => {
      await migrate(drizzle(admin), { migrationsFolder: await folder('baseline', 5) });
      assert.deepEqual(await installed(), known.slice(0, 5).map(row => row.hash));
      assert.deepEqual(await operationalTables(), []);
      assert.equal((await admin.query("SELECT count(*)::int AS count FROM pg_roles WHERE rolname='steer_draft_runtime'")).rows[0].count, 0);
      clock = Number((await admin.query("SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS now")).rows[0].now);
      assert.equal(await sessionStore().insertSession(sessionId, sessionValue()), true);
      assert.equal(await sessionStore().insertTransaction(loginId, { browserHash: 'c'.repeat(64), verifier: 'd'.repeat(43), nonce: 'e'.repeat(43), createdAt: clock, expiresAt: clock + 240000 }), true);
      await admin.query('INSERT INTO steer.ingestion_events (organization_id,event_id,repository,source_revision,content_digest) VALUES ($1,$2,$3,$4,$5)',
        ['synthetic-upgrade', 'synthetic-event', 'github:52', '1'.repeat(40), '2'.repeat(64)]);
      await admin.query('INSERT INTO steer.projection_records VALUES ($1,$2,$3,$4,$5,$6)',
        ['synthetic-upgrade', 'synthetic-record', 'github:52', '1'.repeat(40), '2'.repeat(64), { synthetic: 'preserve this projection' }]);
      observedBefore = await snapshot();
      assert.ok(Object.values(observedBefore).every(rows => rows.length === 1));
      assert.doesNotMatch(JSON.stringify(observedBefore['steer_auth.browser_sessions']), /synthetic-upgrade-access/);
    });
    await check('failed pending upgrade rolls back all 23 schema migrations and preserves installed journal and existing bytes', async () => {
      await provisionDraftRole();
      const failingFolder = await folder('failure-injected', 28, true);
      await assert.rejects(migrate(drizzle(admin), { migrationsFolder: failingFolder }), error =>
        (error as { cause?: { code?: string } }).cause?.code === '22012');
      assert.deepEqual(await installed(), known.slice(0, 5).map(row => row.hash));
      assert.deepEqual(await operationalTables(), []);
      assert.deepEqual(await snapshot(), observedBefore);
      assert.deepEqual(await sessionStore().readSession(sessionId), sessionValue());
    });
    await check('exact unmodified 0005-0027 upgrade applies once and reapplying preserves journal sessions and existing data', async () => {
      const start = performance.now();
      await migrate(drizzle(admin), { migrationsFolder });
      const first = await installed(); assert.deepEqual(first, known.map(row => row.hash));
      await migrate(drizzle(admin), { migrationsFolder });
      assert.deepEqual(await installed(), first); assert.deepEqual(await snapshot(), observedBefore);
      assert.deepEqual(await sessionStore().readSession(sessionId), sessionValue());
      const rows = await operationalTables(); assert.ok(rows.length > 0);
      assert.ok(rows.every(row => row.relrowsecurity && row.relforcerowsecurity));
      console.log(JSON.stringify({ syntheticUpgrade: { from: 5, to: 28, pending: 23,
        migrationSetSha256: createHash('sha256').update(JSON.stringify(known.map(({ tag, hash }) => ({ tag, hash })))).digest('hex'),
        applyAndReapplyMs: Math.ceil(performance.now() - start), tables: rows.length, realDatabaseChanged: false } }));
    });
    await check('upgrade provisions no budget and preserves least-privilege isolation between draft auth projection and execution roles', async () => {
      for (const table of ['steer_usage.model_budgets', 'steer_usage.model_reservations', 'steer_execution.intent_operations', 'steer_drafts.draft_revisions'])
        assert.equal((await admin.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count, 0);
      const draft = connect('steer_draft_runtime');
      const role = (await draft.query('SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolinherit FROM pg_roles WHERE rolname=current_user')).rows[0];
      assert.ok(Object.values(role).every(value => value === false));
      for (const role of ['steer_app', 'steer_auth_runtime', 'steer_projector'])
        await assert.rejects(connect(role).query('SELECT * FROM steer_drafts.draft_revisions'), /permission denied/);
      for (const table of ['steer_auth.browser_sessions', 'steer.projection_records', 'steer_usage.model_budgets'])
        await assert.rejects(draft.query(`SELECT * FROM ${table}`), /permission denied/);
    });
    await check('existing draft service preserves and reopens exact content on upgraded schema without granting live key or records authority', async () => {
      const configuration = { organizationId: 'synthetic-upgrade', subject: 'synthetic-human', productId: 'synthetic-product', repository: 'github:52',
        branch: 'codex/synthetic', configurationRevision: 'synthetic-upgrade', recordsPolicyDigest: 'f'.repeat(64) };
      const scope = { organizationId: configuration.organizationId, productId: configuration.productId, repository: configuration.repository };
      const make = (patch = {}) => createIntentDraftService(connect('steer_draft_runtime'), { ...configuration, ...patch }, {
        lifecycle: { authorize: async () => {} }, revisions: { authorize: async () => {}, keyForDraft: async () => ({ keyId: 'synthetic-upgrade', bytes: draftKey }) },
      });
      const first = make();
      const created = intentDraftCreateOutputSchema.parse(await first.create({ ...scope, requestId: randomUUID() }, async () => {}));
      assert.equal(created.outcome, 'created'); if (created.outcome !== 'created') throw new Error('Expected synthetic draft');
      const content = { originalText: ' Keep this intent exactly 🌸\r\nNo lost spaces. ', clarificationTurns: [' Original answer '], documents: null };
      const append = { ...scope, draftId: created.draftId, mutationId: randomUUID(), expectedRevision: 0, expectedDigest: null, content };
      const acknowledgement = intentDraftAppendOutputSchema.parse(await first.append(append, async () => {}));
      assert.equal(acknowledgement.outcome, 'acknowledged'); first.close();
      const second = make();
      try {
        const reopened = intentDraftReadOutputSchema.parse(await second.read({ ...scope, draftId: created.draftId, revision: 'latest' }, async () => {}));
        assert.deepEqual(reopened.content, content); assert.equal(reopened.revision, 1);
        assert.deepEqual(await second.append(append, async () => {}), acknowledgement);
        const foreign = make({ subject: 'another-synthetic-human' });
        try { await assert.rejects(foreign.read({ ...scope, draftId: created.draftId, revision: 'latest' }, async () => {})); } finally { foreign.close(); }
        const rows = (await admin.query('SELECT * FROM steer_drafts.draft_revisions')).rows;
        assert.equal(rows.length, 1); assert.doesNotMatch(JSON.stringify(rows), /Keep this intent|Original answer/);
      } finally { second.close(); }
      assert.deepEqual(await snapshot(), observedBefore);
    });
  } finally {
    sessionKey.fill(0); draftKey.fill(0);
    assert.match(basename(directory), /^steer-records-upgrade-[A-Za-z0-9]+$/);
    await rm(directory, { recursive: true, force: true });
  }
}
