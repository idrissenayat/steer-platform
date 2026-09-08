import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { createDraftRevisionStore } from '@steer/data/draft-revisions';
import type { createDraftLifecycleStore } from '@steer/data/draft-lifecycle';
import type { ScopeScheduler } from '@steer/tool-registry/intent-scope-start-contracts';
import { createRecordedScopeStarter } from '../src/runtime.ts';
import { createApi } from '../src/app.ts';

interface Fixture {
  config: { organizationId: string; subject: string; productId: string; repository: string; branch: string; configurationRevision: string; recordsPolicyDigest: string };
  pools: Parameters<typeof createRecordedScopeStarter>[0];
  deps: { records: { originals: Parameters<typeof createRecordedScopeStarter>[2]['records'] } };
  target: { reviewId: string; preparationDigest: string }; draftId: string; saved: { reference: { revisionDigest: string } };
  drafts: ReturnType<typeof createDraftRevisionStore>; lifecycle: ReturnType<typeof createDraftLifecycleStore>;
  content: { originalText: string; clarificationTurns: string[]; documents: unknown };
}
export function createScopeStartHarness(f: Fixture, scheduler: ScopeScheduler,
  patch: Partial<Parameters<typeof createRecordedScopeStarter>[2]> = {}) {
  const service = createRecordedScopeStarter(f.pools, f.config, { records: f.deps.records.originals, scheduler, authorizeStart: async () => {}, ...patch });
  const state = { principal: { subject: f.config.subject, organizationId: f.config.organizationId, type: 'human', hats: [],
    toolGrants: ['intent.scope.start'], expiresAt: new Date(Date.now() + 300000).toISOString() } };
  const app = createApi({ authenticate: async () => state.principal, services: { intentScopeStarter: service } });
  const input = { organizationId: f.config.organizationId, productId: f.config.productId, repository: f.config.repository, ...f.target,
    draftId: f.draftId, revision: 1, revisionDigest: f.saved.reference.revisionDigest };
  return { state, service, input, post: (override = {}) => app.fetch(new Request('https://steer.example/v1/tools/intent.scope.start', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, ...override }),
  })) };
}

/** Real HTTP + encrypted SQL. Scheduler here is synthetic; actual Temporal
 * composition/recovery is exercised in scope-workflow.integration. */
export async function testScopeStart(setup: () => Promise<Fixture>, check: (name: string, run: () => Promise<void>) => Promise<void>, admin: Pool) {
  const snapshots = async (f: Fixture) => (await admin.query(`SELECT
    (SELECT count(*) FROM steer_execution.scope_review_batches WHERE review_id=$1) AS steps,
    (SELECT count(*) FROM steer_drafts.scope_review_originals WHERE review_id=$1) AS originals,
    (SELECT count(*) FROM steer_drafts.draft_revisions WHERE draft_id=$2) AS revisions`, [f.target.reviewId, f.draftId])).rows[0];
  await check('actual scope start HTTP binds the retained original and source before reference-only scheduling; ACK is not generated documents', async () => {
    const f = await setup(), before = await snapshots(f); let calls = 0, authorizations = 0;
    const app = createScopeStartHarness(f, { start: async (target, current) => {
      calls++; await current(); assert.deepEqual(Object.keys(target).sort(), ['expiresAt', 'organizationId', 'preparationDigest', 'reviewId']);
      assert.equal(target.reviewId, f.target.reviewId);
      return { outcome: 'acknowledged', workflowId: `steer-scope/v1/${encodeURIComponent(target.organizationId)}/${target.reviewId}`, runId: randomUUID(), state: 'RUNNING' };
    } }, { authorizeStart: async original => { authorizations++; assert.equal(original.source.scope.originalText, f.content.originalText); } });
    try {
      const response = await app.post(); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); const body = await response.json();
      assert.equal(body.receipt.outcome, 'acknowledged'); assert.equal(body.semanticReviewComplete, false); assert.equal(body.savedToGit, false); assert.equal(body.gateSigned, false);
      assert.equal(body.retryAuthorized, false); assert.equal(calls, 1); assert.ok(authorizations >= 3);
      assert.deepEqual(await snapshots(f), before); assert.equal(JSON.stringify(body).includes('Private observed original'), false);
    } finally { app.service.close(); }
  });
  await check('missing start grant, denied records/execution authority and stale source never reach scope scheduling', async () => {
    const f = await setup(); let calls = 0; const scheduler = { start: async () => { calls++; return { outcome: 'unknown' }; } };
    const denied = createScopeStartHarness(f, scheduler, { authorizeStart: async () => { throw new Error('private-budget-denial'); } });
    const normal = createScopeStartHarness(f, scheduler);
    try {
      assert.equal((await denied.post()).status, 503);
      normal.state.principal.toolGrants = []; assert.equal((await normal.post()).status, 403); normal.state.principal.toolGrants = ['intent.scope.start'];
      assert.equal((await normal.post({ revisionDigest: 'f'.repeat(64) })).status, 503);
      assert.equal((await f.drafts.append({ draftId: f.draftId, mutationId: randomUUID(), expectedRevision: 1, expectedDigest: f.saved.reference.revisionDigest,
        content: { ...f.content, originalText: 'Newer human correction' } })).outcome, 'acknowledged');
      assert.equal((await normal.post()).status, 503); assert.equal(calls, 0);
    } finally { denied.service.close(); normal.service.close(); }
  });
  await check('draft hold or source change during last start authority check blocks the scheduler callback', async () => {
    for (const hold of [false, true]) {
      const f = await setup(); let calls = 0, checks = 0;
      const app = createScopeStartHarness(f, { start: async () => { calls++; return { outcome: 'unknown' }; } }, { authorizeStart: async () => {
        if (++checks !== 1) return;
        if (hold) assert.equal((await f.lifecycle.hold({ draftId: f.draftId, holdReference: randomUUID() })).outcome, 'ok');
        else assert.equal((await f.drafts.append({ draftId: f.draftId, mutationId: randomUUID(), expectedRevision: 1, expectedDigest: f.saved.reference.revisionDigest,
          content: { ...f.content, originalText: 'Correction during authorization' } })).outcome, 'acknowledged');
      } });
      try { assert.equal((await app.post()).status, 503); assert.equal(calls, 0); } finally { app.service.close(); }
    }
  });
  await check('lost scope scheduling ACK remains unknown; post-dispatch grant revocation withholds it without another scheduling call', async () => {
    for (const revoke of [false, true]) {
      const f = await setup(); let calls = 0, app: ReturnType<typeof createScopeStartHarness>;
      app = createScopeStartHarness(f, { start: async () => { calls++; if (revoke) app.state.principal.toolGrants = []; return { outcome: 'unknown' }; } });
      try {
        const response = await app.post(); assert.equal(response.status, revoke ? 403 : 200);
        if (!revoke) assert.equal((await response.json()).receipt.outcome, 'unknown'); assert.equal(calls, 1);
      } finally { app.service.close(); }
    }
  });
  await check('scope start rejects foreign retained bindings, nonvoid authority, key loss and caller scheduling settings before scheduling',async()=>{
    const f=await setup();let calls=0;const scheduler={start:async()=>{calls++;return{outcome:'unknown'};}};
    const api=createScopeStartHarness(f,scheduler);
    try{
      for(const key of ['reviewId','draftId'])assert.equal((await api.post({[key]:randomUUID()})).status,503);
      for(const key of ['preparationDigest','revisionDigest'])assert.equal((await api.post({[key]:'f'.repeat(64)})).status,503);
      for(const key of ['namespace','taskQueue','expiresAt','batchIds','budget','profile'])assert.equal((await api.post({[key]:'PRIVATE'})).status,422);
      for(const patch of [{authorizeStart:async()=>true as any},{records:{...f.deps.records.originals,keyForDraft:async()=>{throw new Error('PRIVATE key loss');}}}]){
        const denied=createScopeStartHarness(f,scheduler,patch);try{const response=await denied.post();assert.equal(response.status,503);assert.equal((await response.text()).includes('PRIVATE'),false);}finally{denied.service.close();}
      }
      assert.equal(calls,0);
    }finally{api.service.close();}
  });
  await check('scope start authorizes the actual retained original again after scheduler work without creating records or retrying dispatch',async()=>{
    const f=await setup(),before=await snapshots(f);let allowed=true,calls=0;
    const api=createScopeStartHarness(f,{start:async(_target,current)=>{await current();calls++;allowed=false;return{outcome:'unknown'};}},
      {authorizeStart:async()=>{if(!allowed)throw new Error('PRIVATE authority loss');}});
    try{const response=await api.post();assert.equal(response.status,503);assert.equal((await response.text()).includes('PRIVATE'),false);assert.equal(calls,1);assert.deepEqual(await snapshots(f),before);}
    finally{api.service.close();}
  });
}
