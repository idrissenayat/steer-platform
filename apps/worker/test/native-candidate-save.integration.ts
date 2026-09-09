import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { DefaultLogger, Runtime, Worker } from '@temporalio/worker';
import type { Client } from '@temporalio/client';
import type { IntentDraftService } from '@steer/tool-registry/intent-draft-contracts';
import { verifyCandidateSaveStart, type CandidateSaveScheduler } from '@steer/tool-registry/candidate-save-start-contracts';
import { verifyCandidateSaveStatus } from '@steer/tool-registry/candidate-save-status-contracts';
import { verifyCandidateBundleRead } from '@steer/tool-registry/candidate-bundle-read-contracts';
import { planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import { createCandidateOriginalStore } from '@steer/data/candidate-originals';
import { createGitHubReader } from '@steer/adapters/github';
import { now } from '../../../packages/adapters/test/github-brief-fixture.ts';
import type { scopeStepIntegrationFixture } from './scope-step-runtime.integration.ts';
import { createIsolatedTemporalHarness } from './isolated-temporal-harness.ts';
import { createCandidateSaveWorker } from '../src/worker.ts';
import { createCandidateSaveActivities } from '../src/candidate-save-activity.ts';
import { createDurableCandidateBundleStore } from '../src/candidate-bundle-runtime.ts';
import { createCandidateSaveSchedulerClient } from '../src/client.ts';
import { candidateSaveWorkflowId, parseCandidateSaveTarget } from '../src/candidate-save-contracts.ts';
import { createRecordedCandidateSaveStarter, createRecordedCandidateSaveStatusReader } from '../../api/src/runtime.ts';
import { createVerifiedCandidateBundleReader } from '../../api/src/candidate-reader.ts';
import { createApi } from '../../api/src/app.ts';
import type { testCandidateConfirmationWithHistory } from '../../api/test/candidate-save-prepare.integration.ts';
import type { nativeCandidateJourneyFixture } from '../../api/test/native-candidate-journey.fixture.ts';

const historyText = (value: unknown): string => value instanceof Uint8Array ? Buffer.from(value).toString('utf8')
  : value && typeof value === 'object' ? Object.values(value).map(historyText).join('\n') : typeof value === 'string' ? value : '';

/** Continue the SAME encrypted original and native Git snapshot produced by
 * actual corpus/SDK/preview/confirmation composition. Authorities and provider
 * responses are synthetic; only owned SQL, Temporal and native Git are used. */
export async function testConfirmedNativeCandidateSave(f: Awaited<ReturnType<typeof scopeStepIntegrationFixture>>,
  drafts: IntentDraftService, confirmed: Awaited<ReturnType<typeof testCandidateConfirmationWithHistory>>,
  native: ReturnType<typeof nativeCandidateJourneyFixture>, admin: Pool) {
  const { binding, publication, execution, records } = confirmed;
  const target = parseCandidateSaveTarget({ organizationId: f.config.organizationId,
    operationId: confirmed.reference.operationId, inputDigest: confirmed.reference.inputDigest });
  const owned: Array<{ close(): void }> = [];
  const make = () => {
    const store = createDurableCandidateBundleStore(f.pools.execution, binding, { execution, publication }, {
      fetch: native.git.transport, appJwt: async () => 'synthetic-app-jwt', now: () => now,
      authorizeRead: async () => {}, authorizeOperation: async () => {}, authorizeReconciliation: async () => {},
      evaluateDispatch: async p => {
        // This is a test authority response, never a live gate or write grant.
        native.git.recordSyntheticApproval();
        return { kind: 'steer-candidate-bundle-dispatch-proof/v1', operationId: p.request.bundle.operationId,
          inputDigest: p.plan.inputDigest, currentBinding: p.request.confirmation,
          authorizationRevision: p.plan.expectedHead, sourceReviewRevision: p.plan.expectedHead,
          lifecycleRevision: p.plan.expectedHead, lifecycle: p.plan.requiredLifecycle,
          platformRevision: publication.platformRevision, gate2DecisionDigest: publication.gate2DecisionDigest,
          evaluatedAt: now.toISOString(), validThrough: new Date(now.getTime() + 5000).toISOString() };
      },
    });
    owned.push(store); return store;
  };
  const verifier = make(), originals = createCandidateOriginalStore(f.pools.drafts, f.config,
    { ...records, verifyOriginal: verifier.verifyOriginal });
  owned.push(originals);
  const snapshot = async () => (await admin.query(`SELECT
    (SELECT count(*) FROM steer_execution.intent_operations WHERE organization_id=$1) AS operations,
    (SELECT count(*) FROM steer_drafts.candidate_originals WHERE organization_id=$1) AS originals,
    (SELECT count(*) FROM steer_usage.model_reservations WHERE organization_id=$1) AS reservations`, [f.config.organizationId])).rows[0];
  const state = async () => (await admin.query("SELECT record->>'state' AS state FROM steer_execution.intent_steps WHERE organization_id=$1 AND operation_id=$2",
    [target.organizationId, target.operationId])).rows[0]?.state;
  let worker: Worker | undefined, running: Promise<void> | undefined;
  let harness: Awaited<ReturnType<typeof createIsolatedTemporalHarness>> | undefined;
  const stop = async () => { if (worker) { worker.shutdown(); await running; worker = undefined; running = undefined; } };
  try {
    const request = await originals.read(target), plan = await planCandidateBundle(request.bundle, request.confirmation);
    assert.equal(plan.inputDigest, target.inputDigest); assert.equal(native.git.head(), plan.expectedHead);
    assert.equal(request.bundle.purpose, 'new-candidate'); assert.equal(plan.files.length, 7);
    assert.deepEqual(request.bundle.documents, f.content.documents);
    const before = await snapshot(), encrypted = (await admin.query('SELECT * FROM steer_drafts.candidate_originals WHERE organization_id=$1', [target.organizationId])).rows;
    assert.equal(await state(), undefined); assert.equal(native.git.mutations(), 0);
    const statusInput = { ...target, productId: f.config.productId, repository: f.config.repository,
      branch: f.config.branch, draftId: f.draftId, draftRevision: request.confirmation.draftRevision };
    const input = { ...statusInput, save: true as const };
    let startAllowed = true, toolAllowed = true, starts = 0;
    const actor = (tool: string) => ({ organizationId: target.organizationId, subject: f.config.subject,
      type: 'human', hats: [], toolGrants: toolAllowed ? [tool] : [], expiresAt: new Date(Date.now() + 600000).toISOString() });
    const postStart = async (scheduler: CandidateSaveScheduler) => {
      const service = createRecordedCandidateSaveStarter(f.pools, binding, { records: f.config, execution }, publication, {
        drafts, scheduler, authorizeStart: async () => { if (!startAllowed) throw new Error('PRIVATE current start denied'); },
        authorizeOperation: async () => {}, records,
      });
      try {
        const app = createApi({ authenticate: async () => actor('intent.candidate.save.start'), services: { candidateSaveStarter: service } });
        const response = await app.request('/v1/tools/intent.candidate.save.start', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
        const body = await response.json(); assert.doesNotMatch(JSON.stringify(body), /PRIVATE|ciphertext|Assessed Brief|documents/);
        return { status: response.status, output: response.status === 200 ? verifyCandidateSaveStart(input, body) : null };
      } finally { service.close(); }
    };
    const forbidden: CandidateSaveScheduler = { start: async () => { starts++; throw new Error('Must not schedule'); } };
    toolAllowed = false; assert.equal((await postStart(forbidden)).status, 403); toolAllowed = true;
    startAllowed = false; assert.equal((await postStart(forbidden)).status, 503); startAllowed = true;
    assert.equal(starts, 0); assert.equal(await state(), undefined); assert.deepEqual(await snapshot(), before);

    Runtime.install({ logger: new DefaultLogger('ERROR') });
    harness = await createIsolatedTemporalHarness();
    const env = harness.environment, queue = `steer-native-journey-${randomUUID()}`;
    const lostClient = new Proxy(env.client, { get(object, key) {
      if (key === 'workflow') return new Proxy(object.workflow, { get(workflow, method) {
        if (method === 'start') return async (...args: Parameters<typeof workflow.start>) => {
          starts++; await workflow.start(...args); throw new Error('PRIVATE lost schedule acknowledgement');
        };
        const value = Reflect.get(workflow, method); return typeof value === 'function' ? value.bind(workflow) : value;
      } });
      const value = Reflect.get(object, key); return typeof value === 'function' ? value.bind(object) : value;
    } }) as Client;
    const scheduler = createCandidateSaveSchedulerClient(lostClient, { namespace: 'default', taskQueue: queue });
    owned.push(scheduler);
    const first = await postStart(scheduler); assert.equal(first.status, 200); assert.equal(first.output!.receipt.outcome, 'unknown');
    const second = await postStart(scheduler); assert.equal(second.status, 200); assert.equal(second.output!.receipt.outcome, 'acknowledged');
    assert.equal(second.output!.savedToGit, false); assert.equal(starts, 1); assert.equal(native.git.mutations(), 0);
    assert.equal(await state(), undefined); assert.deepEqual(await snapshot(), before);

    const activities = createCandidateSaveActivities(target, { store: make(), authorize: async () => {}, loadOriginal: ref => originals.read(ref) });
    owned.push(activities); native.git.loseAck();
    worker = await createCandidateSaveWorker({ connection: env.nativeConnection, namespace: 'default', taskQueue: queue,
      workflowBundle: harness.bundle }, activities);
    running = worker.run();
    const handle = env.client.workflow.getHandle(candidateSaveWorkflowId(target));
    assert.deepEqual(await handle.result(), { operationId: target.operationId, inputDigest: target.inputDigest, outcome: 'unknown', revision: null });
    assert.equal(native.git.mutations(), 1); assert.equal(await state(), 'dispatch-committed');
    assert.notEqual(native.git.head(), plan.expectedHead);
    const history = await handle.fetchHistory(), text = historyText(history);
    for (const forbiddenText of ['Assessed Brief', 'Assessed Exam', 'Current corrected Brief', 'NOT RUN', 'bundleManifestDigest',
      'gate2DecisionDigest', 'synthetic-app-jwt', 'documents', 'ciphertext', 'steer-draft-envelope', 'scopeEvidence'])
      assert.equal(text.includes(forbiddenText), false);
    const scheduled = history.events?.filter(event => event.activityTaskScheduledEventAttributes) ?? [];
    assert.equal(scheduled.length, 1); assert.equal(scheduled[0]!.activityTaskScheduledEventAttributes!.retryPolicy!.maximumAttempts, 1);
    await stop(); await Worker.runReplayHistory({ workflowBundle: harness.bundle }, history, candidateSaveWorkflowId(target));
    assert.equal(native.git.mutations(), 1);

    const status = createRecordedCandidateSaveStatusReader(f.pools.drafts, binding, f.config, publication, {
      records: { ...records, verifyOriginal: verifier.verifyOriginal }, provider: {
        fetch: native.git.transport, appJwt: async () => 'synthetic-app-jwt', now: () => now, authorizeRead: async () => {},
      },
    });
    owned.push(status);
    const statusApi = createApi({ authenticate: async () => actor('intent.candidate.save.status'), services: { candidateSaveStatusReader: status } });
    const recovered = await statusApi.request('/v1/tools/intent.candidate.save.status', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(statusInput) });
    assert.equal(recovered.status, 200, await recovered.clone().text());
    const receipt = verifyCandidateSaveStatus(statusInput, await recovered.json());
    assert.equal(receipt.outcome, 'committed'); if (receipt.outcome !== 'committed') throw new Error('Expected verified receipt');
    assert.equal(receipt.saveVerified, true); assert.equal(receipt.reference.revision, native.git.head());
    assert.equal(receipt.reference.manifestDigest, plan.manifestDigest); assert.equal(receipt.confirmationDigest, plan.confirmationDigest);
    assert.equal(await state(), 'dispatch-committed', 'Read-only status cannot checkpoint or grant retry');

    const replayStore = make();
    assert.equal((await replayStore.compareAndWrite(request)).outcome, 'committed'); assert.equal(native.git.mutations(), 1);
    assert.equal((await replayStore.reconcile(request)).outcome, 'recorded'); assert.equal(await state(), 'succeeded');
    const normal = createCandidateSaveSchedulerClient(env.client, { namespace: 'default', taskQueue: queue }); owned.push(normal);
    assert.equal((await postStart(normal)).output!.receipt.outcome, 'acknowledged'); assert.equal(native.git.mutations(), 1);

    // A later root edit must not redirect exact reopen to a newer candidate.
    native.git.add([{ path: `items/${request.bundle.itemId}/BRIEF.md`, content: '# Later synthetic root, not the saved package\n' }]);
    let readAllowed = true;
    const reader = createVerifiedCandidateBundleReader(createGitHubReader(binding,
      { fetch: native.git.transport, appJwt: async () => 'synthetic-app-jwt', now: () => now }),
      { organizationId: target.organizationId, subject: f.config.subject, productId: f.config.productId,
        repository: f.config.repository, branch: f.config.branch, itemIds: publication.itemIds }, async reference => {
        assert.equal(reference.revision, receipt.reference.revision); if (!readAllowed) throw new Error('PRIVATE read revoked');
      });
    owned.push(reader);
    const readApi = createApi({ authenticate: async () => actor('intent.candidate.read'), services: { candidateBundleReader: reader } });
    const reopen = () => readApi.request('/v1/tools/intent.candidate.read', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(receipt.reference) });
    const readStart = native.git.calls.length, response = await reopen(); assert.equal(response.status, 200);
    const reopened = await verifyCandidateBundleRead(receipt.reference, await response.json());
    assert.deepEqual(reopened.documents, request.bundle.documents); assert.equal(reopened.verification, 'exact-commit-bytes');
    assert.equal(reopened.manifestContent, plan.files.find(file => file.path.endsWith('/MANIFEST.json'))!.content);
    assert.ok(native.git.calls.slice(readStart).every(call => call.path !== '/graphql' && !call.path.includes('/git/ref/heads/')));
    readAllowed = false; const denied = await reopen(); assert.equal(denied.status, 503);
    assert.doesNotMatch(await denied.text(), /PRIVATE|Assessed Brief|Current corrected Brief|MANIFEST|NOT RUN/);
    assert.deepEqual(await originals.read(target), request); assert.deepEqual(await snapshot(), before);
    assert.deepEqual((await admin.query('SELECT * FROM steer_drafts.candidate_originals WHERE organization_id=$1', [target.organizationId])).rows, encrypted);
    assert.equal(native.git.mutations(), 1); assert.equal(starts, 1);
    console.log('PASS joined native-corpus/recorded-SDK original: explicit HTTP start, lost scheduler/Git acknowledgements, one Temporal activity and native save, read-only receipt recovery, separate checkpoint, replay without resend, exact older-commit HTTP reopen and read denial');
    return { input: statusInput, receipt };
  } finally {
    try { await stop(); } finally { for (const item of owned.reverse()) item.close(); await harness?.close(); }
  }
}
