import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { Client } from '@temporalio/client';
import { DefaultLogger, Runtime, Worker } from '@temporalio/worker';
import type { scopeDraftIntegrationFixture } from '../../../packages/data/test/scope-originals.integration.ts';
import type { nativeCandidateJourneyFixture } from '../../api/test/native-candidate-journey.fixture.ts';
import type { intentJourneyFactoryFixture } from '../../api/test/intent-journey-factory.fixture.ts';
import type { IntentJourneyFactoryDependencies } from '../../api/src/runtime.ts';
import { verifyCandidateSaveStart, type CandidateSaveScheduler } from '@steer/tool-registry/candidate-save-start-contracts';
import { verifyCandidateSaveStatus, type CandidateSaveStatusInput } from '@steer/tool-registry/candidate-save-status-contracts';
import { verifyCandidateBundleRead } from '@steer/tool-registry/candidate-bundle-read-contracts';
import { planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import { createCandidateOriginalStore } from '@steer/data/candidate-originals';
import { binding as syntheticBinding, now } from '../../../packages/adapters/test/github-brief-fixture.ts';
import { createIsolatedTemporalHarness } from './isolated-temporal-harness.ts';
import { createDurableCandidateBundleStore } from '../src/candidate-bundle-runtime.ts';
import { createCandidateSaveActivities } from '../src/candidate-save-activity.ts';
import { createCandidateSaveWorker } from '../src/worker.ts';
import { createCandidateSaveSchedulerClient } from '../src/client.ts';
import { candidateSaveWorkflowId, parseCandidateSaveTarget } from '../src/candidate-save-contracts.ts';
import type { AuthenticatedJourneyDirection } from '../../api/test/authenticated-journey-direction.fixture.ts';

type Fixture = Awaited<ReturnType<typeof scopeDraftIntegrationFixture>>;
const historyText = (value: unknown): string => value instanceof Uint8Array ? Buffer.from(value).toString('utf8')
  : value && typeof value === 'object' ? Object.values(value).map(historyText).join('\n') : typeof value === 'string' ? value : '';

/** Continue one exact confirmed original through the ACTUAL authenticated factory
 * services. Only provider/authority ports are synthetic. No createApi principal
 * injection, substituted journey services, real credential or external Git write.
 */
export function authenticatedCandidateSave(f: Fixture, native: ReturnType<typeof nativeCandidateJourneyFixture>,
  config: ReturnType<typeof intentJourneyFactoryFixture>['config'], authority: () => Promise<void>, direction: AuthenticatedJourneyDirection = 'new-distinct') {
  const binding = { ...syntheticBinding, organizationId: f.config.organizationId, branch: f.config.branch };
  const publication = config.publication, execution = config.candidate;
  let enabled = false, startAllowed = false, readAllowed = true, expectedRevision: string | undefined;
  let scheduler: CandidateSaveScheduler | undefined, verifier: ReturnType<typeof createDurableCandidateBundleStore> | undefined;
  const owned: Array<{ close(): void }> = [];
  const current = async () => { await authority(); if (!enabled) throw new Error('PRIVATE synthetic save policy unavailable'); };
  const records = { authorize: current, lifecycle: f.lifecycle.lifecycle, keyForDraft: f.deps.keyForDraft };
  const make = () => {
    const store = createDurableCandidateBundleStore(f.pools.execution, binding, { execution, publication }, {
      fetch: native.git.transport, appJwt: async () => 'synthetic-app-jwt', now: () => now,
      authorizeRead: current, authorizeOperation: current, authorizeReconciliation: current,
      evaluateDispatch: async p => {
        await current(); native.git.recordSyntheticApproval(); // Disposable native fixture only; never a real gate/grant.
        return { kind: 'steer-candidate-bundle-dispatch-proof/v1', operationId: p.request.bundle.operationId,
          inputDigest: p.plan.inputDigest, currentBinding: p.request.confirmation, authorizationRevision: p.plan.expectedHead,
          sourceReviewRevision: p.plan.expectedHead, lifecycleRevision: p.plan.expectedHead, lifecycle: p.plan.requiredLifecycle,
          platformRevision: publication.platformRevision, gate2DecisionDigest: publication.gate2DecisionDigest,
          evaluatedAt: now.toISOString(), validThrough: new Date(now.getTime() + 5000).toISOString() };
      },
    }); owned.push(store); return store;
  };
  const verifyOriginal: NonNullable<IntentJourneyFactoryDependencies['candidate']['status']['records']['verifyOriginal']> = async input => {
    await current(); if (!verifier) throw new Error('PRIVATE original verifier unavailable'); await verifier.verifyOriginal(input);
  };
  return {
    configure(deps: IntentJourneyFactoryDependencies) {
      deps.candidate.start = { records, authorizeOperation: current,
        authorizeStart: async () => { await current(); if (!startAllowed) throw new Error('PRIVATE start denied'); },
        scheduler: { start: async (input, revalidate) => { await current(); if (!scheduler) throw new Error('PRIVATE scheduler unavailable'); return scheduler.start(input, revalidate); } } };
      deps.candidate.status = { records: { ...records, verifyOriginal },
        provider: { fetch: native.git.transport, appJwt: async () => 'synthetic-app-jwt', now: () => now, authorizeRead: current } };
      deps.candidate.authorizeRead = async reference => {
        await current(); if (!readAllowed) throw new Error('PRIVATE exact-read denied');
        if (expectedRevision) assert.equal(reference.revision, expectedRevision);
      };
    },
    async run(input: { admin: Pool; reference: CandidateSaveStatusInput; documents: { brief: string; spec: string; exam: string };
      post(name: string, body: unknown): Promise<Response>; read(name: string, body: unknown): Promise<unknown>;
      restart(): Promise<void>; revokeReadGrant(): void }) {
      const { admin, post, read, reference } = input;
      const target = parseCandidateSaveTarget({ organizationId: reference.organizationId, operationId: reference.operationId, inputDigest: reference.inputDigest });
      const snapshot = async () => (await admin.query(`SELECT
        (SELECT count(*) FROM steer_execution.intent_operations WHERE organization_id=$1) AS operations,
        (SELECT count(*) FROM steer_drafts.candidate_originals WHERE organization_id=$1) AS originals,
        (SELECT count(*) FROM steer_usage.model_reservations WHERE organization_id=$1) AS reservations`, [f.config.organizationId])).rows[0];
      const step = async () => (await admin.query("SELECT record->>'state' AS state FROM steer_execution.intent_steps WHERE organization_id=$1 AND operation_id=$2",
        [target.organizationId, target.operationId])).rows[0]?.state;
      const rows = async () => (await admin.query('SELECT * FROM steer_drafts.candidate_originals WHERE organization_id=$1', [target.organizationId])).rows;
      let worker: Worker | undefined, running: Promise<void> | undefined;
      let harness: Awaited<ReturnType<typeof createIsolatedTemporalHarness>> | undefined;
      const stop = async () => { if (worker) { worker.shutdown(); await running; worker = undefined; running = undefined; } };
      enabled = true;
      try {
        verifier = make();
        const originals = createCandidateOriginalStore(f.pools.drafts, f.config, { ...records, verifyOriginal }); owned.push(originals);
        const request = await originals.read(target), plan = await planCandidateBundle(request.bundle, request.confirmation);
        assert.deepEqual(request.bundle.documents, input.documents); assert.equal(plan.inputDigest, target.inputDigest);
        const isAmendment = direction === 'first-amendment' || direction === 'proposal-continuation';
        assert.equal(request.bundle.purpose, isAmendment ? 'amendment' : direction === 'candidate-revision' ? 'candidate-revision' : 'new-candidate');
        assert.equal(plan.files.length, isAmendment ? 6 : 7); assert.equal(plan.expectedHead, native.git.head());
        const root = `items/${request.bundle.itemId}`, sourceReader = native.reader(f.config.organizationId);
        const priorFiles = direction === 'candidate-revision' ? (await sourceReader.readDirectoryInventory(root, plan.expectedHead)).entries.filter(entry => entry.type === 'blob') : [];
        const priorPointer = direction === 'candidate-revision' ? JSON.parse((await sourceReader.readArtifact(`${root}/CANDIDATE.json`, plan.expectedHead)).content) : null;
        const linkedBefore = direction === 'new-linked' ? (await sourceReader.readDirectoryInventory('items/0002-existing', plan.expectedHead)).entries : null;
        const amendmentBefore = direction === 'first-amendment' ? (await sourceReader.readDirectoryInventory(root, plan.expectedHead)).entries : null;
        const continuationBefore = direction === 'proposal-continuation' ? (await sourceReader.readDirectoryInventory(root, plan.expectedHead)).entries : null;
        const proposalPath = `${root}/proposals/${native.proposalId}.json`;
        const priorProposal = continuationBefore ? await sourceReader.readArtifact(proposalPath, plan.expectedHead) : null;
        if (continuationBefore && priorProposal) {
          const pointer = JSON.parse(priorProposal.content), parents = native.parents();
          assert.equal(request.bundle.itemId, '0001-existing'); assert.equal(request.bundle.relationship, null);
          assert.equal(request.bundle.previousBundleDigest, parents.proposalManifest);
          assert.equal(pointer.manifestDigest, parents.proposalManifest); assert.equal(priorProposal.contentDigest, parents.pointerDigest);
          assert.deepEqual(request.bundle.amendment, { proposalId: native.proposalId,
            target: { itemId: request.bundle.itemId, revision: parents.originalTarget }, parentProposalDigest: parents.pointerDigest });
          assert.deepEqual(pointer.proposalTarget, request.bundle.amendment!.target); assert.equal(pointer.parentProposalDigest, null);
          assert.notEqual(parents.originalTarget, plan.expectedHead); assert.notEqual(pointer.bundleId, request.bundle.bundleId);
          assert.equal(plan.requiredLifecycle, 'existing-target-proposal-only');
          assert.equal(plan.requiredPreviousBundleDigest, parents.proposalManifest); assert.equal(plan.requiredParentProposalDigest, parents.pointerDigest);
          assert.deepEqual(plan.files.filter(file => file.mode === 'compare-and-swap').map(file => file.path), [proposalPath]);
          assert.ok(plan.files.filter(file => file.path !== proposalPath).every(file => file.mode === 'create'));
          assert.deepEqual(plan.files.map(file => file.path).sort(), [
            ...['BRIEF.md', 'SPEC.md', 'EXAM.md', 'MANIFEST.json'].map(name => `${root}/candidates/${request.bundle.bundleId}/${name}`),
            proposalPath, `.steer/authoring/bundle-operations/${target.operationId}.json`,
          ].sort());
          for (const name of ['BRIEF.md', 'SPEC.md', 'EXAM.md', '.notes/preserved.md'])
            assert.ok(continuationBefore.some(entry => entry.path === `${root}/${name}` && entry.type === 'blob' && entry.mode === '100644'));
          for (const entry of continuationBefore.filter(entry => entry.path !== proposalPath))
            assert.equal(plan.files.some(file => file.path === entry.path), false, `Never replace prior source: ${entry.path}`);
        }
        if (amendmentBefore) {
          assert.equal(request.bundle.itemId, '0003-existing'); assert.equal(request.bundle.relationship, null);
          assert.equal(request.bundle.previousBundleDigest, null); assert.equal(request.bundle.amendment!.parentProposalDigest, null);
          assert.deepEqual(request.bundle.amendment!.target, { itemId: request.bundle.itemId, revision: plan.expectedHead });
          for (const name of ['BRIEF.md', 'SPEC.md', 'EXAM.md', '.notes/preserved.md'])
            assert.ok(amendmentBefore.some(entry => entry.path === `${root}/${name}` && entry.type === 'blob' && entry.mode === '100644'));
          const plannedPaths = new Set(plan.files.map(file => file.path));
          for (const entry of amendmentBefore) assert.equal(plannedPaths.has(entry.path), false, `Never overwrite existing source: ${entry.path}`);
          assert.equal(plan.requiredLifecycle, 'existing-target-proposal-only'); assert.ok(plan.files.every(file => file.mode === 'create'));
          assert.deepEqual([...plannedPaths].sort(), [
            ...['BRIEF.md', 'SPEC.md', 'EXAM.md', 'MANIFEST.json'].map(name => `${root}/candidates/${request.bundle.bundleId}/${name}`),
            `${root}/proposals/${request.bundle.amendment!.proposalId}.json`, `.steer/authoring/bundle-operations/${target.operationId}.json`,
          ].sort());
        }
        if (linkedBefore) {
          assert.ok(linkedBefore.length > 0); assert.equal(request.bundle.itemId, '0281-linked');
          assert.deepEqual(request.bundle.relationship, { itemId: '0002-existing', revision: plan.expectedHead });
          assert.equal(request.bundle.previousBundleDigest, null); assert.equal(request.bundle.amendment, null);
          assert.equal(plan.requiredLifecycle, 'absent-item'); assert.ok(plan.files.every(file => file.mode === 'create'));
          assert.ok(plan.files.every(file => file.path.startsWith(`${root}/`) || file.path === `.steer/authoring/bundle-operations/${target.operationId}.json`));
          assert.ok(plan.files.every(file => file.path !== `${root}/SPEC.md` && file.path !== `${root}/EXAM.md`));
        }
        if (priorPointer) {
          assert.equal(request.bundle.previousBundleDigest, native.parents().priorManifest); assert.equal(priorPointer.manifestDigest, request.bundle.previousBundleDigest);
          assert.notEqual(priorPointer.bundleId, request.bundle.bundleId);
          assert.deepEqual(plan.files.filter(file => file.mode === 'compare-and-swap').map(file => file.path).sort(), [`${root}/BRIEF.md`, `${root}/CANDIDATE.json`]);
          assert.ok(plan.files.every(file => file.path !== `${root}/SPEC.md` && file.path !== `${root}/EXAM.md`));
        }
        const before = await snapshot(), encrypted = await rows();
        assert.equal(before.operations, '2'); assert.equal(before.originals, '1'); assert.equal(before.reservations, '6');
        assert.equal(await step(), undefined); assert.equal(native.git.mutations(), 0);
        const start = { ...reference, save: true as const };
        const denied = await post('intent.candidate.save.start', start); assert.equal(denied.status, 503);
        assert.doesNotMatch(await denied.text(), /PRIVATE|documents|ciphertext|Synthetic generated|Human correction/);
        assert.deepEqual(await snapshot(), before); assert.equal(await step(), undefined); assert.equal(native.git.mutations(), 0);
        startAllowed = true;
        Runtime.install({ logger: new DefaultLogger('ERROR') }); harness = await createIsolatedTemporalHarness();
        const env = harness.environment, queue = `steer-authenticated-save-${randomUUID()}`; let starts = 0;
        const lostClient = new Proxy(env.client, { get(object, key) {
          if (key === 'workflow') return new Proxy(object.workflow, { get(workflow, method) {
            if (method === 'start') return async (...args: Parameters<typeof workflow.start>) => {
              starts++; await workflow.start(...args); throw new Error('PRIVATE lost scheduler acknowledgement');
            };
            const value = Reflect.get(workflow, method); return typeof value === 'function' ? value.bind(workflow) : value;
          } });
          const value = Reflect.get(object, key); return typeof value === 'function' ? value.bind(object) : value;
        } }) as Client;
        const client = createCandidateSaveSchedulerClient(lostClient, { namespace: 'default', taskQueue: queue });
        owned.push(client); scheduler = client;
        const first = verifyCandidateSaveStart(start, await read('intent.candidate.save.start', start)); assert.equal(first.receipt.outcome, 'unknown');
        const again = verifyCandidateSaveStart(start, await read('intent.candidate.save.start', start)); assert.equal(again.receipt.outcome, 'acknowledged');
        assert.equal(again.savedToGit, false); assert.equal(starts, 1); assert.equal(native.git.mutations(), 0); assert.equal(await step(), undefined);
        const activities = createCandidateSaveActivities(target, { store: make(), authorize: current, loadOriginal: ref => originals.read(ref) });
        owned.push(activities); native.git.loseAck();
        worker = await createCandidateSaveWorker({ connection: env.nativeConnection, namespace: 'default', taskQueue: queue, workflowBundle: harness.bundle }, activities);
        running = worker.run(); const handle = env.client.workflow.getHandle(candidateSaveWorkflowId(target));
        assert.deepEqual(await handle.result(), { operationId: target.operationId, inputDigest: target.inputDigest, outcome: 'unknown', revision: null });
        assert.equal(native.git.mutations(), 1); assert.equal(await step(), 'dispatch-committed');
        const history = await handle.fetchHistory(), text = historyText(history);
        for (const secret of ['Synthetic generated', 'Human correction', 'Booking فارسی', 'documents', 'ciphertext', 'synthetic-app-jwt', 'gate2DecisionDigest', 'bundleManifestDigest'])
          assert.equal(text.includes(secret), false);
        const scheduled = history.events?.filter(event => event.activityTaskScheduledEventAttributes) ?? [];
        assert.equal(scheduled.length, 1); assert.equal(scheduled[0]!.activityTaskScheduledEventAttributes!.retryPolicy!.maximumAttempts, 1);
        await stop(); await Worker.runReplayHistory({ workflowBundle: harness.bundle }, history, candidateSaveWorkflowId(target));
        assert.equal(native.git.mutations(), 1);

        // Recreate the actual identity/factory, not just a status service or actor.
        await input.restart();
        const receipt = verifyCandidateSaveStatus(reference, await read('intent.candidate.save.status', reference));
        assert.equal(receipt.outcome, 'committed'); if (receipt.outcome !== 'committed') throw new Error('Expected verified receipt');
        assert.equal(receipt.saveVerified, true); assert.equal(receipt.reference.revision, native.git.head());
        assert.equal(receipt.reference.manifestDigest, plan.manifestDigest); assert.equal(receipt.confirmationDigest, plan.confirmationDigest);
        if (continuationBefore && priorProposal) {
          const after = (await sourceReader.readDirectoryInventory(root, receipt.reference.revision)).entries;
          for (const entry of continuationBefore.filter(entry => entry.type === 'blob' && entry.path !== proposalPath))
            assert.deepEqual(after.find(file => file.path === entry.path), entry, `Preserve canonical and prior proposal bytes: ${entry.path}`);
          const oldPaths = new Set(continuationBefore.map(entry => entry.path));
          assert.deepEqual(after.filter(entry => entry.type === 'blob' && !oldPaths.has(entry.path)).map(entry => entry.path).sort(),
            plan.files.filter(file => file.mode === 'create' && file.path.startsWith(`${root}/`)).map(file => file.path).sort());
          assert.equal(after.some(entry => entry.path === `${root}/CANDIDATE.json`), continuationBefore.some(entry => entry.path === `${root}/CANDIDATE.json`));
          const file = await sourceReader.readArtifact(proposalPath, receipt.reference.revision), pointer = JSON.parse(file.content);
          assert.equal(file.contentDigest, plan.pointerDigest); assert.notEqual(file.contentDigest, priorProposal.contentDigest);
          assert.equal(pointer.bundleId, request.bundle.bundleId); assert.equal(pointer.manifestDigest, plan.manifestDigest);
          assert.deepEqual(pointer.proposalTarget, request.bundle.amendment!.target); assert.equal(pointer.parentProposalDigest, priorProposal.contentDigest);
          assert.notEqual(pointer.proposalTarget.revision, receipt.reference.revision);
          const oldPointer = JSON.parse(priorProposal.content), oldReference = { ...receipt.reference, revision: plan.expectedHead,
            bundleId: oldPointer.bundleId, manifestDigest: oldPointer.manifestDigest };
          const previous = await verifyCandidateBundleRead(oldReference, await read('intent.candidate.read', oldReference));
          assert.equal(previous.verification, 'exact-commit-bytes'); assert.equal(previous.manifest.purpose, 'amendment');
          assert.deepEqual(previous.manifest.target, request.bundle.amendment!.target); assert.equal(previous.manifest.previousBundleDigest, null);
          assert.notDeepEqual(previous.documents, input.documents);
        }
        if (amendmentBefore) {
          const after = (await sourceReader.readDirectoryInventory(root, receipt.reference.revision)).entries;
          const priorBlobs = amendmentBefore.filter(entry => entry.type === 'blob');
          for (const entry of priorBlobs) assert.deepEqual(after.find(file => file.path === entry.path), entry, `Preserve canonical source: ${entry.path}`);
          const priorPaths = new Set(amendmentBefore.map(entry => entry.path));
          assert.deepEqual(after.filter(entry => entry.type === 'blob' && !priorPaths.has(entry.path)).map(entry => entry.path).sort(),
            plan.files.filter(file => file.path.startsWith(`${root}/`)).map(file => file.path).sort());
          assert.equal(after.some(entry => entry.path === `${root}/CANDIDATE.json`), amendmentBefore.some(entry => entry.path === `${root}/CANDIDATE.json`));
          const pointer = JSON.parse((await sourceReader.readArtifact(`${root}/proposals/${request.bundle.amendment!.proposalId}.json`, receipt.reference.revision)).content);
          assert.equal(pointer.bundleId, request.bundle.bundleId); assert.equal(pointer.manifestDigest, plan.manifestDigest);
          assert.deepEqual(pointer.proposalTarget, request.bundle.amendment!.target); assert.equal(pointer.parentProposalDigest, null);
          assert.notEqual(pointer.proposalTarget.revision, receipt.reference.revision);
        }
        if (linkedBefore) {
          assert.deepEqual((await sourceReader.readDirectoryInventory('items/0002-existing', receipt.reference.revision)).entries, linkedBefore,
            'Creating linked work must leave every linked source file and prior bundle unchanged.');
          assert.notEqual(request.bundle.relationship!.revision, receipt.reference.revision, 'The relationship stays at the reviewed source commit.');
        }
        if (priorPointer) {
          const after = (await sourceReader.readDirectoryInventory(root, receipt.reference.revision)).entries, changed = new Set(plan.files.map(file => file.path));
          for (const file of priorFiles.filter(file => !changed.has(file.path)))
            assert.deepEqual(after.find(entry => entry.path === file.path), file, `Preserve existing source: ${file.path}`);
          assert.equal(after.some(entry => entry.path === `${root}/EXAM.md`), priorFiles.some(entry => entry.path === `${root}/EXAM.md`));
          const pointer = JSON.parse((await sourceReader.readArtifact(`${root}/CANDIDATE.json`, receipt.reference.revision)).content);
          assert.equal(pointer.bundleId, request.bundle.bundleId); assert.equal(pointer.manifestDigest, plan.manifestDigest);
          assert.equal((await sourceReader.readArtifact(`${root}/BRIEF.md`, receipt.reference.revision)).content, input.documents.brief);
          const previous = await verifyCandidateBundleRead({ ...receipt.reference, bundleId: priorPointer.bundleId, manifestDigest: priorPointer.manifestDigest },
            await read('intent.candidate.read', { ...receipt.reference, bundleId: priorPointer.bundleId, manifestDigest: priorPointer.manifestDigest }));
          assert.equal(previous.reference.manifestDigest, priorPointer.manifestDigest); assert.equal(previous.manifest.purpose, 'new-candidate');
          assert.notDeepEqual(previous.documents, input.documents);
        }
        assert.equal(await step(), 'dispatch-committed', 'HTTP status is read-only and cannot checkpoint or retry');
        const reconciler = make(); assert.equal((await reconciler.compareAndWrite(request)).outcome, 'committed');
        assert.equal((await reconciler.reconcile(request)).outcome, 'recorded'); assert.equal(await step(), 'succeeded');
        assert.equal((verifyCandidateSaveStart(start, await read('intent.candidate.save.start', start))).receipt.outcome, 'acknowledged');
        assert.equal(starts, 1); assert.equal(native.git.mutations(), 1);

        expectedRevision = receipt.reference.revision;
        native.git.add([{ path: `items/${request.bundle.itemId}/BRIEF.md`, content: '# Later synthetic root, not the confirmed package\n' }]);
        const reopened = await verifyCandidateBundleRead(receipt.reference, await read('intent.candidate.read', receipt.reference));
        assert.equal(reopened.verification, 'exact-commit-bytes'); assert.deepEqual(reopened.documents, input.documents);
        assert.equal(reopened.manifestContent, plan.files.find(file => file.path.endsWith('/MANIFEST.json'))!.content);
        if (continuationBefore && priorProposal) {
          assert.equal(reopened.manifest.purpose, 'amendment'); assert.equal(reopened.manifest.relationship, null);
          assert.equal(reopened.manifest.previousBundleDigest, JSON.parse(priorProposal.content).manifestDigest);
          assert.deepEqual(reopened.manifest.target, request.bundle.amendment!.target);
          assert.equal(reopened.manifest.target!.revision, native.parents().originalTarget);
          assert.notEqual(reopened.manifest.target!.revision, plan.expectedHead);
          assert.doesNotMatch(reopened.documents.exam, /EXAM-MARKER-NOT-FOR-SCOPE/);
        }
        if (amendmentBefore) {
          assert.equal(reopened.manifest.purpose, 'amendment'); assert.equal(reopened.manifest.previousBundleDigest, null);
          assert.equal(reopened.manifest.relationship, null); assert.deepEqual(reopened.manifest.target, request.bundle.amendment!.target);
          assert.equal(reopened.manifest.target!.revision, plan.expectedHead);
          assert.doesNotMatch(reopened.documents.exam, /EXAM-MARKER-NOT-FOR-SCOPE/);
        }
        if (linkedBefore) {
          assert.deepEqual(reopened.manifest.relationship, request.bundle.relationship);
          assert.equal(reopened.manifest.relationship!.revision, plan.expectedHead);
          assert.equal(reopened.manifest.target, null); assert.equal(reopened.manifest.previousBundleDigest, null);
          assert.equal(reopened.manifest.purpose, 'new-candidate');
        }
        readAllowed = false;
        const refused = await post('intent.candidate.read', receipt.reference); assert.equal(refused.status, 503);
        assert.doesNotMatch(await refused.text(), /PRIVATE|Synthetic generated|Human correction|MANIFEST/); readAllowed = true;
        input.revokeReadGrant(); assert.equal((await post('intent.candidate.read', receipt.reference)).status, 403);
        assert.deepEqual(await rows(), encrypted); assert.deepEqual(await snapshot(), before); assert.deepEqual(await originals.read(target), request);
        assert.equal(native.git.mutations(), 1); assert.equal(starts, 1);
        console.log(`PASS authenticated factory ${direction} confirmed save: denied start, lost scheduler acknowledgement, one fixed Temporal activity/native commit, replay without resend, identity/factory restart, read-only HTTP receipt recovery, separate reconciliation, exact older-commit reopen and current policy/Git-grant denial; prior bundle and unrelated source preservation checked for revisions; no added originals or model reservations`);
      } finally {
        try { await stop(); } finally { for (const item of owned.reverse()) item.close(); await harness?.close(); enabled = false; scheduler = undefined; verifier = undefined; }
      }
    },
  };
}
