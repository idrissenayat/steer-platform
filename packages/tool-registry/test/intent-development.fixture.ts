import { createHash, randomUUID } from 'node:crypto';
import { buildIntentEvidenceEnvelope } from '../src/intent-evidence-contracts.ts';
import { planIntentScopeBatches } from '../src/intent-scope-batches.ts';
import { fingerprintIntentScope } from '../src/intent-revision-contracts.ts';
import { intentDevelopmentReviewOutputSchema } from '../src/intent-development-review-contracts.ts';
import { intentDevelopmentPrepareOutputSchema } from '../src/intent-development-prepare-contracts.ts';
import { intentDevelopmentStartOutputSchema } from '../src/intent-development-start-contracts.ts';
import { intentDevelopmentReadOutputSchema } from '../src/intent-development-read-contracts.ts';

export async function developmentFixture() {
  const scope = { organizationId: 'org', productId: 'product', repository: 'github:52' }, draftId = randomUUID();
  const content = { originalText: ' A new booking service فارسی\r\n', clarificationTurns: ['Patients book for themselves.'], documents: null };
  const input = { ...scope, draftId, revision: 1, revisionDigest: 'a'.repeat(64),
    scopeInputDigest: (await fingerprintIntentScope({ ...scope, draftId, sourceRevision: 1, ...content })).scopeInputDigest };
  const text = '# Existing billing\nOut of scope: patient booking\n';
  const evidence = { ...scope, branch: 'codex/synthetic', head: 'b'.repeat(40), scopeInputDigest: input.scopeInputDigest,
    permissionsRevision: 'permissions-r1', retrievalConfigurationRevision: 'retrieval-r1', inventoryComplete: true, accessGapCount: 0,
    inventory: [{ sourceId: 'brief-1', targetId: 'intent/0001', path: 'intent/0001/BRIEF.md', status: 'canonical',
      contentDigest: createHash('sha256').update(text).digest('hex'), blobOid: createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0${text}`).digest('hex') }],
    documents: [{ sourceId: 'brief-1', content: text }] };
  const envelope = await buildIntentEvidenceEnvelope(evidence);
  const review = intentDevelopmentReviewOutputSchema.parse({ ...input, kind: 'steer-development-review/v1', configurationRevision: 'config-r1',
    scopeBatchPlan: (await planIntentScopeBatches(evidence)).summary,
    sourceSnapshotDigest: envelope.sourceSnapshotDigest, evidence, semanticReviewComplete: false, authoritativeClearance: false,
    executionAuthorized: false, savedToGit: false, gateSigned: false });
  const choice = { action: 'new-distinct' as const, reason: 'The reviewed billing scope excludes patient booking.' };
  const prepareInput = { ...input, configurationRevision: review.configurationRevision, sourceSnapshotDigest: review.sourceSnapshotDigest, choice };
  const prepared = intentDevelopmentPrepareOutputSchema.parse({ ...prepareInput, kind: 'steer-development-prepare/v1', outcome: 'prepared',
    reference: { operationId: randomUUID(), inputDigest: 'c'.repeat(64) }, coverage: { inventoryComplete: true, inventoryCount: 1,
      includedCount: 1, accessGapCount: 0, gapCount: 0, complete: true }, originalPreserved: true, readyToRequestStart: true,
    semanticReviewComplete: false, authoritativeClearance: false, executionAuthorized: false, documentsReady: false, savedToGit: false, gateSigned: false });
  const startInput = { ...scope, draftId, revision: 1, revisionDigest: input.revisionDigest, ...prepared.reference! };
  const started = intentDevelopmentStartOutputSchema.parse({ ...startInput, kind: 'steer-development-start/v1', receipt: { outcome: 'acknowledged',
    workflowId: `steer-development/v1/${scope.organizationId}/${startInput.operationId}`, runId: randomUUID(), state: 'RUNNING' },
    savedToGit: false, gateSigned: false, documentsReady: false, retryAuthorized: false });
  const readInput = { ...scope, ...prepared.reference! };
  const pending = intentDevelopmentReadOutputSchema.parse({ ...readInput, kind: 'steer-development-read/v1', source: { draftId, revision: 1,
    revisionDigest: input.revisionDigest, scopeInputDigest: input.scopeInputDigest, latestRevision: 1 }, status: 'pending',
    steps: [{ role: 'architect', state: 'pending' }, { role: 'test-agent', state: 'pending' }], results: [],
    savedToGit: false, gateSigned: false, executionAuthorized: false, retryAuthorized: false });
  const architect = { resultRef: randomUUID(), resultDigest: 'd'.repeat(64), result: { role: 'architect',
    output: { message: 'Review these candidate documents.', questions: [], brief: '# Brief\nPatient booking', spec: '# Spec\nBooking AC-01' } } };
  const ready = intentDevelopmentReadOutputSchema.parse({ ...pending, status: 'candidates-ready',
    steps: [{ role: 'architect', state: 'succeeded' }, { role: 'test-agent', state: 'succeeded' }], results: [architect,
      { resultRef: randomUUID(), resultDigest: 'e'.repeat(64), result: { role: 'test-agent', output: { exam: '# Exam\nNOT RUN\n<script>unsafe()</script>' } } }] });
  const questions = intentDevelopmentReadOutputSchema.parse({ ...pending, status: 'needs-clarification',
    steps: [{ role: 'architect', state: 'succeeded' }, { role: 'test-agent', state: 'pending' }], results: [{ ...architect,
      result: { role: 'architect', output: { message: 'One necessary detail.', questions: ['Which booking rules apply?'], brief: null, spec: null } } }] });
  return { scope, input, content, evidence, envelope, review, choice, prepareInput, prepared, startInput, started, readInput, pending, ready, questions };
}
