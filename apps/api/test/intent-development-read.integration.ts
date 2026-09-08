import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Pool } from 'pg';
import type { createDraftLifecycleStore } from '@steer/data/draft-lifecycle';
import type { createDraftRevisionStore } from '@steer/data/draft-revisions';
import { createDevelopmentStepRuntime } from '../../worker/src/development-step-runtime.ts';
import type { createRecordedDevelopmentModel } from '../../worker/src/recorded-development-model.ts';
import { createVerifiedDevelopmentReader } from '../src/runtime.ts';
import { createApi } from '../src/app.ts';

type ReaderDependencies = Parameters<typeof createVerifiedDevelopmentReader>[2];
interface Fixture {
  config: { organizationId: string; subject: string; productId: string; repository: string; branch: string; configurationRevision: string; recordsPolicyDigest: string };
  execution: { expiresAt: string; budget: { budgetId: string } };
  pools: Parameters<typeof createVerifiedDevelopmentReader>[0];
  deps: ReaderDependencies['records']; gatewayProfiles: ReaderDependencies['profiles'];
  target: { operationId: string; inputDigest: string };
  reader: Parameters<typeof createDevelopmentStepRuntime>[3]['reader'];
  recordedModel(transport: typeof fetch): ReturnType<typeof createRecordedDevelopmentModel>;
  draftId: string; saved: { reference: { revisionDigest: string } };
  drafts: ReturnType<typeof createDraftRevisionStore>; lifecycle: ReturnType<typeof createDraftLifecycleStore>;
  content: { originalText: string; clarificationTurns: string[]; documents: null };
}

/** Actual HTTP + SQL/encryption + recorded SDK fixture. No real grants, model
 * transport or live records retention. Reads never gain a dispatch capability. */
export async function testIntentDevelopmentRead(setup: (ttl?: number) => Promise<Fixture>, check: (name: string, run: () => Promise<void>) => Promise<void>, admin: Pool) {
  const services: ReturnType<typeof createVerifiedDevelopmentReader>[] = [];
  const api = (f: Fixture, patch: Partial<ReaderDependencies> = {}) => {
    const reader = createVerifiedDevelopmentReader(f.pools, f.config, { records: f.deps, profiles: f.gatewayProfiles, ...patch }); services.push(reader);
    const state = { principal: { subject: f.config.subject, organizationId: f.config.organizationId, type: 'human', hats: [],
      toolGrants: ['intent.development.read'], expiresAt: new Date(Date.now() + 300000).toISOString() } };
    const app = createApi({ authenticate: async () => state.principal, services: { intentDevelopmentReader: reader } });
    const input = { organizationId: f.config.organizationId, productId: f.config.productId, repository: f.config.repository, ...f.target };
    const post = (override = {}) => app.fetch(new Request('https://steer.example/v1/tools/intent.development.read', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, ...override }),
    }));
    return { post, state, reader };
  };
  const run = async (f: Fixture, role: 'architect' | 'test-agent', questions = false, fail = false) => {
    let calls = 0;
    const model = f.recordedModel(async () => {
      calls++; if (fail) throw new Error('synthetic-dispatch-uncertain');
      const output = role === 'architect' ? { message: 'Private progress message', questions: questions ? ['Which users?'] : [],
        brief: questions ? null : '# Verified candidate Brief 🌸\r\n', spec: questions ? null : '# Verified candidate Spec\n' }
        : { exam: '# Captured Test Agent Exam\nNOT RUN' };
      return Response.json({ id: 'synthetic-completion', object: 'chat.completion', model: 'synthetic-provider-model',
        choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(output) }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } });
    });
    const runtime = createDevelopmentStepRuntime(f.pools, f.config, f.target, { reader: f.reader, model, authorize: async () => {} });
    try { const result = await runtime.run(role, new AbortController().signal); assert.equal(calls, 1); return result; }
    finally { runtime.close(); model.close(); }
  };
  const snapshot = async (f: Fixture) => (await admin.query(`SELECT
    (SELECT count(*) FROM steer_execution.intent_steps WHERE operation_id=$1) AS steps,
    (SELECT count(*) FROM steer_drafts.development_results WHERE operation_id=$1) AS results,
    (SELECT count(*) FROM steer_drafts.development_observations WHERE operation_id=$1) AS observations,
    (SELECT coalesce(sum(amount_microusd),0) FROM steer_usage.model_reservations WHERE budget_id=$2) AS reserved,
    (SELECT count(*) FROM steer_drafts.draft_revisions WHERE draft_id=$3) AS revisions`, [f.target.operationId, f.execution.budget.budgetId, f.draftId])).rows[0];
  try {
    await check('actual development HTTP query reports pending, verified Architect and exact completed candidate bundle across reader recreation without writes', async () => {
      const f = await setup(), initial = await snapshot(f), pending = await api(f).post();
      assert.equal(pending.status, 200); assert.equal(pending.headers.get('cache-control'), 'no-store');
      const p = await pending.json(); assert.equal(p.status, 'pending'); assert.deepEqual(p.results, []); assert.deepEqual(await snapshot(f), initial);
      assert.equal((await run(f, 'architect')).outcome, 'succeeded'); const firstSnapshot = await snapshot(f);
      const first = await api(f).post(); assert.equal(first.status, 200); const a = await first.json();
      assert.equal(a.status, 'pending'); assert.equal(a.results.length, 1); assert.equal(a.results[0].result.output.brief, '# Verified candidate Brief 🌸\r\n');
      assert.deepEqual(await snapshot(f), firstSnapshot);
      assert.equal((await run(f, 'test-agent')).outcome, 'succeeded'); const before = await snapshot(f);
      const response = await api(f).post(); assert.equal(response.status, 200); const result = await response.json();
      assert.equal(result.status, 'candidates-ready'); assert.equal(result.results[1].result.output.exam, '# Captured Test Agent Exam\nNOT RUN');
      assert.equal(result.source.revision, 1); assert.equal(result.source.latestRevision, 1);
      for (const flag of ['savedToGit', 'gateSigned', 'executionAuthorized', 'retryAuthorized']) assert.equal(result[flag], false);
      assert.deepEqual(await (await api(f).post()).json(), result); assert.deepEqual(await snapshot(f), before);
      for (const marker of ['Private observed original', 'Exact answer', 'synthetic-gateway-key', 'modelRoute', 'requestBody', 'ciphertext', 'fencingToken', 'owner'])
        assert.equal(JSON.stringify(result).includes(marker), false, marker);
    });
    await check('development HTTP clarification and uncertain dispatch remain distinct; no query starts a Test Agent or retries a model', async () => {
      for (const uncertain of [false, true]) {
        const f = await setup(); assert.equal((await run(f, 'architect', !uncertain, uncertain)).outcome, uncertain ? 'attention-required' : 'needs-clarification');
        const before = await snapshot(f), response = await api(f).post(); assert.equal(response.status, 200); const result = await response.json();
        assert.equal(result.status, uncertain ? 'attention-required' : 'needs-clarification');
        assert.equal(result.steps[1].state, 'pending'); assert.equal(result.results.length, uncertain ? 0 : 1);
        if (!uncertain) assert.deepEqual(result.results[0].result.output.questions, ['Which users?']);
        assert.deepEqual(await snapshot(f), before);
      }
    });
    await check('development HTTP exposes superseded source binding without replacing newer human draft text', async () => {
      const f = await setup(); assert.equal((await run(f, 'architect')).outcome, 'succeeded');
      assert.equal((await f.drafts.append({ draftId: f.draftId, mutationId: randomUUID(), expectedRevision: 1, expectedDigest: f.saved.reference.revisionDigest,
        content: { ...f.content, originalText: 'Newer human correction' } })).outcome, 'acknowledged');
      const response = await api(f).post(); assert.equal(response.status, 200); const result = await response.json();
      assert.equal(result.status, 'superseded'); assert.equal(result.source.revision, 1); assert.equal(result.source.latestRevision, 2);
      assert.equal((await f.drafts.read({ draftId: f.draftId, revision: 'latest' })).content.originalText, 'Newer human correction');
    });
    await check('current profile mismatch, observation denial, wrong product and missing grant cannot release development documents through HTTP', async () => {
      const f = await setup(); assert.equal((await run(f, 'architect')).outcome, 'succeeded'); const before = await snapshot(f);
      const mismatch = api(f, { profiles: { ...f.gatewayProfiles, architect: { ...f.gatewayProfiles.architect, allowedResponseModels: ['different-model'] } } });
      assert.equal((await mismatch.post()).status, 503);
      const denied = api(f, { records: { ...f.deps, authorize: async () => { throw new Error('PRIVATE-OBSERVATION-DENIAL'); } } });
      const response = await denied.post(); assert.equal(response.status, 503); assert.equal((await response.text()).includes('PRIVATE'), false);
      const normal = api(f); assert.equal((await normal.post({ productId: 'other' })).status, 403);
      normal.state.principal.toolGrants = []; assert.equal((await normal.post()).status, 403); assert.deepEqual(await snapshot(f), before);
    });
    await check('mid-read identity revocation and durable holds withhold private result bodies without deleting retained work', async () => {
      const f = await setup(); assert.equal((await run(f, 'architect')).outcome, 'succeeded');
      let revoke = () => {};
      const reading = api(f, { records: { ...f.deps, originals: { ...f.deps.originals, keyForDraft: async (...args) => {
        const key = await f.deps.originals.keyForDraft(...args); revoke(); return key;
      } } } });
      revoke = () => { reading.state.principal.toolGrants = []; };
      assert.equal((await reading.post()).status, 403);
      assert.equal((await f.lifecycle.hold({ draftId: f.draftId, holdReference: randomUUID() })).outcome, 'ok');
      const before = await snapshot(f), response = await api(f).post(); assert.equal(response.status, 503);
      assert.equal((await response.text()).includes('Verified candidate'), false); assert.deepEqual(await snapshot(f), before);
    });
    await check('expired development returns only records-authorized expired metadata, without renewing execution or disclosing result history', async () => {
      const f = await setup(5000); assert.equal((await run(f, 'architect')).outcome, 'succeeded');
      await delay(Math.max(0, Date.parse(f.execution.expiresAt) - Date.now() + 50));
      const denyOperation = async () => { throw new Error('expired execution permission'); };
      const reader = api(f, { records: { ...f.deps, originals: { ...f.deps.originals, authorizeOperation: denyOperation }, results: { ...f.deps.results, authorizeOperation: denyOperation } } });
      const before = await snapshot(f), response = await reader.post(); assert.equal(response.status, 200); const result = await response.json();
      assert.equal(result.status, 'expired'); assert.equal(result.steps, null); assert.deepEqual(result.results, []); assert.deepEqual(await snapshot(f), before);
    });
  } finally { services.forEach(s => s.close()); }
}
