import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildScopeEvaluationSuite, SYNTHETIC_SCOPE_EVALUATION_PROFILE, evaluationHash } from '../evals/intent-scope-cases.ts';
import { evaluateScopeReplay } from '../evals/intent-scope-evaluation.ts';
import { createRecordedScopeMastraRuntime, type RecordedRequest, type RecordedResponse, type RecordedScopeResult } from '../src/recorded-mastra.ts';

async function syntheticReplay() {
  const suite = await buildScopeEvaluationSuite(), samples = [];
  for (const c of suite.cases) {
    const observations: Array<{ batchId: string; request: RecordedRequest; response: RecordedResponse<RecordedScopeResult> }> = [];
    const runtime = await createRecordedScopeMastraRuntime({ ...c.input, gatewayUrl: 'http://127.0.0.1:4000/v1', gatewayKey: 'synthetic-never-live',
      transport: async (_, init) => {
        const context = JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
        const b = c.prepared.batches.find(b => b.metadata.batchId === context.binding.batchId)!;
        const output = { assessmentInputDigest: b.envelope.assessmentInputDigest, configurationRevision: c.input.profile.profileRevision,
          findings: c.oracle.expectations.filter(e => b.metadata.targetIds.includes(e.targetId)).map(e => {
            const sources = b.envelope.evidence.filter(s => s.targetId === e.targetId);
            return { targetId: e.targetId, assessedSourceIds: sources.map(s => s.sourceId), relation: e.relation,
              overlapExplanation: 'Synthetic expected output; not model judgment.', missingScopeExplanation: e.rationale,
              citations: sources.map(s => ({ sourceId: s.sourceId, startByte: 0, endByte: s.endByte, quote: s.content })) };
          }) };
        return Response.json({ id: 'synthetic-response', object: 'chat.completion', model: 'synthetic-eval-model', created: 1,
          choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(output) } }],
          usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } });
      } });
    for (const b of runtime.plan.batches) {
      let request!: RecordedRequest, response!: RecordedResponse<RecordedScopeResult>;
      await runtime.generate(b.batchId, { recordRequest: async v => { request = v; }, authorizeDispatch: async () => {},
        recordResponse: async v => { response = v; } }, new AbortController().signal);
      observations.push({ batchId: b.batchId, request, response });
    }
    samples.push({ caseId: c.id, caseDigest: c.caseDigest, observations });
  }
  return { kind: 'steer-scope-evaluation-replay/v1' as const, suiteDigest: suite.suiteDigest, profile: suite.profile, samples };
}
let captured: ReturnType<typeof syntheticReplay> | undefined;
const replay = async () => structuredClone(await (captured ??= syntheticReplay()));
type Replay = Awaited<ReturnType<typeof replay>>;
function alterOutput(r: Replay, id: string, change: (output: RecordedScopeResult['output']) => void) {
  const observation = r.samples.find(s => s.caseId === id)!.observations[0]!, response = observation.response;
  change(response.result.output); const body = JSON.parse(response.responseBody);
  body.choices[0].message.content = JSON.stringify(response.result.output); observation.response = { ...response, responseBody: JSON.stringify(body) };
}

test('scope evaluation cases are stable, bounded and hide provisional labels from exact production role inputs', async () => {
  const suite = await buildScopeEvaluationSuite(); assert.deepEqual(await buildScopeEvaluationSuite(), suite);
  assert.equal(suite.cases.length, 23); assert.equal(Object.isFrozen(suite.cases[0]!.oracle.expectations), true);
  assert.equal(suite.cases.find(c => c.id === 'cross-batch-targets')!.prepared.batches.length, 2);
  for (const c of suite.cases) for (const b of c.prepared.batches) {
    const context = JSON.parse(b.packet.request.source);
    assert.deepEqual(context.intent, { originalText: c.input.scope.originalText, clarificationTurns: c.input.scope.clarificationTurns, documents: c.input.scope.documents });
    assert.equal(context.oracle, undefined); assert.equal(context.caseId, undefined); assert.equal(context.category, undefined);
    for (const e of c.oracle.expectations) assert.ok(!b.packet.request.source.includes(e.rationale));
  }
  const changed = await buildScopeEvaluationSuite({ ...SYNTHETIC_SCOPE_EVALUATION_PROFILE, modelRoute: 'changed-route' });
  assert.notEqual(changed.suiteDigest, suite.suiteDigest); assert.notEqual(changed.cases[0]!.caseDigest, suite.cases[0]!.caseDigest);
});

test('23 synthetic reference replays pass candidate checks through actual SDK verification but never claim live semantic acceptance', async () => {
  const original = globalThis.fetch; let network = 0;
  globalThis.fetch = async () => { network++; throw new Error('Offline test must not reach a provider.'); };
  try {
    const input = await replay(), report = await evaluateScopeReplay(input);
    assert.deepEqual(report.summary, { totalCases: 23, suppliedCases: 23, passedCases: 23, failedCases: 0, missingCases: 0,
      expectedTargets: 36, matchedTargets: 36, verifiedExchanges: 21 });
    assert.equal(report.candidateChecksPassed, true); assert.equal(report.semanticQualityVerified, false);
    assert.equal(report.liveProviderEvidenceVerified, false); assert.equal(report.executionAuthorized, false); assert.equal(report.gateSigned, false);
    assert.equal(report.explanationReviewRequired, true); assert.equal(report.labelsStatus, 'candidate-not-human-adjudicated');
    assert.equal(network, 0); assert.equal(Object.isFrozen(report.summary), true);
    assert.deepEqual(await evaluateScopeReplay(input), report);
    const { reportDigest, ...payload } = report; assert.equal(reportDigest, evaluationHash(['steer-scope-evaluation-report/v1', payload]));
    const printed = JSON.stringify(report);
    assert.ok(!printed.includes('synthetic-never-live')); assert.ok(!printed.includes('Warehouse stock'));
    assert.ok(!printed.includes('Gate 2 is signed')); assert.ok(!printed.includes('requestBody'));
  } finally { globalThis.fetch = original; }
});

test('missing samples or the second batch cannot be dropped from the report denominator', async () => {
  const input = await replay(); input.samples = input.samples.filter(s => s.caseId !== 'exact-duplicate');
  input.samples.find(s => s.caseId === 'cross-batch-targets')!.observations.pop();
  const report = await evaluateScopeReplay(input); assert.equal(report.candidateChecksPassed, false);
  assert.equal(report.summary.totalCases, 23); assert.equal(report.summary.expectedTargets, 36); assert.equal(report.summary.missingCases, 1);
  assert.equal(report.cases.find(c => c.caseId === 'exact-duplicate')!.status, 'not-evaluated');
  assert.ok(report.cases.find(c => c.caseId === 'cross-batch-targets')!.failures.includes('missing-batch'));
  const empty = await evaluateScopeReplay({ ...input, samples: [] }); assert.equal(empty.summary.missingCases, 23); assert.equal(empty.candidateChecksPassed, false);
});

test('structurally valid but semantically wrong labels and qualifier-free citations fail separate candidate criteria', async () => {
  const input = await replay();
  alterOutput(input, 'explicit-negation', o => { o.findings[0]!.relation = 'already-covered'; });
  alterOutput(input, 'unclear-intent', o => { o.findings[0]!.relation = 'no-match-in-assessed-scope'; });
  alterOutput(input, 'heading-exclusion', o => { for (const q of o.findings[0]!.citations) { q.quote = '#'; q.endByte = 1; } });
  const report = await evaluateScopeReplay(input); assert.equal(report.summary.failedCases, 3); assert.equal(report.summary.verifiedExchanges, 21);
  for (const id of ['explicit-negation', 'unclear-intent']) assert.ok(report.cases.find(c => c.caseId === id)!.failures.includes('relation-mismatch'));
  assert.deepEqual(report.cases.find(c => c.caseId === 'heading-exclusion')!.failures, ['missing-decisive-citation']);
});

test('complete-empty, unknown-empty and missing-target coverage stay distinct and cannot create scope clearance', async () => {
  const suite = await buildScopeEvaluationSuite();
  assert.equal(suite.cases.find(c => c.id === 'complete-empty')!.oracle.expectedPlannedComplete, true);
  assert.equal(suite.cases.find(c => c.id === 'unknown-empty')!.oracle.expectedPlannedComplete, false);
  assert.equal(suite.cases.find(c => c.id === 'missing-whole-target')!.oracle.expectedState, 'incomplete');
  assert.equal(suite.cases.find(c => c.id === 'access-gap')!.oracle.expectedStructuralComplete, false);
  assert.ok(suite.cases.filter(c => c.prepared.batches.length === 0).every(c => !c.oracle.expectedStructuralComplete));
});

test('corrupted citations, request drift, refusal and claimed authority fail recorded replay without leaking raw output', async () => {
  const input = await replay();
  alterOutput(input, 'exact-duplicate', o => { o.findings[0]!.citations[0]!.quote = 'PRIVATE CORRUPTION'; });
  const altered = input.samples.find(s => s.caseId === 'paraphrased-duplicate')!.observations[0]!;
  altered.request = { ...altered.request, requestBody: altered.request.requestBody.replace('Patients', 'Staff') };
  const refused = input.samples.find(s => s.caseId === 'unrelated-scope')!.observations[0]!;
  const body = JSON.parse(refused.response.responseBody); body.choices[0].message.refusal = 'PRIVATE REFUSAL';
  refused.response = { ...refused.response, responseBody: JSON.stringify(body) };
  alterOutput(input, 'untrusted-instructions', o => { Object.assign(o, { gateSigned: true }); });
  const report = await evaluateScopeReplay(input); assert.equal(report.summary.failedCases, 4);
  assert.equal(report.candidateChecksPassed, false); assert.ok(!JSON.stringify(report).includes('PRIVATE'));
  for (const id of ['exact-duplicate', 'paraphrased-duplicate', 'unrelated-scope', 'untrusted-instructions'])
    assert.ok(report.cases.find(c => c.caseId === id)!.failures.includes('invalid-exchange'));
});

test('stale corpus/profile, duplicate samples/batches and foreign identities fail before scoring', async () => {
  const input = await replay();
  for (const transform of [(r: Replay) => { r.suiteDigest = '0'.repeat(64); },
    (r: Replay) => { r.profile.modelRoute = 'wrong'; }, (r: Replay) => { r.samples[0]!.caseDigest = '0'.repeat(64); },
    (r: Replay) => { r.samples[0]!.caseId = 'unknown'; }, (r: Replay) => { r.samples.push(r.samples[0]!); },
    (r: Replay) => { r.samples[0]!.observations.push(r.samples[0]!.observations[0]!); },
    (r: Replay) => { r.samples[0]!.observations[0]!.batchId = '0'.repeat(64); }]) {
    const changed = structuredClone(input); transform(changed); await assert.rejects(evaluateScopeReplay(changed));
  }
});

test('offline command prints only a manifest and rejects unknown commands or invalid replay without disclosing input', () => {
  const script = fileURLToPath(new URL('../evals/run-intent-scope-evaluation.ts', import.meta.url));
  const manifest = JSON.parse(execFileSync(process.execPath, [script, '--manifest'], { encoding: 'utf8' }));
  assert.equal(manifest.cases.length, 23); assert.equal(manifest.modelCallsStarted, 0); assert.equal(manifest.executionAuthorized, false);
  for (const args of [['--live'], ['--replay', script]]) {
    try { execFileSync(process.execPath, [script, ...args], { encoding: 'utf8', stdio: 'pipe' }); assert.fail('Should reject'); }
    catch (error) { const e = error as { status: number; stdout: string; stderr: string }; assert.equal(e.status, 2);
      assert.equal(e.stdout, ''); assert.ok(!e.stderr.includes(script)); assert.ok(e.stderr.includes('No model call was made.')); }
  }
});

test('offline replay command scores regular files, reports missing cases and rejects symlinks/FIFOs without waiting', async () => {
  const script = fileURLToPath(new URL('../evals/run-intent-scope-evaluation.ts', import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), 'steer-synthetic-scope-eval-')), file = join(dir, 'synthetic.json');
  try {
    const input = await replay(); writeFileSync(file, JSON.stringify(input), { flag: 'wx', mode: 0o600 });
    const report = JSON.parse(execFileSync(process.execPath, [script, '--replay', file], { encoding: 'utf8', timeout: 10000 }));
    assert.equal(report.summary.passedCases, 23); assert.equal(report.semanticQualityVerified, false);
    const missing = join(dir, 'missing.json'); writeFileSync(missing, JSON.stringify({ ...input, samples: [] }), { flag: 'wx', mode: 0o600 });
    const link = join(dir, 'alias.json'); symlinkSync(file, link);
    const fifo = join(dir, 'pipe'); execFileSync('mkfifo', [fifo]);
    for (const [path, status] of [[missing, 1], [link, 2], [fifo, 2]] as const) {
      try { execFileSync(process.execPath, [script, '--replay', path], { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }); assert.fail('Should reject'); }
      catch (error) { const e = error as { status: number; stdout: string; stderr: string }; assert.equal(e.status, status);
        if (status === 1) assert.equal(JSON.parse(e.stdout).summary.missingCases, 23);
        else { assert.equal(e.stdout, ''); assert.ok(!e.stderr.includes(dir)); } }
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
