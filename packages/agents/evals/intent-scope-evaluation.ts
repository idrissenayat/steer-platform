import { z } from 'zod';
import { scopeReviewProfileSchema } from '@steer/tool-registry/intent-scope-review';
import { validateIntentScopeBatchResults } from '@steer/tool-registry/intent-scope-batches';
import { createRecordedScopeMastraVerifier, type RecordedRequest, type RecordedResponse, type RecordedScopeResult } from '../src/recorded-mastra.ts';
import { buildScopeEvaluationSuite, evaluationHash, freezeEvaluation, SCOPE_EVALUATION_REVISION, type ScopeEvaluationCase } from './intent-scope-cases.ts';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const sample = z.strictObject({ caseId: z.string().regex(/^[a-z0-9-]{1,100}$/), caseDigest: digest,
  observations: z.array(z.strictObject({ batchId: digest, request: z.unknown(), response: z.unknown() })).max(8) });
const replaySchema = z.strictObject({ kind: z.literal('steer-scope-evaluation-replay/v1'), suiteDigest: digest,
  profile: scopeReviewProfileSchema, samples: z.array(sample).max(100) });
type Sample = z.infer<typeof sample>;
type Failure = 'missing-case' | 'missing-batch' | 'invalid-exchange' | 'coverage-mismatch' | 'missing-target'
  | 'relation-mismatch' | 'missing-decisive-citation';
function spansCovered(spans: Array<{ startByte: number; endByte: number }>, start: number, end: number) {
  let until = start;
  for (const span of [...spans].sort((a, b) => a.startByte - b.startByte)) {
    if (span.startByte > until) break;
    until = Math.max(until, span.endByte); if (until >= end) return true;
  }
  return false;
}
async function scoreCase(c: ScopeEvaluationCase, sample: Sample | undefined) {
  const failures = new Set<Failure>(); let verifiedExchanges = 0, matchedTargets = 0;
  if (!sample) failures.add('missing-case');
  else {
    const results: RecordedScopeResult[] = [];
    try {
      const verifier = await createRecordedScopeMastraVerifier(c.input);
      for (const o of sample.observations) {
        results.push(verifier.verify(o.batchId, o.request as RecordedRequest, o.response as RecordedResponse<RecordedScopeResult>).result);
        verifiedExchanges++;
      }
      const combined = await validateIntentScopeBatchResults(c.input.evidence,
        results.map(r => ({ batchId: r.batchId, planDigest: r.planDigest, assessment: r.output })), c.input.profile.profileRevision);
      if (combined.pendingBatchIds.length) failures.add('missing-batch');
      if (combined.state !== c.oracle.expectedState || combined.coverage.plannedComplete !== c.oracle.expectedPlannedComplete
        || combined.structuralAssessmentComplete !== c.oracle.expectedStructuralComplete) failures.add('coverage-mismatch');
      const findings = combined.results.flatMap(r => r.findings);
      for (const expected of c.oracle.expectations) {
        const actual = findings.find(f => f.targetId === expected.targetId);
        if (!actual) { failures.add('missing-target'); continue; }
        if (actual.relation !== expected.relation) failures.add('relation-mismatch'); else matchedTargets++;
        if (expected.decisiveSpans.some(span => !spansCovered(actual.citations.filter(q => q.sourceId === span.sourceId), span.startByte, span.endByte)))
          failures.add('missing-decisive-citation');
      }
    } catch { failures.add('invalid-exchange'); }
  }
  return { caseId: c.id, category: c.category, caseDigest: c.caseDigest, status: !sample ? 'not-evaluated' as const
    : failures.size ? 'failed' as const : 'passed-candidate-checks' as const, failures: [...failures].sort(),
    verifiedExchanges, matchedTargets, expectedTargets: c.oracle.expectations.length, explanationReviewRequired: true as const };
}

/** Offline, read-only replay. No gateway, environment access, file writes or
 * generation methods. Exact SDK wire verification is NOT provider provenance.
 * Even a perfect score against candidate labels cannot enable a runtime/gate. */
export async function evaluateScopeReplay(raw: unknown) {
  if (Buffer.byteLength(JSON.stringify(raw)) > 32 * 1024 * 1024) throw new Error('Scope evaluation input exceeds limits.');
  const input = replaySchema.parse(raw), suite = await buildScopeEvaluationSuite(input.profile);
  if (input.suiteDigest !== suite.suiteDigest || new Set(input.samples.map(s => s.caseId)).size !== input.samples.length)
    throw new Error('Scope evaluation binding is invalid.');
  for (const s of input.samples) {
    const c = suite.cases.find(c => c.id === s.caseId);
    if (!c || s.caseDigest !== c.caseDigest || new Set(s.observations.map(o => o.batchId)).size !== s.observations.length
      || s.observations.some(o => !c.prepared.plan.batches.some(b => b.batchId === o.batchId))) throw new Error('Scope evaluation binding is invalid.');
  }
  const cases = [];
  for (const c of suite.cases) cases.push(await scoreCase(c, input.samples.find(s => s.caseId === c.id)));
  const summary = { totalCases: cases.length, suppliedCases: input.samples.length,
    passedCases: cases.filter(c => c.status === 'passed-candidate-checks').length,
    failedCases: cases.filter(c => c.status === 'failed').length, missingCases: cases.filter(c => c.status === 'not-evaluated').length,
    expectedTargets: cases.reduce((n, c) => n + c.expectedTargets, 0), matchedTargets: cases.reduce((n, c) => n + c.matchedTargets, 0),
    verifiedExchanges: cases.reduce((n, c) => n + c.verifiedExchanges, 0) };
  const payload = { kind: 'steer-scope-evaluation-report/v1' as const, evaluationRevision: SCOPE_EVALUATION_REVISION,
    suiteDigest: suite.suiteDigest, replayDigest: evaluationHash(input), labelsStatus: suite.labelsStatus, summary, cases,
    candidateChecksPassed: summary.passedCases === summary.totalCases, explanationReviewRequired: true as const,
    semanticQualityVerified: false as const, liveProviderEvidenceVerified: false as const,
    executionAuthorized: false as const, savedToGit: false as const, gateSigned: false as const };
  return freezeEvaluation({ ...payload, reportDigest: evaluationHash(['steer-scope-evaluation-report/v1', payload]) });
}
