import assert from 'node:assert/strict';
import test from 'node:test';
import { createScopeReviewReader } from '../src/scope-review-reader.ts';
import { createScopeReviewHistoryReader } from '../src/scope-review-history-reader.ts';
import { createIntentDevelopmentReader } from '../src/intent-development-reader.ts';
import { createIntentDevelopmentHistoryReader } from '../src/intent-development-history-reader.ts';
import { createIntentDevelopmentStarter } from '../src/intent-development-starter.ts';

const config = { organizationId: 'org', subject: 'human', productId: 'product', repository: 'github:52',
  branch: 'codex/synthetic', configurationRevision: 'r1', recordsPolicyDigest: 'a'.repeat(64) };
const id = '00000000-0000-4000-8000-000000000292', digest = 'b'.repeat(64);
const scopeTarget = { reviewId: id, preparationDigest: digest };
const developmentTarget = { organizationId: config.organizationId, productId: config.productId,
  repository: config.repository, operationId: id, inputDigest: digest };
const turn = () => new Promise<void>(resolve => setImmediate(resolve));
const kinds = ['scope', 'scope-history', 'development', 'development-history', 'start'] as const;

function fixture(kind: typeof kinds[number], policy: () => Promise<void>) {
  let effects = 0;
  const forbidden = async (): Promise<never> => { effects++; throw new Error('No content IO or effects permitted'); };
  const pool = { connect: forbidden }, pools = { drafts: pool, execution: pool };
  const originals = { authorize: policy, authorizeOriginal: policy, authorizeOperation: policy,
    authorizeReview: policy, authorizeDraft: policy, authorizeHistoricalRead: policy, keyForDraft: forbidden };
  const records = { authorize: policy, authorizeHistoricalRead: policy, authorizeHistoricalReview: policy,
    verifyObservation: forbidden, verifyHistoricalExchange: forbidden, originals,
    results: { authorizeOperation: policy, authorizeResult: policy, authorizeDraft: policy,
      authorizeHistoricalResult: policy, keyForDraft: forbidden } };
  let run: (current: () => Promise<void>) => Promise<unknown>, close: () => void;
  if (kind === 'start') {
    const service = createIntentDevelopmentStarter(pools, config, { records: originals,
      authorizeStart: forbidden, scheduler: { start: forbidden } });
    run = current => service.start({ ...developmentTarget, draftId: id, revision: 1, revisionDigest: digest }, current);
    close = () => service.close();
  } else if (kind === 'scope' || kind === 'scope-history') {
    const service = kind === 'scope' ? createScopeReviewReader(pools, config, records)
      : createScopeReviewHistoryReader(pools, config, records);
    run = current => service.read(scopeTarget, current); close = () => service.close();
  } else {
    const service = kind === 'development' ? createIntentDevelopmentReader(pools, config, { records, exchange: { verify: forbidden } })
      : createIntentDevelopmentHistoryReader(pools, config, records);
    run = current => service.read(developmentTarget, current); close = () => service.close();
  }
  return { run, close, effects: () => effects };
}

for (const kind of kinds) {
  test(`${kind}: initial authentication precedes metadata; revocation during policy blocks all content IO/effects`, async () => {
    const events: string[] = []; let allowed = true;
    const f = fixture(kind, async () => { events.push('policy'); allowed = false; });
    await assert.rejects(f.run(async () => { events.push('current'); if (!allowed) throw new Error('revoked'); }));
    // Historical scope windows independently authenticate before owner work.
    assert.deepEqual(events, [...(kind === 'development-history' ? ['current'] : []), 'current', 'policy', 'current']);
    assert.equal(f.effects(), 0); f.close();
    let calls = 0; const denied = fixture(kind, async () => { calls++; });
    await assert.rejects(denied.run(async () => { throw new Error('initial denial'); }));
    assert.equal(calls, 0); assert.equal(denied.effects(), 0); denied.close();
  });

  test(`${kind}: timed-out metadata keeps four admissions until drain and cannot start late IO`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let release!: () => void, policies = 0, checks = 0;
    const held = new Promise<void>(resolve => { release = resolve; });
    const f = fixture(kind, async () => { policies++; await held; });
    const rejected = Array.from({ length: 4 }, () => assert.rejects(f.run(async () => { checks++; })));
    const initialChecks = kind === 'development-history' ? 8 : 4;
    await turn(); assert.equal(policies, 4); assert.equal(checks, initialChecks);
    t.mock.timers.tick(30001); await Promise.all(rejected);
    await assert.rejects(f.run(async () => { checks++; })); assert.equal(checks, initialChecks); assert.equal(policies, 4);
    f.close(); release(); await turn(); assert.equal(f.effects(), 0); assert.equal(checks, initialChecks);
  });
}
