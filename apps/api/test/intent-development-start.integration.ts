import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { createDraftRevisionStore } from '@steer/data/draft-revisions';
import type { createDraftLifecycleStore } from '@steer/data/draft-lifecycle';
import type { DevelopmentScheduler } from '@steer/tool-registry/intent-development-start-contracts';
import { createRecordedDevelopmentStarter } from '../src/runtime.ts';
import { createApi } from '../src/app.ts';
import { createDevelopmentOriginalStore } from '@steer/data/development-originals';
import { ownedDevelopmentOriginalFixture, ownedDevelopmentReadFixture } from './owned-scope-read.fixture.ts';

interface Fixture {
  config: { organizationId: string; subject: string; productId: string; repository: string; branch: string; configurationRevision: string; recordsPolicyDigest: string };
  pools: Parameters<typeof createRecordedDevelopmentStarter>[0];
  deps: { originals: Parameters<typeof createRecordedDevelopmentStarter>[2]['records'] };
  target: { operationId: string; inputDigest: string }; draftId: string; saved: { reference: { revisionDigest: string } };
  drafts: ReturnType<typeof createDraftRevisionStore>; lifecycle: ReturnType<typeof createDraftLifecycleStore>;
  content: { originalText: string; clarificationTurns: string[]; documents: null };
}
export function createDevelopmentStartHarness(f: Fixture, scheduler: DevelopmentScheduler,
  patch: Partial<Parameters<typeof createRecordedDevelopmentStarter>[2]> = {}) {
  const service = createRecordedDevelopmentStarter(f.pools, f.config, { records: f.deps.originals, scheduler, authorizeStart: async () => {}, ...patch });
  const state = { principal: { subject: f.config.subject, organizationId: f.config.organizationId, type: 'human', hats: [],
    toolGrants: ['intent.development.start'], expiresAt: new Date(Date.now() + 300000).toISOString() } };
  const app = createApi({ authenticate: async () => state.principal, services: { intentDevelopmentStarter: service } });
  const input = { organizationId: f.config.organizationId, productId: f.config.productId, repository: f.config.repository, ...f.target,
    draftId: f.draftId, revision: 1, revisionDigest: f.saved.reference.revisionDigest };
  return { state, service, input, post: (override = {}) => app.fetch(new Request('https://steer.example/v1/tools/intent.development.start', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, ...override }),
  })) };
}

/** Real HTTP + encrypted SQL. Scheduler here is synthetic; actual Temporal
 * composition/recovery is separately exercised in development-workflow.integration. */
export async function testDevelopmentStart(setup: () => Promise<Fixture>, check: (name: string, run: () => Promise<void>) => Promise<void>, admin: Pool) {
  const owned = async (f: Fixture, keyForDraft = f.deps.originals.keyForDraft) => {
    const store = createDevelopmentOriginalStore(f.pools, f.config, f.deps.originals);
    try { const { original } = await store.read(f.target);
      if (!original.configuration.budget) throw new Error('Fixture needs a model budget');
      return { ownedRead: ownedDevelopmentOriginalFixture(original.configuration.budget.budgetId, keyForDraft), profiles: original.profiles,
        budgetId: original.configuration.budget.budgetId };
    } finally { store.close(); }
  };
  const snapshots = async (f: Fixture) => (await admin.query(`SELECT
    (SELECT count(*) FROM steer_execution.intent_steps WHERE operation_id=$1) AS steps,
    (SELECT count(*) FROM steer_drafts.development_originals WHERE operation_id=$1) AS originals,
    (SELECT count(*) FROM steer_drafts.draft_revisions WHERE draft_id=$2) AS revisions`, [f.target.operationId, f.draftId])).rows[0];
  await check('actual development start HTTP binds the retained original and source before reference-only scheduling; ACK is not generated documents', async () => {
    const f = await setup(), before = await snapshots(f); let calls = 0, authorizations = 0;
    const app = createDevelopmentStartHarness(f, { start: async (target, current) => {
      calls++; await current(); assert.deepEqual(Object.keys(target).sort(), ['expiresAt', 'inputDigest', 'operationId', 'organizationId']);
      assert.equal(target.operationId, f.target.operationId);
      return { outcome: 'acknowledged', workflowId: `steer-development/v1/${encodeURIComponent(target.organizationId)}/${target.operationId}`, runId: randomUUID(), state: 'RUNNING' };
    } }, { authorizeStart: async original => { authorizations++; assert.equal(original.source.content.originalText, f.content.originalText); } });
    try {
      const response = await app.post(); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); const body = await response.json();
      assert.equal(body.receipt.outcome, 'acknowledged'); assert.equal(body.documentsReady, false); assert.equal(body.savedToGit, false); assert.equal(body.gateSigned, false);
      assert.equal(body.retryAuthorized, false); assert.equal(calls, 1); assert.ok(authorizations >= 3);
      assert.deepEqual(await snapshots(f), before); assert.equal(JSON.stringify(body).includes('Private observed original'), false);
    } finally { app.service.close(); }
  });
  await check('missing start grant, denied records/execution authority and stale source never reach development scheduling', async () => {
    const f = await setup(); let calls = 0; const scheduler = { start: async () => { calls++; return { outcome: 'unknown' }; } };
    const denied = createDevelopmentStartHarness(f, scheduler, { authorizeStart: async () => { throw new Error('private-budget-denial'); } });
    const nonvoid = createDevelopmentStartHarness(f, scheduler, { records: { ...f.deps.originals,
      authorizeOriginal: async () => true as unknown as void } });
    const normal = createDevelopmentStartHarness(f, scheduler);
    try {
      assert.equal((await denied.post()).status, 503);
      assert.equal((await nonvoid.post()).status, 503);
      normal.state.principal.toolGrants = []; assert.equal((await normal.post()).status, 403); normal.state.principal.toolGrants = ['intent.development.start'];
      assert.equal((await normal.post({ revisionDigest: 'f'.repeat(64) })).status, 503);
      assert.equal((await f.drafts.append({ draftId: f.draftId, mutationId: randomUUID(), expectedRevision: 1, expectedDigest: f.saved.reference.revisionDigest,
        content: { ...f.content, originalText: 'Newer human correction' } })).outcome, 'acknowledged');
      assert.equal((await normal.post()).status, 503); assert.equal(calls, 0);
    } finally { denied.service.close(); nonvoid.service.close(); normal.service.close(); }
  });
  await check('draft hold or source change during last start authority check blocks the scheduler callback', async () => {
    for (const hold of [false, true]) {
      const f = await setup(); let calls = 0, checks = 0;
      const app = createDevelopmentStartHarness(f, { start: async () => { calls++; return { outcome: 'unknown' }; } }, { authorizeStart: async () => {
        if (++checks !== 1) return;
        if (hold) assert.equal((await f.lifecycle.hold({ draftId: f.draftId, holdReference: randomUUID() })).outcome, 'ok');
        else assert.equal((await f.drafts.append({ draftId: f.draftId, mutationId: randomUUID(), expectedRevision: 1, expectedDigest: f.saved.reference.revisionDigest,
          content: { ...f.content, originalText: 'Correction during authorization' } })).outcome, 'acknowledged');
      } });
      try { assert.equal((await app.post()).status, 503); assert.equal(calls, 0); } finally { app.service.close(); }
    }
  });
  await check('lost development scheduling ACK remains unknown; post-dispatch grant revocation withholds it without another scheduling call', async () => {
    for (const revoke of [false, true]) {
      const f = await setup(); let calls = 0, app: ReturnType<typeof createDevelopmentStartHarness>;
      app = createDevelopmentStartHarness(f, { start: async () => { calls++; if (revoke) app.state.principal.toolGrants = []; return { outcome: 'unknown' }; } });
      try {
        const response = await app.post(); assert.equal(response.status, revoke ? 403 : 200);
        if (!revoke) assert.equal((await response.json()).receipt.outcome, 'unknown'); assert.equal(calls, 1);
      } finally { app.service.close(); }
    }
  });
  await check('owned drafting start matches ordinary receipts with final current records before scheduling and no history grant', async () => {
    const f = await setup(), binding = await owned(f), before = await snapshots(f); let calls = 0;
    const scheduler: DevelopmentScheduler = { start: async (_input, current) => { await current(); calls++; return { outcome: 'unknown' }; } };
    const ordinary = createDevelopmentStartHarness(f, scheduler), native = createDevelopmentStartHarness(f, scheduler, binding);
    try {
      const expected = await (await ordinary.post()).json(), actual = await (await native.post()).json();
      assert.deepEqual(actual, expected); assert.equal(calls, 2); assert.equal(actual.documentsReady, false);
      assert.ok(binding.ownedRead.state.discovery > 0); assert.equal(binding.ownedRead.state.reads, 6);
      assert.equal(binding.ownedRead.authority.authorizeDevelopmentDiscovery, undefined);
      assert.deepEqual(await snapshots(f), before);
    } finally { ordinary.service.close(); native.service.close(); }
  });
  await check('owned drafting start rejects history-only discovery or foreign profiles instead of falling back', async () => {
    const f = await setup(), binding = await owned(f); let calls = 0;
    const scheduler: DevelopmentScheduler = { start: async () => { calls++; return { outcome: 'unknown' }; } };
    assert.throws(() => createDevelopmentStartHarness(f, scheduler, { profiles: binding.profiles,
      ownedRead: ownedDevelopmentReadFixture(binding.budgetId, f.deps.originals.keyForDraft) as never }));
    const a = createDevelopmentStartHarness(f, scheduler, { ...binding, profiles: { ...binding.profiles,
      architect: { ...binding.profiles.architect, configurationRevision: 'foreign-profile' } } });
    try { assert.equal((await a.post()).status, 503); assert.equal(calls, 0); } finally { a.service.close(); }
  });
  await check('owned drafting start denies late draft hold edit key record source scope or method loss before scheduling', async () => {
    for (const change of ['hold', 'edit', 'key', 'records', 'source', 'scope', 'method']) {
      const f = await setup(); let allowed = true, calls = 0, changed = false;
      const binding = await owned(f, async (...args) => {
        if (change === 'key' && !allowed) throw new Error('PRIVATE lost key'); return f.deps.originals.keyForDraft(...args);
      });
      const records = { ...f.deps.originals, authorizeOriginal: async (context: Parameters<typeof f.deps.originals.authorizeOriginal>[0]) => {
        if (change === 'source' && !allowed) throw new Error('PRIVATE lost source'); return f.deps.originals.authorizeOriginal(context);
      } };
      const a = createDevelopmentStartHarness(f, { start: async () => { calls++; return { outcome: 'unknown' }; } }, { ...binding, records,
        authorizeStart: async () => {
          if (changed) return; changed = true; allowed = false;
          if (change === 'hold') assert.equal((await f.lifecycle.hold({ draftId: f.draftId, holdReference: randomUUID() })).outcome, 'ok');
          if (change === 'edit') assert.equal((await f.drafts.append({ draftId: f.draftId, mutationId: randomUUID(), expectedRevision: 1,
            expectedDigest: f.saved.reference.revisionDigest, content: { ...f.content, originalText: 'Changed during owned drafting start' } })).outcome, 'acknowledged');
          if (change === 'records') binding.ownedRead.state.deniedRecord = 'development_originals';
          if (change === 'scope') records.scopeReview = { scope: { ...f.config }, read: async () => { throw new Error('PRIVATE replaced scope reader'); } };
          if (change === 'method') binding.ownedRead.authority.authorizeDevelopmentOriginalDiscovery = async () => { throw new Error('Replaced'); };
        } });
      try { const response = await a.post(); assert.equal(response.status, 503, change); assert.equal(changed, true); assert.equal(calls, 0);
        assert.doesNotMatch(await response.text(), /PRIVATE/);
      } finally { a.service.close(); }
    }
  });
  await check('owned drafting start reopens current key authority after scheduler work without redispatch', async () => {
    const f = await setup(), binding = await owned(f), before = await snapshots(f); let calls = 0;
    const a = createDevelopmentStartHarness(f, { start: async (_input, current) => {
      await current(); calls++; binding.ownedRead.state.deniedKey = 'development_originals'; return { outcome: 'unknown' };
    } }, binding);
    try { assert.equal((await a.post()).status, 503); assert.equal(calls, 1); assert.deepEqual(await snapshots(f), before); }
    finally { a.service.close(); }
  });
  await check('owned drafting start shutdown drains an actual held key and never schedules late work', async () => {
    const f = await setup(); let release!: () => void, entered!: () => void, calls = 0;
    const held = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
    const binding = await owned(f, async (...args) => { entered(); await held; return f.deps.originals.keyForDraft(...args); });
    const a = createDevelopmentStartHarness(f, { start: async () => { calls++; return { outcome: 'unknown' }; } }, binding);
    const response = a.post(); await started; let stopped = false;
    if (!('shutdown' in a.service)) throw new Error('Owned reader needs shutdown');
    const stop = a.service.shutdown().then(() => { stopped = true; }); await new Promise(resolve => setImmediate(resolve)); assert.equal(stopped, false);
    release(); await stop; assert.equal((await response).status, 503); assert.equal(calls, 0); assert.equal(stopped, true);
  });
}
