import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createLifecycleGraphVerifier, createCurrentLifecycleGraphVerifier, lifecycleBoundary, policyDigest } from '../intent/0061/lifecycle-graph.candidate.mjs';
import { humanAuthorityBindingDigest } from '../intent/0058/human-authority.candidate.mjs';
import { manifestBytes, manifestDigest } from '../intent/0060/protected-actions.candidate.mjs';
import { exactInstant, formatExactInstant } from '../intent/0069/exact-time.candidate.mjs';
import { policyDigest as preterminalPolicy } from '../intent/0073/raw-preterminal.candidate.mjs';
import { policyDigest as rawBatchPolicy } from '../intent/0074/raw-batch.candidate.mjs';
import { policyDigest as checkpointPolicy } from '../intent/0075/raw-checkpoint.candidate.mjs';
import { policyDigest as chainPolicy } from '../intent/0076/raw-checkpoint-chain.candidate.mjs';
import { createRawTerminalVerifier, policyDigest as terminalPolicy } from '../intent/0077/raw-terminal.candidate.mjs';
import { policyDigest as historicalPolicy } from '../intent/0078/historical-events.candidate.mjs';
import { createMixedHistoryVerifier } from '../intent/0081/mixed-history.candidate.mjs';
import { createQualifiedHistoryVerifier } from '../intent/0083/qualified-history.candidate.mjs';
import { createArchivedOwnerVerifier, policyDigest as archivedOwnerPolicy } from '../intent/0084/archived-owner.candidate.mjs';
import { manifestBytes as referenceActionManifestBytes, manifestDigest as referenceActionManifestDigest } from '../intent/0088/reference-actions.candidate.mjs';
import { createReferenceLifecycleVerifier } from '../intent/0089/reference-lifecycle.candidate.mjs';
import { revocationFixture } from './fixtures/reference-evidence.mjs';
import { makeHumanAuthorityBundle, makeLifecycleEventBytes, makeLifecycleGraph } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { lifecycleGraphDecision as frozen } from '../intent/0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { jcs, sha256, TRUST_REGISTRY, TARGET_REVISION, TARGET_EXAM_SHA, AUTHORIZATION_POLICY_PATH, AUTHORIZATION_POLICY_SHA, AUTHORIZATION_POLICY_BYTES, RETENTION_POLICY_SHA, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const epoch = Date.parse('2026-09-04T12:00:00Z');
const at = (seconds) => new Date(epoch + seconds * 1000).toISOString().replace('.000Z', 'Z');
const evaluation = at(50), until = at(150);
function terminalFixture(options = {}) {
  const value = fixture({ recordClass: 'RC-CORPUS-RAW-WORKING', checkpoints: [['copy-1']], ...options.graphOptions });
  const graph = value.graph, batch = JSON.parse(graph.rawBatchBytes), priorHead = JSON.parse(batch.headBytes), prior = JSON.parse(batch.reservationBytes);
  const original = value.verifier.verify(value.bytes, value.evaluationTime);
  assert.equal(original.state, 'validated-lifecycle-candidate');
  const edit = (name, record) => { options.edits?.[name]?.(record); return record; };
  const common = { source: 'authoritative-raw-terminal-store', configDigest: sha256(value.configBytes), recordedAt: at(51), validThrough: until };
  const completion = seal(edit('completion', { ...common, kind: 'raw-terminal-completion', policyDigest: terminalPolicy, observedAt: value.evaluationTime,
    graphDigest: sha256(value.bytes), evidenceDigest: original.evidenceDigest, consumptionKey: prior.consumptionKey, grantDigest: original.rawGrantDigest,
    planDigest: original.rawBatchPlanDigest, checkpointChainDigest: original.rawCheckpointChainDigest, aggregateDigest: JSON.parse(graph.aggregateBytes).recordDigest,
    tombstoneReceiptDigest: JSON.parse(graph.tombstone.receiptBytes).recordDigest, previousReservationDigest: prior.recordDigest }), 'authority');
  function store(label, terminal = null) {
    const base = { ...common, recordedAt: at(terminal ? 60 : 52), completionDigest: completion.recordDigest, consumptionKey: completion.consumptionKey };
    const head = seal(edit(`${label}-head`, { ...base, kind: 'raw-terminal-head', headId: priorHead.headId, head: sha256('terminal-head'), previousHead: priorHead.head, sequence: priorHead.sequence + 1 }), 'cas-authority');
    const replay = seal(edit(`${label}-replay`, { ...base, kind: 'raw-terminal-replay', headDigest: head.recordDigest, status: 'committed', resultDigest: completion.recordDigest }), 'replay-authority');
    const reservation = seal(edit(`${label}-reservation`, { ...base, kind: 'raw-terminal-reservation', headDigest: head.recordDigest, replayDigest: replay.recordDigest,
      previousReservationDigest: terminal?.reservation.recordDigest ?? prior.recordDigest, status: terminal ? 'already-committed' : 'committed', winner: !terminal }), 'cas-authority');
    const envelope = edit(`${label}-store`, { headBytes: jcs(head), replayBytes: jcs(replay), reservationBytes: jcs(reservation) });
    return { bytes: jcs(envelope), reservation };
  }
  const terminal = store('terminal'), current = store('current', terminal);
  const envelope = edit('envelope', { version: 'steer-raw-terminal/v1', policyDigest: terminalPolicy, graphBytes: value.bytes, observedAt: value.evaluationTime,
    completionBytes: jcs(completion), terminalStoreBytes: terminal.bytes, currentStoreBytes: current.bytes });
  return { ...value, envelope, terminalBytes: jcs(envelope), terminalVerifier: createRawTerminalVerifier(value.configBytes) };
}
function terminalDenied(value, now = at(70)) {
  const result = value.terminalVerifier.verify(value.terminalBytes, now);
  assert.equal(result.state, 'blocked'); assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
}
const keys = new Map();
function seal(input, domain) {
  if (!keys.has(domain)) keys.set(domain, createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), createHash('sha256').update(`steer-r3-r1-${domain}`).digest()]), format: 'der', type: 'pkcs8' }));
  const payload = Object.fromEntries(Object.entries(input).filter(([key]) => !['recordDigest', 'signature'].includes(key))), digest = sha256(jcs(payload));
  return { ...payload, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-v1`, signedDigest: digest, valueBase64: sign(null, Buffer.from(digest), keys.get(domain)).toString('base64') } };
}
const originalSeal = seal;
const runtimeKeys = new Map();
function runtimeKey(domain) {
  if (!runtimeKeys.has(domain)) runtimeKeys.set(domain, createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'),
    createHash('sha256').update(`steer-0080-${domain}`).digest()]), format: 'der', type: 'pkcs8' }));
  return runtimeKeys.get(domain);
}
function runtimeSeal(input, domain) {
  const payload = Object.fromEntries(Object.entries(input).filter(([key]) => !['recordDigest', 'signature'].includes(key))), digest = sha256(jcs(payload));
  return { ...payload, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-current`, signedDigest: digest,
    valueBase64: sign(null, Buffer.from(digest), runtimeKey(domain)).toString('base64') } };
}
const scope = { organization: 'steer-platform', tenant: 'steer-platform', repositoryId: 'steer-platform', installationId: 'fixture-installation', item: '0001-flight-deck-foundation' };
const target = { examRevision: TARGET_REVISION, examDigest: TARGET_EXAM_SHA, implementationRevision: 'e'.repeat(40), authorizationPolicyPath: AUTHORIZATION_POLICY_PATH,
  authorizationPolicyRevision: TARGET_REVISION, authorizationPolicyDigest: AUTHORIZATION_POLICY_SHA, authorizationPolicyBytes: AUTHORIZATION_POLICY_BYTES };

// All keys and signing helpers are synthetic and private to this test file.
function fixture(options = {}) {
  const currentEpoch = options.runtimeYear ? Date.parse(options.runtimeEpoch ?? `${options.runtimeYear}-09-04T12:00:00Z`) : epoch;
  const at = (seconds) => formatExactInstant(BigInt(currentEpoch) * 1000000n + BigInt(seconds) * BigInt(options.tickNanoseconds ?? 1000000000) + BigInt(options.nanoseconds ?? 0));
  const seal = options.runtimeYear ? runtimeSeal : originalSeal;
  const chained = Array.isArray(options.checkpoints), lastStep = chained ? Math.max(0, options.checkpoints.length - 1) : 0, recoveryShift = 8 * lastStep;
  const completedCopies = chained ? options.checkpoints.at(-1) ?? [] : options.continueCopies;
  const evaluatedAt = options.evaluationTime ?? at(50 + recoveryShift), until = at(options.horizon ?? 150 + recoveryShift), offset = options.offset ?? 0;
  const edits = options.edits ?? {}, edit = (key, value) => { edits[key]?.(value); return value; };
  const config = { version: 'steer-lifecycle-context/v1', implementationRevision: target.implementationRevision, repositoryId: scope.repositoryId, installationId: scope.installationId,
    recordId: 'record-1', recordClass: options.recordClass ?? 'RC-REBUILDABLE', artifactRevision: 'b'.repeat(40), environmentId: null,
    actorSubject: 'service:lifecycle-worker', upstreamSubject: 'authority:lifecycle', tombstonePath: 'intent/0001/evidence/tombstone.json', tombstoneProviderBindingId: 'fixture-provider-a-binding' };
  edit('config', config); const configBytes = jcs(config), configDigest = sha256(configBytes);
  const raw = config.recordClass === 'RC-CORPUS-RAW-WORKING';
  const continuation = raw && (chained || Array.isArray(completedCopies));
  const type = options.eventType ?? (raw ? 'corpus-sanitization-terminal' : 'record-superseded');
  const qualifiedDecisions = [], archivedDecisions = [], knownHolds = new Map(); let hadHold = false;
  const qualifiedSelector = { organization: scope.organization, itemId: scope.item, environmentId: config.environmentId,
    recordId: config.recordId, recordClass: config.recordClass, artifactRevision: config.artifactRevision };
  const qualifiedSelectorDigest = sha256(jcs(qualifiedSelector));
  function qualifiedOwner(event, index, second, bindingDigest, current = true) {
    const at = (seconds) => formatExactInstant(BigInt(current ? currentEpoch : epoch) * 1000000n + BigInt(seconds) * 1000000000n);
    const seal = current ? runtimeSeal : originalSeal, until = at(second + 150);
    const bundle = makeHumanAuthorityBundle(), id = `qualified-${index}`, prior = knownHolds.get(event.holdId);
    const emit = (field, value, domain) => { const signed = seal(edit(`${id}:${field}`, value), domain); bundle[field] = jcs(signed); return signed; };
    const identity = emit('identityEvidenceBytes', { ...JSON.parse(bundle.identityEvidenceBytes), evidenceId: `${id}-identity`, verifiedAt: at(second - 3) }, 'provider');
    const qualification = emit('qualificationEvidenceBytes', { ...JSON.parse(bundle.qualificationEvidenceBytes), evidenceId: `${id}-qualification`, validThrough: until }, 'provider');
    const assignment = emit('assignmentEvidenceBytes', { ...JSON.parse(bundle.assignmentEvidenceBytes), assignmentId: `${id}-assignment`, validThrough: until }, 'assignment');
    const inventory = emit('inventoryBytes', { inventoryId: `${id}-selector`, organization: scope.organization, tenant: scope.tenant, item: scope.item,
      items: [{ recordId: config.recordId, recordClass: config.recordClass, artifactRevision: config.artifactRevision, selectorDigest: qualifiedSelectorDigest }], capturedAt: at(second - 4) }, 'record');
    const authority = { ...JSON.parse(bundle.authorityBytes), version: 'steer-qualified-lifecycle-decision/v1', authorityType: 'qualified-lifecycle-decision',
      authorityId: id, sessionId: `${id}-session`, providerRecordId: `${id}-provider`, authenticatedAt: at(second - 3), decidedAt: at(second - 2),
      identityEvidenceDigest: identity.recordDigest, qualificationEvidenceDigest: qualification.recordDigest, qualificationValidThrough: qualification.validThrough,
      assignmentEvidenceDigest: assignment.recordDigest, assignmentValidThrough: assignment.validThrough, selectorInventoryDigest: inventory.recordDigest,
      decisionKind: event.eventType, eventId: event.eventId, eventBindingDigest: bindingDigest, previousHoldEventDigest: prior?.recordDigest ?? null,
      holdState: knownHolds.size ? 'active' : hadHold ? 'released' : 'none', conditions: [`event:${bindingDigest}`, `selector:${qualifiedSelectorDigest}`, `previous-hold:${prior?.recordDigest ?? 'none'}`],
      safeguards: ['exact-record-scope', 'independent-provider-proof', 'current-qualified-owner', 'revision-bound-decision'],
      providerTrustAnchorDigest: sha256((current ? JSON.parse(trustedRegistryBytes) : TRUST_REGISTRY).bindings.find((key) => key.keyId === (current ? 'human-provider-key-current' : 'human-provider-key-v1')).publicKeyHex),
      idempotencyKey: `${id}-idem`, casHead: sha256(`${id}-head`), validFrom: at(second - 5), expiresAt: until };
    for (const field of ['copyInventoryDigest', 'referenceState', 'allowedCopyProviders', 'sourceOriginalExcluded', 'deadlineSeconds', 'eraseMethod', 'terminalEventId']) delete authority[field];
    edit(`${id}:authority`, authority);
    const provider = emit('providerProofBytes', { ...JSON.parse(bundle.providerProofBytes), providerRecordId: authority.providerRecordId,
      authorityBindingDigest: humanAuthorityBindingDigest(authority), recordedAt: authority.decidedAt }, 'human-provider');
    const signedAuthority = emit('authorityBytes', { ...authority, providerProofDigest: provider.recordDigest }, 'authority');
    const head = emit('casHeadBytes', { ...JSON.parse(bundle.casHeadBytes), headId: `${id}-head`, head: authority.casHead, snapshotAt: at(second - 2), validThrough: until }, 'cas-authority');
    emit('replayLedgerBytes', { ...JSON.parse(bundle.replayLedgerBytes), ledgerId: `${id}-ledger`, headId: head.headId,
      idempotencyKey: `${id}-unused`, snapshotAt: at(second - 2), validThrough: until }, 'replay-authority');
    emit('casReservationBytes', { ...JSON.parse(bundle.casReservationBytes), reservationId: `${id}-reservation`, headId: head.headId, expectedHead: authority.casHead,
      idempotencyKey: authority.idempotencyKey, requestDigest: signedAuthority.recordDigest, authorityDigest: signedAuthority.recordDigest, recordedAt: at(second - 1), validThrough: until }, 'cas-authority');
    bundle.evaluationTime = current ? evaluatedAt : at(second + 10); edit(`${id}:bundle`, bundle);
    (current ? qualifiedDecisions : archivedDecisions).push({ eventId: event.eventId, humanBundleBytes: jcs(bundle) });
  }
  function event(eventType, index, second, current = false) {
    const value = { ...JSON.parse(makeLifecycleEventBytes(eventType, index)), recordId: config.recordId, recordClass: config.recordClass, artifactRevision: config.artifactRevision,
      policySha256: RETENTION_POLICY_SHA, occurredAt: options.runtimeYear && !current ? formatExactInstant(BigInt(epoch) * 1000000n + BigInt(second) * 1000000000n) : at(second), ...(eventType === 'corpus-sanitization-terminal' ? { result: 'pass', sanitizerRevision: 'sanitizer-v1', inspectionRevision: 'inspector-v1' } : {}),
      ...(eventType === 'run-terminal' ? { terminalStatus: 'failed' } : {}),
      ...(eventType === 'derived-record-deleted' ? { derivedRecordId: `derived-${String(index).padStart(3, '0')}`, derivedRecordClass: 'RC-CORPUS-DERIVED-TEXT', parentCorpusId: 'corpusId-value', parentCorpusVersion: 'corpusVersion-value' } : {}) };
    const qualified = (current ? options.qualifiedDecisions : options.archivedOwners) && ['hold-applied', 'hold-released'].includes(eventType);
    if (qualified) {
      value.actorId = 'human:records-owner'; value.actorAuthority = 'privacy-legal-records-owner';
      value[eventType === 'hold-applied' ? 'reasonAuthority' : 'releaseAuthority'] = `qualified-${index}`;
      if (eventType === 'hold-applied') value.selectorsSha256 = qualifiedSelectorDigest;
    }
    edit(`event-${index}`, value);
    const payload = Object.fromEntries(Object.entries(value).filter(([key]) => !['providerProofBytes', 'providerProofDigest', 'recordDigest', 'signature'].includes(key)));
    if (qualified) qualifiedOwner(value, index, second, sha256(jcs(payload)), current);
    const eventSeal = current ? seal : originalSeal;
    const proof = eventSeal(edit(`event-proof-${index}`, { providerRecordId: value.providerRecordId, eventId: value.eventId, eventBindingDigest: sha256(jcs(payload)), recordedAt: value.occurredAt }), 'provider');
    edit(`signed-event-proof-${index}`, proof);
    const signed = eventSeal({ ...value, providerProofBytes: jcs(proof), providerProofDigest: proof.recordDigest }, 'record');
    if (eventType === 'hold-applied') { knownHolds.set(value.holdId, signed); hadHold = true; }
    if (eventType === 'hold-released') knownHolds.delete(value.holdId);
    return jcs(signed);
  }
  const history = options.history ?? [{ type: options.historyType ?? 'record-committed', second: -10 }];
  let historyBytes = history.map((entry, index) => event(entry.type, index + 1, entry.second));
  let eventBytes = event(type, history.length + 1, 0);
  // Explicit test expectation, not a call back into the verifier's selector.
  const trigger = JSON.parse(options.triggerHistoryIndex === undefined ? eventBytes : historyBytes[options.triggerHistoryIndex]);
  let runtimeBytes, historicalEvidenceBytes, archivedOwnerBytes, referenceProof, trustedRegistryBytes = jcs(TRUST_REGISTRY);
  if (options.runtimeYear) {
    const registry = structuredClone(TRUST_REGISTRY);
    for (const key of TRUST_REGISTRY.bindings) registry.bindings.push({ ...key, keyId: `${key.domain}-key-current`,
      publicKeyHex: createPublicKey(runtimeKey(key.domain)).export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex'),
      notBefore: `${options.runtimeYear}-01-01T00:00:00Z`, notAfter: `${options.runtimeYear + 1}-01-01T00:00:00Z`, revokedAt: null });
    edit('runtime-registry', registry); trustedRegistryBytes = jcs(registry);
    const providers = JSON.parse(readFileSync(new URL('../intent/0001/reviews/domain/round-3/remediation/PROVIDER-KEY-REGISTRY.candidate.json', import.meta.url), 'utf8'));
    for (const binding of providers.bindings) {
      const key = registry.bindings.find((entry) => entry.keyId === `${binding.domain}-key-current`);
      for (const field of ['keyId', 'algorithm', 'publicKeyHex', 'notBefore', 'notAfter', 'revokedAt']) binding[field] = key[field];
    }
    edit('runtime-providers', providers);
    const allBytes = [...historyBytes, eventBytes], historyDigest = sha256(jcs(allBytes));
    const archive = edit('historical-context', { version: 'steer-historical-event-context/v1', scope: { organization: scope.organization, itemId: scope.item, environmentId: config.environmentId },
      recordId: config.recordId, recordClass: config.recordClass, artifactRevision: config.artifactRevision,
      archiveReference: { repositoryId: config.repositoryId, revision: 'd'.repeat(40), path: 'evidence/history.json' }, historyDigest,
      observedAt: '2026-09-04T12:00:50Z', currentRegistryBytes: trustedRegistryBytes });
    const archiveBytes = jcs(archive), inventory = allBytes.map((bytes) => { const event = JSON.parse(bytes), provider = JSON.parse(event.providerProofBytes); return {
      eventId: event.eventId, bytesDigest: sha256(bytes), recordDigest: event.recordDigest, providerBytesDigest: sha256(event.providerProofBytes), providerDigest: provider.recordDigest, occurredAt: event.occurredAt,
    }; });
    const common = { configDigest: sha256(archiveBytes), policyDigest: historicalPolicy, registryDigest: sha256(trustedRegistryBytes), historyDigest,
      inventoryDigest: sha256(jcs(inventory)), archiveReference: archive.archiveReference, observedAt: archive.observedAt, recordCount: allBytes.length, validThrough: until };
    const attestation = seal(edit('historical-attestation', { ...common, kind: 'historical-event-attestation', source: 'authoritative-history-revalidator',
      decision: 'historical-facts-verified', recordedAt: at(-2) }), 'authority');
    const receipt = seal(edit('historical-receipt', { ...common, kind: 'historical-event-retention', source: 'authoritative-archive-store',
      attestationDigest: attestation.recordDigest, retainedBytesDigest: historyDigest, complete: true, recordedAt: at(-1) }), 'provider');
    historicalEvidenceBytes = jcs(edit('historical-envelope', { version: 'steer-historical-events/v1', policyDigest: historicalPolicy, eventBytes, historyBytes,
      attestationBytes: jcs(attestation), retentionReceiptBytes: jcs(receipt) }));
    let archivedOwnerContextBytes;
    if (options.archivedOwners) {
      const decisions = edit('archived-decisions', archivedDecisions), decisionBytes = jcs(decisions), decisionBytesDigest = sha256(decisionBytes);
      const ownerContext = edit('archived-owner-context', { version: 'steer-archived-owner-context/v1', historicalContextDigest: sha256(archiveBytes), decisionBytesDigest,
        archiveReference: { ...archive.archiveReference, path: 'evidence/owner-decisions.json' } });
      archivedOwnerContextBytes = jcs(ownerContext);
      const recordFields = ['authorityBytes', 'providerProofBytes', 'identityEvidenceBytes', 'qualificationEvidenceBytes', 'assignmentEvidenceBytes',
        'inventoryBytes', 'replayLedgerBytes', 'casHeadBytes', 'casReservationBytes'];
      const rows = decisions.map((entry) => { const bundle = JSON.parse(entry.humanBundleBytes), event = allBytes.map(JSON.parse).find((event) => event.eventId === entry.eventId); return {
        eventId: entry.eventId, eventDigest: event?.recordDigest ?? 'f'.repeat(64), observedAt: bundle.evaluationTime, bundleBytesDigest: sha256(entry.humanBundleBytes),
        records: recordFields.map((field) => ({ field, recordDigest: JSON.parse(bundle[field] ?? '{}').recordDigest ?? 'f'.repeat(64), bytesDigest: sha256(bundle[field] ?? '{}') })),
      }; });
      const ownerCommon = { configDigest: sha256(archivedOwnerContextBytes), policyDigest: archivedOwnerPolicy, registryDigest: sha256(trustedRegistryBytes),
        historyDigest, decisionBytesDigest, inventoryDigest: sha256(jcs(rows)), archiveReference: ownerContext.archiveReference, observedAt: archive.observedAt,
        decisionCount: decisions.length, validThrough: until };
      const ownerAttestation = seal(edit('owner-attestation', { ...ownerCommon, kind: 'archived-owner-attestation', source: 'authoritative-owner-history-revalidator',
        decision: 'historical-owner-records-verified', recordedAt: at(-2) }), 'authority');
      const ownerReceipt = seal(edit('owner-retention', { ...ownerCommon, kind: 'archived-owner-retention', source: 'authoritative-archive-store',
        attestationDigest: ownerAttestation.recordDigest, retainedBytesDigest: decisionBytesDigest, complete: true, recordedAt: at(-1) }), 'provider');
      archivedOwnerBytes = jcs(edit('archived-owner-envelope', { version: 'steer-archived-owner/v1', policyDigest: archivedOwnerPolicy,
        archivedEvidenceBytes: historicalEvidenceBytes, decisionBytes, attestationBytes: jcs(ownerAttestation), retentionReceiptBytes: jcs(ownerReceipt) }));
    }
    if (options.referenceRuntime) {
      const changes = options.referenceEdits ?? {}, contentChanges = changes.content ?? {};
      referenceProof = revocationFixture({ ...changes, content: { ...contentChanges,
        manifest: (record) => { record.recordId = config.recordId; record.artifactRevision = config.artifactRevision;
          for (const reference of record.references) { reference.targetRecordId = config.recordId; reference.targetArtifactRevision = config.artifactRevision; }
          contentChanges.manifest?.(record); },
        context: (record) => { record.recordId = config.recordId; record.artifactRevision = config.artifactRevision; contentChanges.context?.(record); },
      }, context: (record) => { record.environmentId = config.environmentId; changes.context?.(record); },
      event: (record) => { record.eventId = `00000000-0000-4000-8000-${String(allBytes.length + (options.currentHistory?.length ?? 0) + 1).padStart(12, '0')}`; changes.event?.(record); },
      authority: (record) => { record.holdState = options.referenceHoldState ?? 'none'; changes.authority?.(record); },
      }, options.runtimeYear, { registry, seal: runtimeSeal, at: (second) => at(second - 30), until, evaluationTime: evaluatedAt });
    }
    runtimeBytes = jcs(edit('runtime', { version: options.referenceRuntime ? 'steer-lifecycle-runtime/v5' : options.archivedOwners ? 'steer-lifecycle-runtime/v4' : options.qualifiedDecisions ? 'steer-lifecycle-runtime/v3' : Array.isArray(options.currentHistory) ? 'steer-lifecycle-runtime/v2' : 'steer-lifecycle-runtime/v1', currentRegistryBytes: trustedRegistryBytes,
      currentProviderRegistryBytes: jcs(providers), historicalContextBytes: archiveBytes, ...(options.archivedOwners ? { archivedOwnerContextBytes } : {}),
      ...(options.referenceRuntime ? { referenceContextBytes: referenceProof.contextBytes } : {}) }));
    if (Array.isArray(options.currentHistory)) {
      const combined = [...allBytes, ...options.currentHistory.map((entry, index) => event(entry.type, allBytes.length + index + 1, entry.second, true)),
        ...(referenceProof ? [referenceProof.envelope.eventBytes] : [])];
      edit('combined-history', combined); historyBytes = combined.slice(0, -1); eventBytes = combined.at(-1);
    }
  }
  const selectedVerifier = runtimeBytes ? createCurrentLifecycleGraphVerifier(configBytes, runtimeBytes) : createLifecycleGraphVerifier(configBytes);
  const policyDigest = selectedVerifier.policyDigest;
  const copies = (raw ? ['a', 'b', 'a'] : ['a', 'b']).map((suffix, index) => ({ copyId: `copy-${index + 1}`, copyKind: raw ? 'temporary-working' : 'replica', provider: `fixture-provider-${suffix}`,
    providerBindingId: `fixture-provider-${suffix}-binding`, account: `fixture-account-${suffix}`, objectKey: `object-${index}`, versionId: options.referenceRuntime ? `v${index + 1}` : 'version-1', keyId: `key-${index}`, sourceOriginal: false,
    ...(options.referenceRuntime ? { objectSha256: sha256(index === 0 ? 'object-one' : 'object-two') } : {}) }));
  edit('copies', copies);
  const rawConfigDigest = sha256(jcs({ version: 'steer-raw-preparation-context/v1', lifecycleConfigDigest: configDigest,
    recordId: config.recordId, artifactRevision: config.artifactRevision, environmentId: config.environmentId }));
  const rawUntil = formatExactInstant(exactInstant(at(0)) + 150000000000n);
  const preparation = raw ? seal(edit('raw-preparation', { kind: 'raw-preparation', configDigest: rawConfigDigest, preparationId: 'raw-preparation-1',
    source: 'authoritative-raw-preparation', terminalEventId: trigger.eventId, copies: structuredClone(copies), complete: true,
    sanitizerRevision: trigger.sanitizerRevision, inspectorRevision: trigger.inspectionRevision, recordedAt: at(-20), validThrough: rawUntil }), 'provider') : null;
  const inventory = seal(edit('inventory', { kind: 'inventory', configDigest, inventoryId: 'inventory-1', source: 'authoritative-copy-inventory', copies, complete: true, recordedAt: at(1), validThrough: until }), options.inventoryDomain ?? 'provider');
  const provenance = config.recordClass === 'RC-CORPUS-PROVENANCE';
  const derived = provenance ? seal(edit('derived-inventory', { kind: 'derived-inventory', configDigest, source: 'authoritative-derived-record-manifest',
    manifestId: 'derived-manifest-1', corpusId: 'corpusId-value', corpusVersion: 'corpusVersion-value', complete: true,
    entries: [...historyBytes, eventBytes].map(JSON.parse).filter((event) => event.eventType === 'derived-record-deleted').map((event) => ({ derivedRecordId: event.derivedRecordId, derivedRecordClass: event.derivedRecordClass, deletionEventId: event.eventId })),
    recordedAt: at(1), validThrough: until }), options.derivedDomain ?? 'provider') : null;
  const state = seal(edit('state', { kind: 'state', configDigest, source: 'authoritative-lifecycle-store', inventoryDigest: inventory.recordDigest,
    historyDigest: sha256(jcs([...historyBytes, eventBytes])), historyComplete: true, holdState: 'none', referenceState: 'cleared',
    referenceRevocationDigest: referenceProof ? JSON.parse(referenceProof.envelope.completionBytes).recordDigest : null, parentExpiryAt: null, recordedAt: at(2), validThrough: until,
    ...(provenance ? { derivedInventoryDigest: derived.recordDigest } : {}) }), options.stateDomain ?? 'authority');
  const graph = { version: runtimeBytes ? options.referenceRuntime ? 'steer-lifecycle-graph/current-v5' : options.archivedOwners ? 'steer-lifecycle-graph/current-v4' : options.qualifiedDecisions ? 'steer-lifecycle-graph/current-v3' : Array.isArray(options.currentHistory) ? 'steer-lifecycle-graph/current-v2' : 'steer-lifecycle-graph/current-v1' : chained ? 'steer-lifecycle-graph/raw-v4' : continuation ? 'steer-lifecycle-graph/raw-v3' : raw ? 'steer-lifecycle-graph/raw-v2' : 'steer-lifecycle-graph/v1', configDigest, policyDigest, eventBytes, historyBytes, inventoryBytes: jcs(inventory), stateBytes: jcs(state), referenceRevocationBytes: referenceProof?.bytes ?? '', copies: [], aggregateBytes: '', tombstone: {},
    ...(options.archivedOwners ? { archivedOwnerBytes } : {}),
    ...(options.qualifiedDecisions ? { qualifiedDecisionBytes: jcs(edit('qualified-proofs', qualifiedDecisions)) } : {}),
    ...(runtimeBytes ? { historicalEvidenceBytes } : {}),
    ...(provenance ? { derivedInventoryBytes: jcs(derived) } : {}) };
  const tupleDigest = sha256(jcs(copies));
  function human(label, selected, conditions, method, isRaw, second) {
    const bundle = makeHumanAuthorityBundle(), prior = JSON.parse(bundle.authorityBytes);
    const humanInventory = seal({ inventoryId: `human-inventory-${label}`, organization: scope.organization, tenant: scope.tenant, item: scope.item,
      items: selected.map((copy) => ({ copyId: copy.copyId, provider: copy.provider, objectDigest: sha256(jcs(copy)) })),
      ...(isRaw ? { preparationDigest: preparation.recordDigest } : { lifecycleInventoryDigest: inventory.recordDigest }), tupleDigest, capturedAt: at(isRaw ? -19 : 2) }, 'record');
    const identity = seal({ ...JSON.parse(bundle.identityEvidenceBytes), verifiedAt: at(second - 1) }, 'provider');
    if (runtimeBytes) {
      bundle.qualificationEvidenceBytes = jcs(seal(JSON.parse(bundle.qualificationEvidenceBytes), 'provider'));
      bundle.assignmentEvidenceBytes = jcs(seal(JSON.parse(bundle.assignmentEvidenceBytes), 'assignment'));
    }
    let authority = edit(`${label}:human`, { ...prior, authorityId: `human-${label}`, authorityType: isRaw ? 'raw-policy-grant' : 'disposition-authorization',
      identityEvidenceDigest: identity.recordDigest, copyInventoryDigest: humanInventory.recordDigest, conditions, allowedCopyProviders: [...new Set(selected.map((copy) => copy.provider))].sort(),
      eraseMethod: method, terminalEventId: trigger.eventId, authenticatedAt: at(second - 1), decidedAt: at(second), idempotencyKey: `human-idem-${label}`, providerRecordId: `human-provider-${label}`,
      ...(runtimeBytes ? { qualificationEvidenceDigest: JSON.parse(bundle.qualificationEvidenceBytes).recordDigest,
        assignmentEvidenceDigest: JSON.parse(bundle.assignmentEvidenceBytes).recordDigest,
        providerTrustAnchorDigest: sha256(JSON.parse(trustedRegistryBytes).bindings.find((key) => key.keyId === 'human-provider-key-current').publicKeyHex) } : {}),
      ...(isRaw ? { validFrom: at(-15), expiresAt: rawUntil } : {}) });
    const proof = seal({ ...JSON.parse(bundle.providerProofBytes), providerRecordId: authority.providerRecordId, authorityBindingDigest: humanAuthorityBindingDigest(authority), recordedAt: authority.decidedAt }, 'human-provider');
    authority = seal({ ...authority, providerProofDigest: proof.recordDigest }, 'authority');
    const head = seal({ ...JSON.parse(bundle.casHeadBytes), headId: `human-head-${label}`, snapshotAt: at(second), validThrough: isRaw ? rawUntil : until }, 'cas-authority');
    const replay = seal({ ...JSON.parse(bundle.replayLedgerBytes), headId: head.headId, snapshotAt: at(second), validThrough: isRaw ? rawUntil : until }, 'replay-authority');
    const reservation = seal({ ...JSON.parse(bundle.casReservationBytes), idempotencyKey: authority.idempotencyKey, requestDigest: authority.recordDigest,
      authorityDigest: authority.recordDigest, headId: head.headId, reservationId: `human-reserve-${label}`, recordedAt: at(second + 1), validThrough: isRaw ? rawUntil : until }, 'cas-authority');
    Object.assign(bundle, { authorityBytes: jcs(authority), providerProofBytes: jcs(proof), identityEvidenceBytes: jcs(identity), inventoryBytes: jcs(humanInventory),
      casHeadBytes: jcs(head), replayLedgerBytes: jcs(replay), casReservationBytes: jcs(reservation), evaluationTime: evaluatedAt });
    edit(`${label}:human-bundle`, bundle);
    return { bytes: jcs(bundle), authority };
  }
  const rawFull = raw ? human('raw-policy', copies, [`raw-preparation:${preparation.recordDigest}`, `raw-context:${rawConfigDigest}`, `raw-tuples:${tupleDigest}`], 'cryptographic-erase', true, -10) : null;
  const rawGrantBindingDigest = raw ? sha256(jcs({ configDigest: rawConfigDigest, preparationDigest: preparation.recordDigest,
    authorityDigest: rawFull.authority.recordDigest, terminalEventId: trigger.eventId })) : null;
  if (raw) {
    const grant = edit('raw:grant', { version: 'steer-raw-policy-grant/v4', authority: rawFull.authority, recordClass: config.recordClass,
      sanitizerRevision: trigger.sanitizerRevision, inspectorRevision: trigger.inspectionRevision, completeInventoryRequired: true, receiptRequired: true, permittedTargetKind: 'temporary-copy-only' });
    graph.rawPolicyBytes = jcs(edit('raw-policy', { version: 'steer-raw-preterminal/v1', policyDigest: preterminalPolicy, configDigest: rawConfigDigest,
      preparationBytes: jcs(preparation), humanBundleBytes: rawFull.bytes, rawGrantBytes: jcs(grant) }));
  }
  const baseDigest = sha256(jcs({ configDigest, policyDigest, eventBytes, historyBytes, inventoryBytes: graph.inventoryBytes, stateBytes: graph.stateBytes, referenceRevocationBytes: graph.referenceRevocationBytes,
    ...(provenance ? { derivedInventoryBytes: graph.derivedInventoryBytes } : {}), ...(raw ? { rawGrantBindingDigest } : {}), ...(runtimeBytes ? { historicalEvidenceBytes } : {}),
    ...(options.qualifiedDecisions ? { qualifiedDecisionBytes: graph.qualifiedDecisionBytes } : {}), ...(options.archivedOwners ? { archivedOwnerBytes } : {}) }));
  const plannedRequests = new Map();
  function action(label, grant, authority, second) {
    const recoveringCopy = continuation && label !== 'tombstone';
    const replayed = label === 'tombstone' ? (options.tombstoneReplay ?? options.replay) : recoveringCopy ? completedCopies.includes(label) : (options.replayCopies ? options.replayCopies.includes(label) : options.replay);
    const firstCompleted = chained ? options.checkpoints.findIndex((ids) => ids.includes(label)) : -1;
    const receiptDelay = recoveringCopy ? (chained && firstCompleted >= 0 ? 4 + 8 * firstCompleted : replayed ? 4 : 11 + recoveryShift) : 4;
    const context = { version: options.referenceRuntime ? 'steer-protected-reference-context/v1' : 'steer-protected-action-context/v1',
      manifestDigest: options.referenceRuntime ? referenceActionManifestDigest : manifestDigest, trustRegistryBytes: trustedRegistryBytes, target: structuredClone(target), scope: structuredClone(scope), grants: [structuredClone(grant)] };
    edit(`${label}:context`, context);
    const contextDigest = sha256(jcs(context)), definition = JSON.parse(options.referenceRuntime ? referenceActionManifestBytes : manifestBytes).actions.find((entry) => entry.action === grant.action);
    const operation = { requestId: `request-${label}`, grantId: grant.grantId, idempotencyKey: `idem-${label}`, casHead: 'a'.repeat(64), requestedAt: at(second) };
    edit(`${label}:operation`, operation);
    const operationDigest = sha256(jcs({ contextDigest, operation })), records = {};
    const emit = (kind, values, domain, recordedAt = at(second - 4)) => records[kind] = (kind === 'resources' && options.oldProviderResources?.includes(label) ? originalSeal : seal)(edit(`${label}:${kind}`, { kind, contextDigest, operationDigest, recordedAt, validThrough: until, ...values }), domain);
    const selectorsDigest = sha256(jcs({ scope, target, grant }));
    const up = emit('upstream', { credentialId: `up-${label}`, principal: definition.upstreamPrincipal, subject: grant.upstreamSubject, provider: 'steer-identity', action: definition.upstreamAction,
      oneUse: true, lastUsedAt: at(second - 1), selectorsDigest }, 'upstream');
    const down = emit('downstream', { credentialId: `down-${label}`, principal: definition.principal, subject: grant.actorSubject, provider: grant.provider, action: grant.action,
      oneUse: true, lastUsedAt: at(second - 1), selectorsDigest }, 'downstream');
    const delegation = emit('delegation', { delegationId: `delegation-${label}`, issuerPrincipal: up.principal, issuerSubject: up.subject, recipientPrincipal: down.principal, recipientSubject: down.subject,
      upstreamDigest: up.recordDigest, downstreamDigest: down.recordDigest }, 'delegation', at(second - 3));
    const assignment = emit('assignment', { assignmentId: `assignment-${label}`, actorSubject: grant.actorSubject, actorRole: definition.role, status: 'current' }, 'assignment');
    const auth = emit('authority', { authorityId: `authority-${label}`, actorSubject: grant.actorSubject, actorRole: definition.role, action: grant.action,
      authorityEvidenceDigest: authority.recordDigest, assignmentDigest: assignment.recordDigest, decision: 'authorized' }, 'authority', at(second - 2));
    const resources = emit('resources', { snapshotId: `resources-${label}`, provider: grant.provider, resources: structuredClone(grant.resources) }, grant.resourceDomain);
    const request = emit('request', { operation, upstreamDigest: up.recordDigest, downstreamDigest: down.recordDigest, delegationDigest: delegation.recordDigest,
      assignmentDigest: assignment.recordDigest, authorityDigest: auth.recordDigest, resourcesDigest: resources.recordDigest }, 'record', at(second));
    plannedRequests.set(label, structuredClone(request));
    const receipt = (options.oldProviderReceipts?.includes(label) ? originalSeal : seal)(edit(`${label}:receipt`, { kind: 'receipt', configDigest, contextDigest, inputDigest: baseDigest, requestDigest: request.recordDigest,
      resourcesDigest: sha256(jcs(grant.resources)), authorityDigest: authority.recordDigest, action: grant.action, transactionId: `transaction-${label}`,
      effect: grant.action === 'lifecycle.crypto-erase' ? 'crypto-erased' : grant.action === 'lifecycle.commit-tombstone' ? 'tombstone-committed' : 'deleted', status: 'terminal-success', recordedAt: at(second + receiptDelay) }), grant.resourceDomain);
    const replay = emit('replay', { ledgerId: `replay-${label}`, source: 'authoritative-replay-store', requestDigest: request.recordDigest, idempotencyKey: operation.idempotencyKey,
      status: replayed ? 'committed' : 'unused', resultDigest: replayed ? receipt.recordDigest : null, headId: `head-${label}` }, 'replay-authority', at(second + (recoveringCopy ? (replayed ? 8 : 10) + recoveryShift : replayed ? 5 : 1)));
    const head = emit('head', { headId: `head-${label}`, source: 'authoritative-cas-store', requestDigest: request.recordDigest, head: operation.casHead, previousHead: '9'.repeat(64), sequence: 4 }, 'cas-authority', at(second + (recoveringCopy ? (replayed ? 8 : 10) + recoveryShift : 1)));
    emit('reservation', { reservationId: `reserve-${label}`, source: 'authoritative-cas-store', requestDigest: request.recordDigest, headId: head.headId,
      headDigest: head.recordDigest, replayDigest: replay.recordDigest, expectedHead: head.head, idempotencyKey: operation.idempotencyKey, winner: !replayed,
      status: replayed ? 'already-committed' : 'reserved' }, 'cas-authority', at(second + (recoveringCopy ? (replayed ? 9 : 10) + recoveryShift : replayed ? 6 : 2)));
    const bundle = { version: 'steer-protected-action-bundle/v1', contextDigest, ...Object.fromEntries(Object.entries(records).map(([kind, record]) => [`${kind}Bytes`, jcs(record)])) };
    edit(`${label}:action-bundle`, bundle); return { actionBundleBytes: jcs(bundle), receiptBytes: jcs(receipt) };
  }
  for (const copy of copies) {
    const conditions = [`lifecycle-inventory:${inventory.recordDigest}`, `tuple:${sha256(jcs(copy))}`, `input:${baseDigest}`];
    const full = raw ? rawFull : human(copy.copyId, [copy], conditions, 'provider-delete', false, 5 + offset);
    const resources = { objectId: config.recordId, recordClass: config.recordClass, ...Object.fromEntries(['copyId', 'copyKind', 'providerBindingId', 'account', 'objectKey', 'versionId', 'keyId'].map((key) => [key, copy[key]])), inventoryDigest: inventory.recordDigest, tupleDigest,
      ...(options.referenceRuntime ? { objectSha256: copy.objectSha256 } : {}) };
    const grant = { grantId: copy.copyId, action: raw ? 'lifecycle.crypto-erase' : 'lifecycle.delete-copy', actorSubject: config.actorSubject, upstreamSubject: config.upstreamSubject,
      provider: copy.provider, resourceDomain: copy.provider.endsWith('-b') ? 'provider-b' : 'provider-a', resources, authorityEvidenceDigest: full.authority.recordDigest, inputDigest: baseDigest };
    graph.copies.push({ copyId: copy.copyId, ...(!raw ? { humanBundleBytes: full.bytes, rawGrantBytes: '' } : {}), ...action(copy.copyId, grant, full.authority, 15 + offset) });
  }
  const aggregate = seal(edit('aggregate', { kind: 'aggregate', configDigest, inputDigest: baseDigest, inventoryDigest: inventory.recordDigest,
    receiptDigests: graph.copies.map((entry) => JSON.parse(entry.receiptBytes).recordDigest), allCopiesGone: true, recordedAt: at((continuation ? 28 + recoveryShift : 25) + offset) }), 'provider'); graph.aggregateBytes = jcs(aggregate);
  let checkpoint;
  if (raw) {
    const emit = (kind, values, second, domain) => seal(edit(`raw-batch-${kind}`, { kind: `raw-batch-${kind}`, configDigest, consumptionKey: rawGrantBindingDigest,
      ...values, recordedAt: at(second + offset), validThrough: until }), domain);
    const entries = graph.copies.map((entry) => {
      const request = plannedRequests.get(entry.copyId);
      return { copyId: entry.copyId, requestDigest: request.recordDigest, operationDigest: request.operationDigest, idempotencyKey: request.operation.idempotencyKey };
    });
    const plan = emit('plan', { source: 'authoritative-raw-batch-planner', inputDigest: baseDigest, authorityDigest: rawFull.authority.recordDigest,
      tupleDigest, terminalDigest: trigger.recordDigest, entries }, 15, 'authority');
    const openingHead = emit('opening-head', { source: 'authoritative-cas-store', planDigest: plan.recordDigest, headId: 'raw-batch-head', head: '7'.repeat(64), previousHead: '6'.repeat(64), sequence: 1 }, 16, 'cas-authority');
    const openingReplay = emit('opening-replay', { source: 'authoritative-replay-store', planDigest: plan.recordDigest, headId: openingHead.headId, status: 'unused', resultDigest: null }, 16, 'replay-authority');
    const openingReservation = emit('opening-reservation', { source: 'authoritative-cas-store', planDigest: plan.recordDigest, headId: openingHead.headId,
      headDigest: openingHead.recordDigest, replayDigest: openingReplay.recordDigest, expectedHead: openingHead.head, winner: true, status: 'reserved' }, 16, 'cas-authority');
    const opening = edit('raw-batch-opening', { headBytes: jcs(openingHead), replayBytes: jcs(openingReplay), reservationBytes: jcs(openingReservation) });
    function makeCheckpoint(ids, stepIndex = 0, previousDigest = null, priorHistory = [...historyBytes, eventBytes]) {
      const stepShift = 8 * stepIndex;
      const editCheckpoint = (name, value) => edit(chained ? `step-${stepIndex + 1}-checkpoint-${name}` : `checkpoint-${name}`, value);
      const extraHistory = chained ? options.checkpointHistoryByStep?.[stepIndex] ?? [] : options.checkpointHistory ?? [];
      const freshHistory = editCheckpoint('history', [...priorHistory, ...extraHistory.map((row, index) => event(row.type, priorHistory.length + 1 + index, row.second + offset))]);
      const freshHistoryDigest = sha256(jcs(freshHistory));
      const pending = copies.filter((copy) => !ids.includes(copy.copyId));
      const freshInventory = seal(editCheckpoint('inventory', { kind: 'raw-checkpoint-inventory', configDigest, source: 'authoritative-copy-inventory',
        inventoryId: `fresh-raw-inventory-${stepIndex + 1}`, copies: structuredClone(pending), complete: true, recordedAt: at(20 + stepShift + offset), validThrough: until }), 'provider');
      const freshState = seal(editCheckpoint('state', { kind: 'raw-checkpoint-state', configDigest, source: 'authoritative-lifecycle-store', inventoryDigest: freshInventory.recordDigest,
        historyDigest: freshHistoryDigest, historyComplete: true, holdState: 'none', referenceState: 'cleared', recordedAt: at(21 + stepShift + offset), validThrough: until }), 'authority');
      const record = seal(editCheckpoint('record', { kind: 'raw-checkpoint', configDigest, source: 'authoritative-raw-recovery', checkpointId: `checkpoint-${stepIndex + 1}`,
        sequence: stepIndex + 1, previousCheckpointDigest: previousDigest, consumptionKey: rawGrantBindingDigest, inputDigest: baseDigest, planDigest: plan.recordDigest,
        openingReservationDigest: openingReservation.recordDigest, authorityDigest: rawFull.authority.recordDigest, tupleDigest,
        completed: graph.copies.filter((copy) => ids.includes(copy.copyId)).map((copy) => ({ copyId: copy.copyId,
          requestDigest: plannedRequests.get(copy.copyId).recordDigest, receiptDigest: JSON.parse(copy.receiptBytes).recordDigest })),
        remaining: pending.map((copy) => copy.copyId), inventoryDigest: freshInventory.recordDigest, stateDigest: freshState.recordDigest, historyDigest: freshHistoryDigest,
        recordedAt: at(22 + stepShift + offset), validThrough: until }), 'authority');
      const envelopeBytes = jcs(editCheckpoint('envelope', { version: chained ? 'steer-raw-checkpoint/v2' : 'steer-raw-checkpoint/v1', policyDigest: checkpointPolicy,
        inventoryBytes: jcs(freshInventory), stateBytes: jcs(freshState), checkpointBytes: jcs(record), eventBytes: freshHistory.at(-1), historyBytes: freshHistory.slice(0, -1) }));
      return { record, envelopeBytes, history: freshHistory };
    }
    function makeBatch(stepIndex = 0, priorHead = openingHead, priorReservation = openingReservation) {
      const emitCurrent = (kind, values, second, domain) => seal(edit(chained ? `step-${stepIndex + 1}-batch-${kind}` : `raw-batch-${kind}`,
        { kind: `raw-batch-${kind}`, configDigest, consumptionKey: rawGrantBindingDigest, ...values,
          ...(chained ? { previousReservationDigest: priorReservation.recordDigest } : {}), recordedAt: at(second + 8 * stepIndex + offset), validThrough: until }), domain);
      const head = emitCurrent('head', { source: 'authoritative-cas-store', planDigest: plan.recordDigest, openingReservationDigest: openingReservation.recordDigest, headId: openingHead.headId,
        head: chained ? sha256(`checkpoint-head-${stepIndex + 1}`) : continuation || options.replay ? '8'.repeat(64) : openingHead.head,
        previousHead: chained ? priorHead.head : continuation || options.replay ? openingHead.head : openingHead.previousHead,
        sequence: chained ? priorHead.sequence + 1 : continuation || options.replay ? 2 : 1 }, continuation ? 23 : options.replay ? 26 : 16, 'cas-authority');
      const replay = emitCurrent('replay', { source: 'authoritative-replay-store', planDigest: plan.recordDigest, openingReservationDigest: openingReservation.recordDigest, headId: head.headId,
        status: continuation ? 'checkpointed' : options.replay ? 'committed' : 'unused', resultDigest: continuation ? checkpoint.recordDigest : options.replay ? aggregate.recordDigest : null }, continuation ? 23 : options.replay ? 26 : 16, 'replay-authority');
      const reservation = emitCurrent('reservation', { source: 'authoritative-cas-store', planDigest: plan.recordDigest, openingReservationDigest: openingReservation.recordDigest, headId: head.headId, headDigest: head.recordDigest,
        replayDigest: replay.recordDigest, expectedHead: head.head, winner: continuation || !options.replay, status: !continuation && options.replay ? 'already-committed' : 'reserved' }, continuation ? 24 : options.replay ? 27 : 16, 'cas-authority');
      const bytes = jcs(edit(chained ? `step-${stepIndex + 1}-batch-envelope` : 'raw-batch', { version: chained ? 'steer-raw-batch/v3' : continuation ? 'steer-raw-batch/v2' : 'steer-raw-batch/v1', policyDigest: rawBatchPolicy,
        planBytes: jcs(plan), openingBytes: jcs(opening), headBytes: jcs(head), replayBytes: jcs(replay), reservationBytes: jcs(reservation) }));
      return { bytes, head, reservation };
    }
    if (chained) {
      const steps = []; let priorHead = openingHead, priorReservation = openingReservation, priorHistory = [...historyBytes, eventBytes];
      for (const [index, ids] of options.checkpoints.entries()) {
        const next = makeCheckpoint(ids, index, checkpoint?.recordDigest ?? null, priorHistory); checkpoint = next.record;
        const batch = makeBatch(index, priorHead, priorReservation);
        steps.push({ checkpointBytes: next.envelopeBytes, batchBytes: batch.bytes });
        priorHistory = next.history; priorHead = batch.head; priorReservation = batch.reservation; graph.rawBatchBytes = batch.bytes;
      }
      graph.continuationBytes = jcs(edit('checkpoint-chain', { version: 'steer-raw-checkpoint-chain/v1', policyDigest: chainPolicy, steps }));
    } else {
      if (continuation) { const next = makeCheckpoint(completedCopies); checkpoint = next.record; graph.continuationBytes = next.envelopeBytes; }
      graph.rawBatchBytes = makeBatch().bytes;
    }
  }
  const full = human('tombstone', copies, [`lifecycle-inventory:${inventory.recordDigest}`, `aggregate:${aggregate.recordDigest}`, `input:${baseDigest}`,
    ...(referenceProof ? [`tombstone:${JSON.parse(referenceProof.contextBytes).tombstoneRecordId}`, `verification:${JSON.parse(referenceProof.source.contextBytes).verificationBundleDigest}`] : []),
    ...(continuation ? [`raw-checkpoint:${checkpoint.recordDigest}`] : []), ...(chained ? [`raw-checkpoint-chain:${sha256(graph.continuationBytes)}`] : [])], 'provider-delete', false, (continuation ? 30 + recoveryShift : 27) + offset);
  const grant = { grantId: 'tombstone', action: 'lifecycle.commit-tombstone', actorSubject: config.actorSubject, upstreamSubject: config.upstreamSubject,
    provider: 'fixture-provider-a', resourceDomain: 'provider-a', resources: { objectId: config.recordId, recordClass: config.recordClass, inventoryDigest: inventory.recordDigest,
      tupleDigest, aggregateReceiptDigest: aggregate.recordDigest, path: config.tombstonePath,
      ...(referenceProof ? { tombstoneRecordId: JSON.parse(referenceProof.contextBytes).tombstoneRecordId, verificationBundleDigest: JSON.parse(referenceProof.source.contextBytes).verificationBundleDigest } : {}) },
    authorityEvidenceDigest: full.authority.recordDigest, inputDigest: baseDigest };
  graph.tombstone = { humanBundleBytes: full.bytes, ...action('tombstone', grant, full.authority, (continuation ? 38 + recoveryShift : 35) + offset) };
  edit('graph', graph); return { graph, config, configBytes, runtimeBytes, evaluationTime: evaluatedAt, bytes: jcs(graph), verifier: selectedVerifier };
}
const denied = (value, now = evaluation) => assert.deepEqual(value.verifier.verify(value.bytes, now), { state: 'blocked', firstError: 'LIFECYCLE_GRAPH_INVALID', effects: zeroEffects(), ...(value.runtimeBytes ? { executionAuthorized: false } : {}) });

test('composed lifecycle validates both providers, every copy and the separate tombstone, including exact replay', () => {
  for (const recordClass of ['RC-REBUILDABLE', 'RC-CORPUS-RAW-WORKING']) for (const replay of [false, true]) {
    const value = fixture({ recordClass, replay }), before = value.bytes, result = value.verifier.verify(value.bytes, evaluation);
    assert.equal(result.state, 'validated-lifecycle-candidate', JSON.stringify({ recordClass, replay, result }));
    const count = recordClass === 'RC-CORPUS-RAW-WORKING' ? 3 : 2;
    assert.equal(result.copyCount, count); assert.equal(result.protectedActionCount, count + 1); assert.equal(result.replayCount, replay ? count + 1 : 0);
    assert.deepEqual(result.effects, zeroEffects()); assert.equal(value.bytes, before);
  }
  const reordered = fixture({ edits: { graph: (graph) => { graph.copies.reverse(); } } });
  assert.equal(reordered.verifier.verify(reordered.bytes, evaluation).state, 'validated-lifecycle-candidate');
});

test('the old effects graph surrogate and ignored historical provider proof cannot pass the composed path', () => {
  const old = makeLifecycleGraph('RC-FAILED-RUN', 'complete'); assert.equal(frozen(old).state, 'deleted-tombstoned');
  const value = fixture(); denied({ ...value, bytes: old });
  denied(fixture({ edits: { 'signed-event-proof-1': (record) => { record.signature.valueBase64 = Buffer.alloc(64).toString('base64'); } } }));
  denied(fixture({ edits: { 'event-1': (record) => { record.recordId = 'other-record'; } } }));
  denied(fixture({ edits: { 'event-2': (record) => { record.policySha256 = 'f'.repeat(64); } } }));
  denied(fixture({ edits: { 'state': (record) => { record.historyDigest = 'f'.repeat(64); } } }));
  denied(fixture({ historyType: 'hold-applied' }));
});

test('every copy and tombstone must actually invoke the complete human and shared-action verifier', () => {
  for (const label of ['copy-1', 'copy-2', 'tombstone']) {
    for (const kind of ['request', 'upstream', 'downstream', 'delegation', 'assignment', 'authority', 'resources', 'replay', 'head', 'reservation'])
      denied(fixture({ edits: { [`${label}:action-bundle`]: (bundle) => { delete bundle[`${kind}Bytes`]; } } }));
    for (const [kind, field, value] of [['downstream', 'oneUse', false], ['assignment', 'actorRole', 'builder'], ['authority', 'decision', 'denied'],
      ['resources', 'provider', 'foreign-provider'], ['reservation', 'winner', false], ['replay', 'requestDigest', 'f'.repeat(64)]])
      denied(fixture({ edits: { [`${label}:${kind}`]: (record) => { record[field] = value; } } }));
    denied(fixture({ edits: { [`${label}:human`]: (record) => { record.terminalEventId = 'wrong-event'; } } }));
    denied(fixture({ edits: { [`${label}:human`]: (record) => { record.conditions.push('broader-scope'); } } }));
    denied(fixture({ edits: { [`${label}:context`]: (context) => { context.target.implementationRevision = 'f'.repeat(40); } } }));
    denied(fixture({ edits: { [`${label}:human-bundle`]: (bundle) => {
      const record = JSON.parse(bundle.authorityBytes); record.sessionId = 'substituted-session'; const signed = seal(record, 'authority'); bundle.authorityBytes = jcs(signed);
      bundle.casReservationBytes = jcs(seal({ ...JSON.parse(bundle.casReservationBytes), authorityDigest: signed.recordDigest, requestDigest: signed.recordDigest }, 'cas-authority'));
    } } }));
  }
  denied(fixture({ edits: { 'copy-2:human': (record) => { record.providerRecordId = 'human-provider-copy-1'; } } }));
  denied(fixture({ edits: { 'copy-2:upstream': (record) => { record.credentialId = 'up-copy-1'; } } }));
  denied(fixture({ edits: { 'copy-2:reservation': (record) => { record.reservationId = 'reserve-copy-1'; } } }));
});

test('authoritative inventory, holds, receipt completeness and exact provider/tuple bindings are enforced', () => {
  for (const field of ['holdState', 'referenceState']) {
    const value = fixture({ edits: { state: (record) => { record[field] = 'active'; } } });
    assert.equal(value.verifier.verify(value.bytes, evaluation).state, 'retained-on-hold');
  }
  for (const [kind, field, value] of [['state', 'historyComplete', false], ['inventory', 'complete', false], ['inventory', 'source', 'caller'],
    ['state', 'source', 'caller'], ['aggregate', 'allCopiesGone', false], ['aggregate', 'recordedAt', at(18)]])
    denied(fixture({ edits: { [kind]: (record) => { record[field] = value; } } }));
  denied(fixture({ inventoryDomain: 'record' })); denied(fixture({ stateDomain: 'record' }));
  denied(fixture({ edits: { copies: (copies) => { copies[1].sourceOriginal = true; } } }));
  denied(fixture({ edits: { copies: (copies) => { copies[1] = { ...copies[0], copyId: copies[1].copyId }; } } }));
  denied(fixture({ edits: { copies: (copies) => { copies[1].account = 'foreign-account'; } } }));
  denied(fixture({ edits: { graph: (graph) => { graph.copies.pop(); } } }));
  denied(fixture({ edits: { aggregate: (record) => { record.receiptDigests.reverse(); } } }));
  for (const label of ['copy-1', 'copy-2', 'tombstone']) for (const [field, value] of [['status', 'partial'], ['requestDigest', 'f'.repeat(64)], ['resourcesDigest', 'f'.repeat(64)],
    ['authorityDigest', 'f'.repeat(64)], ['contextDigest', 'f'.repeat(64)], ['inputDigest', 'f'.repeat(64)], ['action', 'unlisted'], ['effect', 'wrong-effect'], ['recordedAt', at(0)]])
    denied(fixture({ edits: { [`${label}:receipt`]: (record) => { record[field] = value; } } }));
  denied(fixture({ edits: { 'copy-2:receipt': (record) => { record.transactionId = 'transaction-copy-1'; } } }));
});

test('raw deadline, temporary-copy policy and replay-result drift fail closed', () => {
  const recordClass = 'RC-CORPUS-RAW-WORKING';
  for (const [field, value] of [['sanitizerRevision', 'wrong-revision'], ['inspectorRevision', 'wrong-revision'], ['completeInventoryRequired', false], ['permittedTargetKind', 'source-original']])
    denied(fixture({ recordClass, edits: { 'raw:grant': (record) => { record[field] = value; } } }));
  denied(fixture({ recordClass, edits: { copies: (copies) => { copies[1].copyKind = 'source-original'; } } }));
  const value = fixture({ recordClass, evaluationTime: at(61) });
  assert.equal(value.verifier.verify(value.bytes, at(61)).state, 'validated-lifecycle-candidate');
  const slowOrdinary = fixture({ offset: 70, evaluationTime: at(120) });
  assert.equal(slowOrdinary.verifier.verify(slowOrdinary.bytes, at(120)).state, 'validated-lifecycle-candidate');
  denied(fixture({ recordClass, offset: 70, evaluationTime: at(120) }), at(120));
  const onDeadline = fixture({ recordClass, offset: 41, evaluationTime: at(90) });
  assert.equal(onDeadline.verifier.verify(onDeadline.bytes, at(90)).state, 'validated-lifecycle-candidate');
  denied(fixture({ recordClass, offset: 42, evaluationTime: at(90) }), at(90));
  for (const label of ['copy-1', 'copy-2', 'tombstone'])
    denied(fixture({ replay: true, edits: { [`${label}:replay`]: (record) => { record.resultDigest = 'f'.repeat(64); } } }));
});

test('calendar retention bounds, future scheduling, immutable retention and malformed public inputs remain safe', () => {
  assert.equal(lifecycleBoundary('2024-02-29T12:00:00Z', 'P1Y'), '2025-02-28T12:00:00Z');
  assert.equal(lifecycleBoundary(at(0), 'P90D'), '2026-12-03T12:00:00Z');
  assert.equal(lifecycleBoundary(at(0), 'P7Y'), '2033-09-04T12:00:00Z');
  assert.equal(lifecycleBoundary(at(0), 'P90D', at(20)), at(20));
  assert.throws(() => lifecycleBoundary(at(0), 'P1Ygarbage'));
  const scheduled = fixture({ recordClass: 'RC-DECISION-PROOF', eventType: 'item-closed' });
  assert.equal(scheduled.verifier.verify(scheduled.bytes, evaluation).state, 'scheduled');
  const immutable = fixture({ recordClass: 'RC-AUTHORITATIVE-ARTIFACT', eventType: 'record-committed', historyType: 'event-committed' });
  assert.equal(immutable.verifier.verify(immutable.bytes, evaluation).state, 'retained-immutable');
  // Changed history without a new authoritative snapshot is not accepted even for retention.
  denied({ ...immutable, bytes: jcs({ ...immutable.graph, historyBytes: [] }) });
  const value = fixture();
  for (const bytes of [value.bytes + ' ', '{}', 'x'.repeat(16777217)]) denied({ ...value, bytes });
  assert.equal(value.verifier.verify(value.bytes).state, 'blocked');
  denied(value, '2027-09-01T00:00:00Z');
  // Changing only the evaluation instant does not replace the exact clock
  // binding in the complete human evidence bundle.
  denied(value, '2026-09-04T12:00:50.000000001Z');
  for (const field of ['casWinner', 'authorizationDecision', 'trustRegistryBytes', 'evaluationTime']) denied({ ...value, bytes: jcs({ ...value.graph, [field]: true }) });
});

test('0070: complete lifecycle, human and shared action paths preserve nanosecond chronology', () => {
  for (const recordClass of ['RC-REBUILDABLE', 'RC-CORPUS-RAW-WORKING']) for (const replay of [false, true]) {
    for (const options of [{ nanoseconds: 123456789 }, { tickNanoseconds: 1 }]) {
      const value = fixture({ recordClass, replay, ...options }), before = value.bytes;
      const result = value.verifier.verify(value.bytes, value.evaluationTime);
      assert.equal(result.state, 'validated-lifecycle-candidate', JSON.stringify({ recordClass, replay, options, result }));
      const actions = recordClass === 'RC-CORPUS-RAW-WORKING' ? 4 : 3;
      assert.equal(result.protectedActionCount, actions); assert.equal(result.replayCount, replay ? actions : 0);
      assert.deepEqual(result.effects, zeroEffects()); assert.equal(value.bytes, before);
    }
  }
});

test('0070: one-nanosecond late raw erasure and premature parent-capped actions deny', () => {
  const options = { recordClass: 'RC-CORPUS-RAW-WORKING', nanoseconds: 1, offset: 41, evaluationTime: '2026-09-04T12:01:30.000000001Z' };
  const exact = fixture(options); assert.equal(exact.verifier.verify(exact.bytes, exact.evaluationTime).state, 'validated-lifecycle-candidate');
  const late = fixture({ ...options, edits: { 'copy-2:receipt': (record) => { record.recordedAt = formatExactInstant(exactInstant(record.recordedAt) + 1n); } } });
  denied(late, late.evaluationTime);
  for (const [capNs, expected] of [[15n, 'validated-lifecycle-candidate'], [16n, 'blocked']]) {
    const value = fixture({ recordClass: 'RC-CORPUS-DERIVED-TEXT', eventType: 'run-terminal', tickNanoseconds: 1,
      edits: { state: (state) => { state.parentExpiryAt = formatExactInstant(BigInt(epoch) * 1000000n + capNs); } } });
    assert.equal(value.verifier.verify(value.bytes, value.evaluationTime).state, expected);
  }
});

test('0070: fractional event, inventory, identity and receipt mutations cannot use rounded chronology', () => {
  const changes = [
    ['event-1', (record) => { record.occurredAt = '2026-09-04T12:00:00.000000001Z'; }],
    ['inventory', (record) => { record.recordedAt = '2026-09-04T12:00:00.000000003Z'; }],
    ['copy-1:human', (record) => { record.authenticatedAt = '2026-09-04T12:00:00.000000006Z'; }],
    ['copy-1:reservation', (record) => { record.recordedAt = '2026-09-04T12:00:00.000000015Z'; }],
    ['copy-1:receipt', (record) => { record.recordedAt = '2026-09-04T12:00:00.000000017Z'; }],
    ['aggregate', (record) => { record.recordedAt = '2026-09-04T12:00:00.000000019Z'; }],
    ['tombstone:human', (record) => { record.decidedAt = '2026-09-04T12:00:00.000000024Z'; }],
  ];
  for (const [name, change] of changes) {
    const value = fixture({ tickNanoseconds: 1, edits: { [name]: change } }); denied(value, value.evaluationTime);
  }
  for (const bad of ['2026-09-04T12:00:00.1Z', '2026-02-29T12:00:00.000000001Z', '2026-09-04T12:00:00.0000000001Z']) {
    const value = fixture({ edits: { 'event-2': (event) => { event.occurredAt = bad; } } }); denied(value);
  }
});

test('0071: signed equal-time holds are enforced before disposition, not merely accepted by the event oracle', () => {
  const history = [{ type: 'hold-applied', second: 0 }, { type: 'hold-released', second: 0 }];
  const value = fixture({ history, edits: { 'event-1': (event) => { event.holdId = 'same-hold'; }, 'event-2': (event) => { event.holdId = 'same-hold'; }, state: (state) => { state.holdState = 'released'; } } });
  const result = value.verifier.verify(value.bytes, evaluation);
  assert.equal(result.state, 'validated-lifecycle-candidate'); assert.equal(result.protectedActionCount, 3); assert.deepEqual(result.effects, zeroEffects());
  const active = fixture({ history: history.slice(0, 1), edits: { state: (state) => { state.holdState = 'active'; } } });
  assert.equal(active.verifier.verify(active.bytes, evaluation).state, 'retained-on-hold');
  denied(fixture({ history: history.slice(0, 1) }));
  // Releasing before applying is invalid even if UUID order is syntactically
  // increasing: the full lifecycle hold-state check must still reject it.
  denied(fixture({ history: [{ type: 'hold-released', second: 0 }, { type: 'hold-applied', second: 0 }], edits: {
    'event-1': (event) => { event.holdId = 'same-hold'; }, 'event-2': (event) => { event.holdId = 'same-hold'; }, state: (state) => { state.holdState = 'released'; },
  } }));
});

test('0072: raw evidence covers three independent key tuples and four complete actions across every copy order', () => {
  const recordClass = 'RC-CORPUS-RAW-WORKING';
  const permutations = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const replay of [false, true]) {
    let expectedDigest;
    for (const order of permutations) {
      const value = fixture({ recordClass, replay, edits: { graph: (graph) => { graph.copies = order.map((index) => graph.copies[index]); } } });
      const inventory = JSON.parse(value.graph.inventoryBytes).copies;
      assert.equal(inventory.length, 3); assert.equal(new Set(inventory.map((copy) => copy.providerBindingId)).size, 2);
      assert.equal(new Set(inventory.map((copy) => jcs([copy.providerBindingId, copy.account, copy.keyId]))).size, 3);
      assert.ok(inventory.every((copy) => !copy.sourceOriginal && copy.copyKind === 'temporary-working'));
      const result = value.verifier.verify(value.bytes, evaluation);
      assert.equal(result.state, 'validated-lifecycle-candidate'); assert.equal(result.copyCount, 3);
      assert.equal(result.protectedActionCount, 4); assert.equal(result.replayCount, replay ? 4 : 0);
      assert.deepEqual(result.effects, zeroEffects());
      expectedDigest ??= result.evidenceDigest; assert.equal(result.evidenceDigest, expectedDigest);
    }
  }
});

test('0072/0074: every raw key retains shared proof checks under one complete pre-terminal grant', () => {
  const recordClass = 'RC-CORPUS-RAW-WORKING';
  for (const label of ['copy-1', 'copy-2', 'copy-3']) {
    for (const kind of ['request', 'upstream', 'downstream', 'delegation', 'assignment', 'authority', 'resources', 'replay', 'head', 'reservation'])
      denied(fixture({ recordClass, edits: { [`${label}:action-bundle`]: (bundle) => { delete bundle[`${kind}Bytes`]; } } }));
    denied(fixture({ recordClass, edits: { [`${label}:resources`]: (record) => { record.resources.keyId = 'substituted-key'; } } }));
    denied(fixture({ recordClass, replay: true, edits: { [`${label}:replay`]: (record) => { record.resultDigest = 'f'.repeat(64); } } }));
  }
  for (const field of ['authorityBytes', 'providerProofBytes', 'identityEvidenceBytes', 'qualificationEvidenceBytes', 'assignmentEvidenceBytes', 'inventoryBytes', 'replayLedgerBytes', 'casHeadBytes', 'casReservationBytes'])
    denied(fixture({ recordClass, edits: { 'raw-policy:human-bundle': (bundle) => { delete bundle[field]; } } }));
  denied(fixture({ recordClass, edits: { 'raw:grant': (grant) => { grant.receiptRequired = false; } } }));
  for (const field of ['actionBundleBytes', 'receiptBytes'])
    denied(fixture({ recordClass, edits: { graph: (graph) => { graph.copies[2][field] = graph.copies[0][field]; } } }));
  for (const field of ['rawGrantBytes', 'humanBundleBytes'])
    denied(fixture({ recordClass, edits: { graph: (graph) => { graph.copies[2][field] = '{}'; } } }));
  denied(fixture({ recordClass, edits: { copies: (copies) => { copies[2].objectKey = copies[0].objectKey; } } }));
});

test('0072: all three raw receipts must complete on time before a complete aggregate and separate tombstone', () => {
  const recordClass = 'RC-CORPUS-RAW-WORKING';
  const options = { recordClass, nanoseconds: 1, offset: 41, evaluationTime: '2026-09-04T12:01:30.000000001Z' };
  const onTime = fixture(options); assert.equal(onTime.verifier.verify(onTime.bytes, onTime.evaluationTime).protectedActionCount, 4);
  for (const label of ['copy-1', 'copy-2', 'copy-3']) {
    const late = fixture({ ...options, edits: { [`${label}:receipt`]: (receipt) => { receipt.recordedAt = formatExactInstant(exactInstant(receipt.recordedAt) + 1n); } } });
    denied(late, late.evaluationTime);
    denied(fixture({ recordClass, edits: { [`${label}:receipt`]: (receipt) => { receipt.status = 'partial'; } } }));
  }
  for (const mutate of [
    (graph) => { graph.copies.pop(); },
    (graph) => { delete graph.copies[2].receiptBytes; },
    (graph) => { graph.tombstone = {}; },
  ]) denied(fixture({ recordClass, edits: { graph: mutate } }));
  denied(fixture({ recordClass, edits: { aggregate: (record) => { record.receiptDigests.pop(); } } }));
  denied(fixture({ recordClass, edits: { aggregate: (record) => { record.allCopiesGone = false; } } }));
  denied(fixture({ recordClass, edits: { 'copy-3:receipt': (record) => { record.transactionId = 'transaction-copy-1'; } } }));
});

test('0074: one pre-terminal human grant composes actual first/replay batches for every terminal outcome', () => {
  const recordClass = 'RC-CORPUS-RAW-WORKING', originalBatches = new Map(); let humanBytes, consumptionKey;
  for (const result of ['pass', 'fail', 'cancelled']) for (const replay of [false, true]) {
    const value = fixture({ recordClass, replay, edits: { 'event-2': (event) => { event.result = result; } } });
    const checked = value.verifier.verify(value.bytes, evaluation), raw = JSON.parse(value.graph.rawPolicyBytes), batch = JSON.parse(value.graph.rawBatchBytes);
    assert.equal(checked.state, 'validated-lifecycle-candidate'); assert.equal(checked.rawBatchMode, replay ? 'replay' : 'first');
    assert.equal(checked.protectedActionCount, 4); assert.equal(checked.replayCount, replay ? 4 : 0); assert.equal(checked.executionAuthorized, false);
    assert.deepEqual(checked.effects, zeroEffects());
    const authority = JSON.parse(raw.humanBundleBytes).authorityBytes;
    humanBytes ??= authority; assert.equal(authority, humanBytes);
    consumptionKey ??= JSON.parse(batch.planBytes).consumptionKey; assert.equal(JSON.parse(batch.planBytes).consumptionKey, consumptionKey);
    const original = { planBytes: batch.planBytes, openingBytes: batch.openingBytes, receipts: value.graph.copies.map((copy) => copy.receiptBytes) };
    if (!replay) originalBatches.set(result, original);
    else assert.deepEqual(original, originalBatches.get(result));
    for (const copy of value.graph.copies) {
      assert.deepEqual(Object.keys(copy).sort(), ['actionBundleBytes', 'copyId', 'receiptBytes']);
      const request = JSON.parse(JSON.parse(copy.actionBundleBytes).authorityBytes);
      assert.equal(request.authorityEvidenceDigest, checked.rawGrantDigest);
    }
    // The tombstone still has its own independently verified human decision.
    assert.notEqual(JSON.parse(JSON.parse(value.graph.tombstone.humanBundleBytes).authorityBytes).recordDigest, checked.rawGrantDigest);
  }
});

test('0074: obsolete raw envelopes, missing batch records and re-signed scope/plan substitutions deny', () => {
  const recordClass = 'RC-CORPUS-RAW-WORKING';
  for (const field of ['planBytes', 'openingBytes', 'headBytes', 'replayBytes', 'reservationBytes'])
    denied(fixture({ recordClass, edits: { 'raw-batch': (batch) => { delete batch[field]; } } }));
  for (const kind of ['plan', 'head', 'replay', 'reservation', 'opening-head', 'opening-replay', 'opening-reservation']) for (const patch of [
    { source: 'caller-store' }, { configDigest: 'f'.repeat(64) }, { consumptionKey: 'f'.repeat(64) }, { validThrough: evaluation }, { extra: true },
  ]) denied(fixture({ recordClass, edits: { [`raw-batch-${kind}`]: (record) => Object.assign(record, patch) } }));
  for (const [kind, patch] of [
    ['plan', { inputDigest: 'f'.repeat(64) }], ['plan', { authorityDigest: 'f'.repeat(64) }], ['plan', { tupleDigest: 'f'.repeat(64) }],
    ['plan', { terminalDigest: 'f'.repeat(64) }], ['head', { planDigest: 'f'.repeat(64) }], ['replay', { planDigest: 'f'.repeat(64) }],
    ['reservation', { planDigest: 'f'.repeat(64) }], ['replay', { headId: 'other' }], ['reservation', { headId: 'other' }],
    ['reservation', { expectedHead: 'f'.repeat(64) }], ['reservation', { headDigest: 'f'.repeat(64) }], ['reservation', { replayDigest: 'f'.repeat(64) }],
    ['head', { sequence: 0 }], ['head', { previousHead: 'bad' }],
  ]) denied(fixture({ recordClass, edits: { [`raw-batch-${kind}`]: (record) => Object.assign(record, patch) } }));
  for (const change of [
    (plan) => { plan.entries.pop(); }, (plan) => { plan.entries.reverse(); },
    (plan) => { plan.entries[2] = { ...plan.entries[0] }; },
    ...['copyId', 'requestDigest', 'operationDigest', 'idempotencyKey'].map((field) => (plan) => { plan.entries[2][field] = 'changed'; }),
  ]) denied(fixture({ recordClass, edits: { 'raw-batch-plan': change } }));
  for (const change of [
    (graph) => { graph.version = 'steer-lifecycle-graph/v1'; },
    (graph) => { delete graph.rawPolicyBytes; }, (graph) => { delete graph.rawBatchBytes; },
    (graph) => { graph.rawBatchBytes += ' '; }, (graph) => { graph.rawBatchBytes = 'x'.repeat(524289); },
  ]) denied(fixture({ recordClass, edits: { graph: change } }));
  denied(fixture({ edits: { graph: (graph) => { graph.rawBatchBytes = '{}'; } } })); // No new fields for ordinary classes.
});

test('0074: competing batch and per-copy reservations cannot borrow an unused grant or committed result', () => {
  const recordClass = 'RC-CORPUS-RAW-WORKING';
  denied(fixture({ recordClass, edits: { 'raw-batch-reservation': (record) => { record.winner = false; } } }));
  denied(fixture({ recordClass, replay: true, edits: { 'raw-batch-reservation': (record) => { record.winner = true; } } }));
  denied(fixture({ recordClass, replay: true, edits: { 'raw-batch-replay': (record) => { record.resultDigest = 'f'.repeat(64); } } }));
  denied(fixture({ recordClass, edits: { 'raw-batch-replay': (record) => { record.resultDigest = 'f'.repeat(64); } } }));
  const original = fixture({ recordClass }), changed = fixture({ recordClass, edits: { 'copy-3:operation': (operation) => { operation.idempotencyKey = 'different-request'; } } });
  // Even another fully signed plan cannot substitute its store proof for this batch.
  denied({ ...changed, bytes: jcs({ ...changed.graph, rawBatchBytes: original.graph.rawBatchBytes }) });
  for (const label of ['copy-1', 'copy-2', 'copy-3']) {
    denied(fixture({ recordClass, edits: { [`${label}:reservation`]: (record) => { record.winner = false; } } }));
    denied(fixture({ recordClass, edits: { [`${label}:operation`]: (record) => { record.idempotencyKey = 'idem-tombstone'; } } }));
  }
});

test('0074: request-plan-reservation chronology is exact and each receipt remains deadline-bound', () => {
  const recordClass = 'RC-CORPUS-RAW-WORKING';
  for (const [kind, second] of [['plan', 14], ['head', 14], ['replay', 14], ['reservation', 15], ['reservation', 18]])
    denied(fixture({ recordClass, edits: { [`raw-batch-${kind}`]: (record) => { record.recordedAt = at(second); } } }));
  denied(fixture({ recordClass, replay: true, edits: { 'raw-batch-replay': (record) => { record.recordedAt = at(24); } } }));
  const boundary = fixture({ recordClass, edits: { 'raw-batch-reservation': (record) => { record.recordedAt = at(17); } } });
  assert.equal(boundary.verifier.verify(boundary.bytes, evaluation).state, 'validated-lifecycle-candidate');
  denied(fixture({ recordClass, edits: { 'raw-batch-reservation': (record) => { record.recordedAt = formatExactInstant(exactInstant(at(17)) + 1n); } } }));
  denied(fixture({ recordClass, edits: { 'raw-policy:human': (record) => { record.decidedAt = at(0); } } }));
  denied(fixture({ recordClass, edits: { state: (record) => { record.recordedAt = at(16); } } }));
  denied(fixture({ recordClass, edits: { 'raw-batch-head': (record) => { record.validThrough = at(100); } } }));
});

test('0074: current inventory and holds remain required; prepared tuples are not future-state authority', () => {
  const recordClass = 'RC-CORPUS-RAW-WORKING';
  for (const field of ['holdState', 'referenceState']) {
    const held = fixture({ recordClass, edits: { state: (record) => { record[field] = 'active'; } } });
    const result = held.verifier.verify(held.bytes, evaluation); assert.equal(result.state, 'retained-on-hold'); assert.deepEqual(result.effects, zeroEffects());
  }
  denied(fixture({ recordClass, historyType: 'hold-applied' }));
  denied(fixture({ recordClass, edits: { state: (record) => { record.historyComplete = false; } } }));
  for (const edit of [
    (record) => { record.copies[2].keyId = 'other'; }, (record) => { record.copies.pop(); },
    (record) => { record.complete = false; }, (record) => { record.configDigest = 'f'.repeat(64); },
  ]) denied(fixture({ recordClass, edits: { 'raw-preparation': edit } }));
  const sizes = [1, 32];
  for (const count of sizes) {
    const value = fixture({ recordClass, edits: { copies: (copies) => { const first = copies[0]; copies.splice(0, copies.length,
      ...Array.from({ length: count }, (_, index) => ({ ...first, copyId: `copy-${String(index).padStart(3, '0')}`, objectKey: `obj-${index}`, keyId: `key-${index}` }))); } } });
    assert.equal(value.verifier.verify(value.bytes, evaluation).copyCount, count);
  }
});

test('0074: complete copy replay can finish a separate tombstone; partial-copy retry remains closed', () => {
  const recordClass = 'RC-CORPUS-RAW-WORKING';
  const recovered = fixture({ recordClass, replay: true, tombstoneReplay: false });
  const result = recovered.verifier.verify(recovered.bytes, evaluation);
  assert.equal(result.state, 'validated-lifecycle-candidate'); assert.equal(result.rawBatchMode, 'replay'); assert.equal(result.replayCount, 3);
  for (const replay of [false, true]) for (const labels of [['copy-1'], ['copy-2', 'copy-3']])
    denied(fixture({ recordClass, replay, replayCopies: labels }));
  for (const label of ['copy-1', 'copy-2', 'copy-3']) denied(fixture({ recordClass, edits: { graph: (graph) => {
    graph.copies = graph.copies.filter((copy) => copy.copyId !== label);
  } } }));
  for (const field of ['humanBundleBytes', 'actionBundleBytes', 'receiptBytes'])
    denied(fixture({ recordClass, replay: true, edits: { graph: (graph) => { delete graph.tombstone[field]; } } }));
});

test('0074: replay requires the full original winning batch chain before erasure, not a committed-status surrogate', () => {
  const recordClass = 'RC-CORPUS-RAW-WORKING', defaults = { recordClass, replay: true };
  for (const field of ['headBytes', 'replayBytes', 'reservationBytes'])
    denied(fixture({ ...defaults, edits: { 'raw-batch-opening': (record) => { delete record[field]; } } }));
  for (const [kind, patch] of [
    ['opening-reservation', { winner: false }], ['opening-reservation', { status: 'already-committed' }],
    ['opening-reservation', { replayDigest: 'f'.repeat(64) }], ['opening-reservation', { headDigest: 'f'.repeat(64) }],
    ['opening-reservation', { expectedHead: 'f'.repeat(64) }], ['opening-reservation', { recordedAt: at(19) }],
    ['opening-replay', { status: 'committed' }], ['opening-replay', { resultDigest: 'f'.repeat(64) }],
    ['opening-head', { planDigest: 'f'.repeat(64) }], ['opening-replay', { planDigest: 'f'.repeat(64) }], ['opening-reservation', { planDigest: 'f'.repeat(64) }],
    ['head', { previousHead: 'f'.repeat(64) }], ['head', { sequence: 3 }], ['head', { head: '7'.repeat(64) }],
    ...['head', 'replay', 'reservation'].map((kind) => [kind, { openingReservationDigest: 'f'.repeat(64) }]),
  ]) denied(fixture({ ...defaults, edits: { [`raw-batch-${kind}`]: (record) => Object.assign(record, patch) } }));
  denied(fixture({ ...defaults, edits: { inventory: (record) => { record.recordedAt = at(-1); } } }));
});

test('0074: every signed batch record rejects forged signatures and wrong-domain proofs', () => {
  const recordClass = 'RC-CORPUS-RAW-WORKING';
  for (const replay of [false, true]) for (const opening of [false, true]) for (const field of (opening ? ['headBytes', 'replayBytes', 'reservationBytes'] : ['planBytes', 'headBytes', 'replayBytes', 'reservationBytes'])) {
    for (const wrongDomain of [false, true]) denied(fixture({ recordClass, replay, edits: { [opening ? 'raw-batch-opening' : 'raw-batch']: (bundle) => {
      const record = JSON.parse(bundle[field]);
      if (wrongDomain) bundle[field] = jcs(seal(record, 'provider'));
      else { record.signature.valueBase64 = Buffer.alloc(64).toString('base64'); bundle[field] = jcs(record); }
    } } }));
  }
});

test('0075: every completed subset resumes only remaining copies using unchanged original requests and grant', () => {
  const recordClass = 'RC-CORPUS-RAW-WORKING', original = fixture({ recordClass }), originalBatch = JSON.parse(original.graph.rawBatchBytes);
  for (let mask = 0; mask < 8; mask++) {
    const completed = ['copy-1', 'copy-2', 'copy-3'].filter((_, index) => mask & (1 << index));
    const value = fixture({ recordClass, continueCopies: completed }), before = value.bytes, result = value.verifier.verify(value.bytes, evaluation);
    assert.equal(result.state, 'validated-lifecycle-candidate', JSON.stringify({ mask, result })); assert.equal(result.rawBatchMode, 'continuation');
    assert.equal(result.completedBeforeContinuation, completed.length); assert.equal(result.replayCount, completed.length);
    assert.equal(result.protectedActionCount, 4); assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
    assert.equal(value.bytes, before); assert.equal(value.graph.rawPolicyBytes, original.graph.rawPolicyBytes);
    const batch = JSON.parse(value.graph.rawBatchBytes); assert.equal(batch.planBytes, originalBatch.planBytes); assert.equal(batch.openingBytes, originalBatch.openingBytes);
    for (const copy of value.graph.copies) {
      const prior = original.graph.copies.find((entry) => entry.copyId === copy.copyId);
      assert.equal(JSON.parse(copy.actionBundleBytes).requestBytes, JSON.parse(prior.actionBundleBytes).requestBytes);
      if (completed.includes(copy.copyId)) assert.equal(copy.receiptBytes, prior.receiptBytes);
    }
    const checkpoint = JSON.parse(value.graph.continuationBytes), inventory = JSON.parse(checkpoint.inventoryBytes);
    assert.deepEqual(inventory.copies.map((copy) => copy.copyId), ['copy-1', 'copy-2', 'copy-3'].filter((id) => !completed.includes(id)));
  }
});

test('0075: new holds/references, incomplete or changed fresh inventories prevent continuation', () => {
  const defaults = { recordClass: 'RC-CORPUS-RAW-WORKING', continueCopies: ['copy-1'] };
  for (const [kind, patch] of [
    ['checkpoint-inventory', { complete: false }], ['checkpoint-inventory', { source: 'caller' }],
    ['checkpoint-state', { historyComplete: false }], ['checkpoint-state', { source: 'caller' }],
    ['checkpoint-state', { holdState: 'active' }], ['checkpoint-state', { referenceState: 'active' }],
    ['checkpoint-state', { inventoryDigest: 'f'.repeat(64) }], ['checkpoint-state', { historyDigest: 'f'.repeat(64) }],
  ]) denied(fixture({ ...defaults, edits: { [kind]: (record) => Object.assign(record, patch) } }));
  for (const change of [
    (record) => { record.copies.pop(); }, (record) => { record.copies.reverse(); },
    (record) => { record.copies[0].keyId = 'substituted'; }, (record) => { record.copies[0].sourceOriginal = true; },
    (record) => { record.copies.push({ ...record.copies[0], copyId: 'copy-1' }); },
  ]) denied(fixture({ ...defaults, edits: { 'checkpoint-inventory': change } }));
  denied(fixture({ ...defaults, checkpointHistory: [{ type: 'hold-applied', second: 17 }] }));
  const released = fixture({ ...defaults, checkpointHistory: [{ type: 'hold-applied', second: 17 }, { type: 'hold-released', second: 18 }], edits: {
    'event-3': (event) => { event.holdId = 'new-hold'; }, 'event-4': (event) => { event.holdId = 'new-hold'; }, 'checkpoint-state': (state) => { state.holdState = 'released'; },
  } });
  assert.equal(released.verifier.verify(released.bytes, evaluation).state, 'validated-lifecycle-candidate');
  denied(fixture({ ...defaults, checkpointHistory: [{ type: 'hold-released', second: 18 }] }));
  denied(fixture({ ...defaults, checkpointHistory: [{ type: 'corpus-sanitization-terminal', second: 18 }] }));
});

test('0075: exact checkpoint partition, original-plan scope and winning store bindings cannot be replaced', () => {
  const defaults = { recordClass: 'RC-CORPUS-RAW-WORKING', continueCopies: ['copy-1'] };
  for (const field of ['consumptionKey', 'inputDigest', 'planDigest', 'openingReservationDigest', 'authorityDigest', 'tupleDigest', 'inventoryDigest', 'stateDigest', 'historyDigest', 'configDigest'])
    denied(fixture({ ...defaults, edits: { 'checkpoint-record': (record) => { record[field] = 'f'.repeat(64); } } }));
  for (const change of [
    (record) => { record.completed = []; }, (record) => { record.remaining.pop(); }, (record) => { record.remaining.reverse(); },
    (record) => { record.completed.push(record.completed[0]); }, (record) => { record.remaining.push('copy-1'); },
    ...['copyId', 'requestDigest', 'receiptDigest'].map((field) => (record) => { record.completed[0][field] = 'wrong'; }),
    (record) => { record.sequence = 2; }, (record) => { record.previousCheckpointDigest = 'f'.repeat(64); },
  ]) denied(fixture({ ...defaults, edits: { 'checkpoint-record': change } }));
  for (const [kind, patch] of [
    ['raw-batch-replay', { resultDigest: 'f'.repeat(64) }], ['raw-batch-replay', { status: 'unused' }],
    ['raw-batch-reservation', { winner: false }], ['raw-batch-reservation', { status: 'already-committed' }],
    ['raw-batch-head', { sequence: 3 }], ['raw-batch-head', { previousHead: 'f'.repeat(64) }],
  ]) denied(fixture({ ...defaults, edits: { [kind]: (record) => Object.assign(record, patch) } }));
  const first = fixture(defaults), other = fixture({ ...defaults, edits: { 'checkpoint-record': (record) => { record.checkpointId = 'competing-checkpoint'; } } });
  denied({ ...other, bytes: jcs({ ...other.graph, rawBatchBytes: first.graph.rawBatchBytes }) });
});

test('0075: checkpoint chronology and every remaining receipt preserve exact deadlines', () => {
  const defaults = { recordClass: 'RC-CORPUS-RAW-WORKING', continueCopies: ['copy-1'] };
  for (const [kind, second] of [['checkpoint-inventory', 15], ['checkpoint-inventory', 18], ['checkpoint-state', 19], ['checkpoint-record', 20],
    ['checkpoint-record', 24], ['raw-batch-reservation', 26], ['copy-2:reservation', 23], ['copy-3:receipt', 24]])
    denied(fixture({ ...defaults, edits: { [kind]: (record) => { record.recordedAt = at(second); } } }));
  const exact = fixture({ ...defaults, edits: { 'copy-1:receipt': (record) => { record.recordedAt = at(20); } } });
  assert.equal(exact.verifier.verify(exact.bytes, evaluation).state, 'validated-lifecycle-candidate');
  denied(fixture({ ...defaults, edits: { 'copy-1:receipt': (record) => { record.recordedAt = formatExactInstant(exactInstant(at(20)) + 1n); } } }));
  const boundary = { ...defaults, offset: 34, evaluationTime: at(90) }, onTime = fixture(boundary);
  assert.equal(onTime.verifier.verify(onTime.bytes, at(90)).state, 'validated-lifecycle-candidate');
  for (const label of ['copy-2', 'copy-3']) denied(fixture({ ...boundary, edits: { [`${label}:receipt`]: (record) => {
    record.recordedAt = formatExactInstant(exactInstant(record.recordedAt) + 1n);
  } } }), at(90));
  const nano = fixture({ ...defaults, tickNanoseconds: 1 });
  assert.equal(nano.verifier.verify(nano.bytes, nano.evaluationTime).state, 'validated-lifecycle-candidate');
});

test('0075: every fresh proof and unchanged history prefix is required; format and version confusion deny', () => {
  const defaults = { recordClass: 'RC-CORPUS-RAW-WORKING', continueCopies: ['copy-1'] };
  for (const field of ['inventoryBytes', 'stateBytes', 'checkpointBytes']) {
    denied(fixture({ ...defaults, edits: { 'checkpoint-envelope': (input) => { delete input[field]; } } }));
    for (const wrongDomain of [false, true]) denied(fixture({ ...defaults, edits: { 'checkpoint-envelope': (input) => {
      const record = JSON.parse(input[field]);
      if (wrongDomain) input[field] = jcs(seal(record, 'record'));
      else { record.signature.valueBase64 = Buffer.alloc(64).toString('base64'); input[field] = jcs(record); }
    } } }));
  }
  for (const kind of ['checkpoint-inventory', 'checkpoint-state', 'checkpoint-record']) {
    denied(fixture({ ...defaults, edits: { [kind]: (record) => { record.validThrough = evaluation; } } }));
    denied(fixture({ ...defaults, edits: { [kind]: (record) => { record.extra = true; } } }));
  }
  for (const change of [
    (input) => { input.historyBytes = []; }, (input) => { input.policyDigest = 'f'.repeat(64); },
    (input) => { input.callerApproval = true; }, (input) => { input.inventoryBytes += ' '; },
  ]) denied(fixture({ ...defaults, edits: { 'checkpoint-envelope': change } }));
  for (const change of [
    (graph) => { delete graph.continuationBytes; }, (graph) => { graph.continuationBytes += ' '; },
    (graph) => { graph.continuationBytes = 'x'.repeat(2097153); }, (graph) => { graph.version = 'steer-lifecycle-graph/raw-v2'; },
  ]) denied(fixture({ ...defaults, edits: { graph: change } }));
  denied(fixture({ ...defaults, edits: { 'raw-batch': (batch) => { batch.version = 'steer-raw-batch/v1'; } } }));
  denied(fixture({ recordClass: defaults.recordClass, edits: { 'raw-batch': (batch) => { batch.version = 'steer-raw-batch/v2'; } } }));
});

test('0075: recovery still requires complete remaining actions and checkpoint-bound independent tombstone authority', () => {
  const defaults = { recordClass: 'RC-CORPUS-RAW-WORKING', continueCopies: ['copy-1'] };
  for (const label of ['copy-1', 'copy-2', 'copy-3']) for (const field of ['requestBytes', 'upstreamBytes', 'downstreamBytes', 'delegationBytes', 'assignmentBytes', 'authorityBytes', 'resourcesBytes', 'replayBytes', 'headBytes', 'reservationBytes'])
    denied(fixture({ ...defaults, edits: { [`${label}:action-bundle`]: (bundle) => { delete bundle[field]; } } }));
  denied(fixture({ ...defaults, edits: { 'tombstone:human': (record) => { record.conditions.pop(); } } }));
  denied(fixture({ ...defaults, edits: { 'tombstone:human': (record) => { record.conditions[3] = 'raw-checkpoint:other'; } } }));
  for (const field of ['humanBundleBytes', 'actionBundleBytes', 'receiptBytes'])
    denied(fixture({ ...defaults, edits: { graph: (graph) => { delete graph.tombstone[field]; } } }));
});

test('0076: all 27 monotonic two-checkpoint partitions verify without changing original requests or grant', () => {
  const recordClass = 'RC-CORPUS-RAW-WORKING';
  const original = fixture({ recordClass, horizon: 158, evaluationTime: at(58) }), origin = JSON.parse(original.graph.rawBatchBytes);
  for (let code = 0; code < 27; code++) {
    const stages = [code % 3, Math.floor(code / 3) % 3, Math.floor(code / 9) % 3];
    const checkpoints = [0, 1].map((stage) => ['copy-1', 'copy-2', 'copy-3'].filter((_, index) => stages[index] <= stage));
    const value = fixture({ recordClass, checkpoints }), before = value.bytes, result = value.verifier.verify(value.bytes, value.evaluationTime);
    assert.equal(result.state, 'validated-lifecycle-candidate', JSON.stringify({ code, result }));
    assert.equal(result.rawBatchMode, 'continuation-chain'); assert.equal(result.rawCheckpointCount, 2);
    assert.equal(result.completedBeforeContinuation, checkpoints[1].length); assert.equal(result.replayCount, checkpoints[1].length);
    assert.equal(result.protectedActionCount, 4); assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
    assert.equal(value.bytes, before); assert.equal(value.graph.rawPolicyBytes, original.graph.rawPolicyBytes);
    for (const step of JSON.parse(value.graph.continuationBytes).steps) {
      const batch = JSON.parse(step.batchBytes); assert.equal(batch.planBytes, origin.planBytes); assert.equal(batch.openingBytes, origin.openingBytes);
    }
    for (const copy of value.graph.copies) assert.equal(JSON.parse(copy.actionBundleBytes).requestBytes,
      JSON.parse(original.graph.copies.find((prior) => prior.copyId === copy.copyId).actionBundleBytes).requestBytes);
  }
});

test('0076: repeated interruptions, no-progress retries and the 33-step bound preserve complete verification', () => {
  const recordClass = 'RC-CORPUS-RAW-WORKING';
  for (const checkpoints of [[[], ['copy-1'], ['copy-1', 'copy-2'], ['copy-1', 'copy-2', 'copy-3']], [['copy-1'], ['copy-1'], ['copy-1', 'copy-3']]]) {
    const value = fixture({ recordClass, checkpoints }), result = value.verifier.verify(value.bytes, value.evaluationTime);
    assert.equal(result.state, 'validated-lifecycle-candidate'); assert.equal(result.rawCheckpointCount, checkpoints.length);
  }
  const maximum = fixture({ recordClass, checkpoints: Array.from({ length: 33 }, () => []), tickNanoseconds: 1 });
  assert.equal(maximum.verifier.verify(maximum.bytes, maximum.evaluationTime).rawCheckpointCount, 33);
  const tooMany = fixture({ recordClass, checkpoints: Array.from({ length: 34 }, () => []), tickNanoseconds: 1 }); denied(tooMany, tooMany.evaluationTime);
});

test('0076: missing, reordered, duplicate and forked predecessors cannot supply a later checkpoint', () => {
  const defaults = { recordClass: 'RC-CORPUS-RAW-WORKING', checkpoints: [[], ['copy-1'], ['copy-1', 'copy-2']] };
  for (const change of [
    (chain) => { chain.steps.splice(0, 1); }, (chain) => { chain.steps.splice(1, 1); }, (chain) => { chain.steps.reverse(); },
    (chain) => { chain.steps.splice(1, 0, chain.steps[0]); }, (chain) => { chain.steps = []; }, (chain) => { chain.extra = true; },
  ]) { const value = fixture({ ...defaults, edits: { 'checkpoint-chain': change } }); denied(value, value.evaluationTime); }
  for (const [kind, patch] of [
    ['step-2-checkpoint-record', { previousCheckpointDigest: 'f'.repeat(64) }], ['step-2-checkpoint-record', { sequence: 1 }],
    ['step-2-checkpoint-record', { checkpointId: 'checkpoint-1' }], ['step-2-batch-head', { sequence: 2 }],
    ['step-2-batch-head', { previousHead: '7'.repeat(64) }], ['step-3-batch-head', { head: sha256('checkpoint-head-1') }],
    ...['head', 'replay', 'reservation'].map((kind) => [`step-2-batch-${kind}`, { previousReservationDigest: 'f'.repeat(64) }]),
    ['step-2-batch-reservation', { winner: false }], ['step-2-batch-replay', { resultDigest: 'f'.repeat(64) }],
  ]) { const value = fixture({ ...defaults, edits: { [kind]: (record) => Object.assign(record, patch) } }); denied(value, value.evaluationTime); }
  const dropped = fixture({ recordClass: defaults.recordClass, checkpoints: [['copy-1'], []] }); denied(dropped, dropped.evaluationTime);
  const value = fixture(defaults), firstBatch = JSON.parse(value.graph.continuationBytes).steps[0].batchBytes;
  denied({ ...value, bytes: jcs({ ...value.graph, rawBatchBytes: firstBatch }) }, value.evaluationTime);
});

test('0076: every checkpoint extends prior verified history and rechecks actual remaining inventory and holds', () => {
  const defaults = { recordClass: 'RC-CORPUS-RAW-WORKING', checkpoints: [['copy-1'], ['copy-1', 'copy-2']] };
  const history = [[{ type: 'hold-applied', second: 17 }, { type: 'hold-released', second: 18 }], []];
  const edits = { 'event-3': (event) => { event.holdId = 'new-hold'; }, 'event-4': (event) => { event.holdId = 'new-hold'; } };
  const valid = fixture({ ...defaults, checkpointHistoryByStep: history, edits });
  assert.equal(valid.verifier.verify(valid.bytes, valid.evaluationTime).state, 'validated-lifecycle-candidate');
  const truncated = fixture({ ...defaults, checkpointHistoryByStep: history, edits: { ...edits, 'step-2-checkpoint-history': (bytes) => { bytes.splice(2); } } });
  denied(truncated, truncated.evaluationTime);
  const held = fixture({ ...defaults, checkpointHistoryByStep: [[], [{ type: 'hold-applied', second: 25 }]] }); denied(held, held.evaluationTime);
  for (const [kind, patch] of [
    ['step-1-checkpoint-state', { holdState: 'active' }], ['step-2-checkpoint-state', { referenceState: 'active' }],
    ['step-2-checkpoint-state', { historyComplete: false }], ['step-2-checkpoint-inventory', { complete: false }],
  ]) { const value = fixture({ ...defaults, edits: { [kind]: (record) => Object.assign(record, patch) } }); denied(value, value.evaluationTime); }
  for (const change of [(record) => { record.copies = []; }, (record) => { record.copies[0].keyId = 'changed'; }]) {
    const value = fixture({ ...defaults, edits: { 'step-2-checkpoint-inventory': change } }); denied(value, value.evaluationTime);
  }
});

test('0076: later history cannot hide an erasure receipt inside a subsequently released hold', () => {
  const defaults = { recordClass: 'RC-CORPUS-RAW-WORKING', checkpoints: [['copy-1'], ['copy-1', 'copy-2']],
    checkpointHistoryByStep: [[], [{ type: 'hold-applied', second: 25 }, { type: 'hold-released', second: 26 }]] };
  for (const [instant, expected] of [[formatExactInstant(exactInstant(at(25)) - 1n), 'validated-lifecycle-candidate'], [at(25), 'blocked'],
    [formatExactInstant(exactInstant(at(25)) + 1n), 'blocked'], [at(26), 'validated-lifecycle-candidate']]) {
    const value = fixture({ ...defaults, edits: { 'copy-2:receipt': (record) => { record.recordedAt = instant; } } });
    assert.equal(value.verifier.verify(value.bytes, value.evaluationTime).state, expected);
  }
});

test('0076: a later receipt must follow its preceding winning continuation, at exact nanosecond precision', () => {
  const defaults = { recordClass: 'RC-CORPUS-RAW-WORKING', checkpoints: [['copy-1'], ['copy-1', 'copy-2']] };
  for (const [kind, instant] of [
    ['copy-2:receipt', at(24)], ['step-2-checkpoint-inventory', at(23)], ['step-2-checkpoint-state', at(27)],
    ['step-2-batch-reservation', at(34)],
  ]) { const value = fixture({ ...defaults, edits: { [kind]: (record) => { record.recordedAt = instant; } } }); denied(value, value.evaluationTime); }
  const exact = fixture({ ...defaults, edits: { 'copy-2:receipt': (record) => { record.recordedAt = formatExactInstant(exactInstant(at(24)) + 1n); } } });
  assert.equal(exact.verifier.verify(exact.bytes, exact.evaluationTime).state, 'validated-lifecycle-candidate');
  const onTime = fixture({ ...defaults, offset: 26, evaluationTime: at(100) });
  assert.equal(onTime.verifier.verify(onTime.bytes, at(100)).state, 'validated-lifecycle-candidate');
  const late = fixture({ ...defaults, offset: 26, evaluationTime: at(100), edits: { 'copy-3:receipt': (record) => { record.recordedAt = formatExactInstant(exactInstant(record.recordedAt) + 1n); } } });
  denied(late, at(100));
});

test('0076: every step retains complete proofs and chain-bound tombstone authority; version confusion denies', () => {
  const defaults = { recordClass: 'RC-CORPUS-RAW-WORKING', checkpoints: [['copy-1'], ['copy-1', 'copy-2']] };
  for (const step of [1, 2]) for (const [kind, fields] of [['checkpoint', ['inventoryBytes', 'stateBytes', 'checkpointBytes']], ['batch', ['planBytes', 'openingBytes', 'headBytes', 'replayBytes', 'reservationBytes']]]) {
    for (const field of fields) {
      const omitted = fixture({ ...defaults, edits: { [`step-${step}-${kind}-envelope`]: (bundle) => { delete bundle[field]; } } }); denied(omitted, omitted.evaluationTime);
      if (field !== 'openingBytes') {
        const forged = fixture({ ...defaults, edits: { [`step-${step}-${kind}-envelope`]: (bundle) => { const record = JSON.parse(bundle[field]); record.signature.valueBase64 = Buffer.alloc(64).toString('base64'); bundle[field] = jcs(record); } } });
        denied(forged, forged.evaluationTime);
      }
    }
  }
  for (const change of [(record) => { record.conditions.pop(); }, (record) => { record.conditions[4] = 'raw-checkpoint-chain:other'; }]) {
    const value = fixture({ ...defaults, edits: { 'tombstone:human': change } }); denied(value, value.evaluationTime);
  }
  for (const [kind, version] of [['step-1-checkpoint-envelope', 'steer-raw-checkpoint/v1'], ['step-1-batch-envelope', 'steer-raw-batch/v2']]) {
    const value = fixture({ ...defaults, edits: { [kind]: (record) => { record.version = version; } } }); denied(value, value.evaluationTime);
  }
  const value = fixture(defaults);
  for (const continuationBytes of [value.graph.continuationBytes + ' ', 'x'.repeat(8388609)]) denied({ ...value, bytes: jcs({ ...value.graph, continuationBytes }) }, value.evaluationTime);
  denied({ ...value, bytes: jcs({ ...value.graph, version: 'steer-lifecycle-graph/raw-v3' }) }, value.evaluationTime);
});

// Expected boundaries come from the signed records policy, not the code under
// test. The provenance rule explicitly corrects the frozen table surrogate.
// Covering this inventory is not a future-key or disposition proof.
const retentionCases = [
  ['RC-AUTHORITATIVE-ARTIFACT', 'record-committed', null],
  ['RC-DECISION-PROOF', 'item-closed', '2033-09-04T12:00:00Z'],
  ['RC-LEGAL-SIGNED-LOG', 'item-closed', '2033-09-04T12:00:00Z'],
  ['RC-RELEASE-MIGRATION', 'environment-retired', '2033-09-04T12:00:00Z'],
  ['RC-REFERENCED-EVIDENCE', 'item-closed', '2029-09-04T12:00:00Z'],
  ['RC-FAILED-RUN', 'run-terminal', '2026-12-03T12:00:00Z'],
  ['RC-SECURITY-AUDIT', 'event-committed', '2027-09-04T12:00:00Z'],
  ['RC-POSTHOG-RAW', 'event-committed', '2026-12-03T12:00:00Z'],
  ['RC-REBUILDABLE', 'record-superseded', at(0)],
  ['RC-DELETION-EVIDENCE', 'deletion-completed', '2033-09-04T12:00:00Z'],
  ['RC-CORPUS-RAW-WORKING', 'corpus-sanitization-terminal', at(60)],
  ['RC-CORPUS-PROVENANCE', 'derived-record-deleted', '2033-09-04T12:00:00Z'],
  ['RC-CORPUS-SANITIZED', 'corpus-retired', '2027-09-04T12:00:00Z'],
  ['RC-CORPUS-BASELINE', 'corpus-retired', '2029-09-04T12:00:00Z'],
  ['RC-CORPUS-DERIVED-TEXT', 'run-terminal', '2026-09-19T12:00:00Z'],
  ['RC-CORPUS-EXPORT', 'export-completed', '2026-09-19T12:00:00Z'],
];

test('0068: all sixteen pinned record classes derive their actual composed retention outcome', () => {
  const source = readFileSync(new URL('../intent/0001/reviews/domain/round-2/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md', import.meta.url), 'utf8');
  assert.equal(sha256(source), 'f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32');
  const table = JSON.parse(readFileSync(new URL('../intent/0001/reviews/domain/round-3/remediation/LIFECYCLE-POLICY-TABLE.candidate.json', import.meta.url)));
  assert.deepEqual(retentionCases.map(([id]) => id).sort(), table.classes.map((row) => row.classId).sort());
  for (const [recordClass, eventType, boundaryAt] of retentionCases) {
    const value = fixture({ recordClass, eventType,
      historyType: recordClass === 'RC-CORPUS-PROVENANCE' ? 'corpus-retired' : 'originator-draft-saved',
      edits: { state: (state) => { if (['RC-CORPUS-DERIVED-TEXT', 'RC-CORPUS-EXPORT'].includes(recordClass)) state.parentExpiryAt = '2026-09-19T12:00:00Z'; } } });
    const result = value.verifier.verify(value.bytes, evaluation);
    assert.equal(result.state, boundaryAt === null ? 'retained-immutable' : ['RC-REBUILDABLE', 'RC-CORPUS-RAW-WORKING'].includes(recordClass) ? 'validated-lifecycle-candidate' : 'scheduled', recordClass);
    assert.equal(result.boundaryAt, boundaryAt, recordClass);
    assert.deepEqual(result.effects, zeroEffects());
  }
});

test('0068: earliest rebuildable trigger is bound into all copy and tombstone human decisions', () => {
  for (const [historyType, eventType] of [['record-superseded', 'rebuild-requested'], ['rebuild-requested', 'record-superseded']]) {
    for (const replay of [false, true]) {
      const value = fixture({ historyType, eventType, triggerHistoryIndex: 0, replay });
      const result = value.verifier.verify(value.bytes, evaluation);
      assert.equal(result.state, 'validated-lifecycle-candidate'); assert.equal(result.boundaryAt, at(-10));
      assert.equal(result.protectedActionCount, 3); assert.equal(result.replayCount, replay ? 3 : 0);
      assert.deepEqual(result.effects, zeroEffects());
    }
    // Fully re-signed, internally coherent authority for the later trigger must
    // not silently substitute for the required earliest trigger.
    denied(fixture({ historyType, eventType }));
  }
});

test('0068: corpus earlier/later rules require the correct history and reject ambiguous repetitions', () => {
  for (const [recordClass, pairs, boundaryAt] of [
    ['RC-CORPUS-PROVENANCE', [['corpus-retired', 'derived-record-deleted'], ['derived-record-deleted', 'corpus-retired']], '2033-09-04T12:00:00Z'],
    ['RC-CORPUS-SANITIZED', [['corpus-version-superseded', 'corpus-retired'], ['corpus-retired', 'corpus-version-superseded']], '2027-09-04T11:59:50Z'],
  ]) {
    for (const [historyType, eventType] of pairs) {
      const value = fixture({ recordClass, historyType, eventType });
      const result = value.verifier.verify(value.bytes, evaluation);
      assert.equal(result.state, 'scheduled'); assert.equal(result.boundaryAt, boundaryAt);
      if (historyType !== 'derived-record-deleted') denied(fixture({ recordClass, eventType, history: [{ type: historyType, second: -20 }, { type: historyType, second: -10 }] }));
    }
  }
  denied(fixture({ recordClass: 'RC-CORPUS-PROVENANCE', eventType: 'item-closed' }));
  denied(fixture({ recordClass: 'RC-CORPUS-PROVENANCE', eventType: 'item-closed', historyType: 'corpus-retired', edits: { graph: (graph) => { delete graph.derivedInventoryBytes; } } }));
  for (const eventType of ['corpus-version-superseded', 'corpus-retired']) {
    const value = fixture({ recordClass: 'RC-CORPUS-SANITIZED', eventType });
    assert.equal(value.verifier.verify(value.bytes, evaluation).boundaryAt, '2027-09-04T12:00:00Z');
  }
});

test('0068: signed parent caps reach complete protected disposition, without extending the class maximum', () => {
  for (const [recordClass, eventType, maximum] of [
    ['RC-CORPUS-DERIVED-TEXT', 'run-terminal', '2026-12-03T12:00:00Z'],
    ['RC-CORPUS-EXPORT', 'export-completed', '2026-10-04T12:00:00Z'],
  ]) {
    for (const replay of [false, true]) {
      const value = fixture({ recordClass, eventType, replay, edits: { state: (state) => { state.parentExpiryAt = at(0); } } });
      const result = value.verifier.verify(value.bytes, evaluation);
      assert.equal(result.state, 'validated-lifecycle-candidate'); assert.equal(result.boundaryAt, at(0));
      assert.equal(result.protectedActionCount, 3); assert.deepEqual(result.effects, zeroEffects());
    }
    const later = fixture({ recordClass, eventType, edits: { state: (state) => { state.parentExpiryAt = '2033-09-04T12:00:00Z'; } } });
    assert.equal(later.verifier.verify(later.bytes, evaluation).boundaryAt, maximum);
    for (const invalid of [null, '', 'not-a-date', 0, '2026-09-04T12:00:00+00:00'])
      denied(fixture({ recordClass, eventType, edits: { state: (state) => { state.parentExpiryAt = invalid; } } }));
    // A valid cap after the signed operation cannot authorize premature erasure.
    denied(fixture({ recordClass, eventType, edits: { state: (state) => { state.parentExpiryAt = at(20); } } }));
  }
  denied(fixture({ edits: { state: (state) => { state.parentExpiryAt = at(0); } } }));
});

test('0068: actual matched hold histories retain or release safely and reject unmatched releases', () => {
  const applied = [{ type: 'hold-applied', second: -20 }];
  const released = [...applied, { type: 'hold-released', second: -10 }];
  const holdEdits = { 'event-1': (event) => { event.holdId = 'hold-1'; }, 'event-2': (event) => { event.holdId = 'hold-1'; } };
  for (const [history, holdState, expected] of [[applied, 'active', 'retained-on-hold'], [released, 'released', 'validated-lifecycle-candidate']]) {
    const edits = { 'event-1': holdEdits['event-1'], ...(history.length === 2 ? { 'event-2': holdEdits['event-2'] } : {}), state: (state) => { state.holdState = holdState; } };
    const value = fixture({ history, edits }), result = value.verifier.verify(value.bytes, evaluation);
    assert.equal(result.state, expected); assert.deepEqual(result.effects, zeroEffects());
  }
  denied(fixture({ history: applied }));
  denied(fixture({ history: [{ type: 'hold-released', second: -10 }], edits: { state: (state) => { state.holdState = 'released'; } } }));
  denied(fixture({ history: released, edits: { ...holdEdits, 'event-2': (event) => { event.holdId = 'different-hold'; } } }));
  const reference = fixture({ edits: { state: (state) => { state.referenceState = 'active'; } } });
  assert.equal(reference.verifier.verify(reference.bytes, evaluation).state, 'retained-on-hold');
});

test('0068: provenance uses the maximum verified derived deletion, not an unrelated item closure', () => {
  const recordClass = 'RC-CORPUS-PROVENANCE';
  const history = [{ type: 'corpus-retired', second: -30 }, { type: 'derived-record-deleted', second: -20 }, { type: 'derived-record-deleted', second: -10 }];
  const value = fixture({ recordClass, history, eventType: 'item-closed' });
  const result = value.verifier.verify(value.bytes, evaluation);
  assert.equal(result.state, 'scheduled'); assert.equal(result.boundaryAt, '2033-09-04T11:59:50Z'); assert.deepEqual(result.effects, zeroEffects());
  // A signed complete empty manifest is distinct from a missing manifest. It
  // attests no derivatives exist, so retirement is the only required trigger.
  const empty = fixture({ recordClass, eventType: 'corpus-retired' });
  assert.equal(empty.verifier.verify(empty.bytes, evaluation).boundaryAt, '2033-09-04T12:00:00Z');
  const maximum = fixture({ recordClass, eventType: 'derived-record-deleted', history: [
    { type: 'corpus-retired', second: -129 },
    ...Array.from({ length: 127 }, (_, index) => ({ type: 'derived-record-deleted', second: index - 128 })),
  ] });
  assert.equal(JSON.parse(maximum.graph.derivedInventoryBytes).entries.length, 128);
  assert.equal(maximum.verifier.verify(maximum.bytes, evaluation).state, 'scheduled');
  denied(fixture({ recordClass, eventType: 'derived-record-deleted', history: [
    { type: 'corpus-retired', second: -130 },
    ...Array.from({ length: 128 }, (_, index) => ({ type: 'derived-record-deleted', second: index - 129 })),
  ] }));
});

test('0077: terminal replay preserves original signed bytes across repeated acknowledgment-loss audits', () => {
  const value = terminalFixture(), before = value.terminalBytes;
  for (const seconds of [60, 70, 80, 90]) {
    const result = value.terminalVerifier.verify(value.terminalBytes, at(seconds));
    assert.equal(result.state, 'verified-terminal-replay'); assert.equal(result.decision, 'REPLAY_NOOP');
    assert.equal(result.originalGraphDigest, sha256(value.bytes)); assert.equal(result.executionAuthorized, false);
    assert.deepEqual(result.effects, zeroEffects()); assert.equal(value.terminalBytes, before);
  }
});

test('0077: a terminal seal cannot substitute scope, grant, plan, chain, aggregate, tombstone or result', () => {
  for (const key of ['configDigest', 'policyDigest', 'graphDigest', 'evidenceDigest', 'consumptionKey', 'grantDigest', 'planDigest',
    'checkpointChainDigest', 'aggregateDigest', 'tombstoneReceiptDigest', 'previousReservationDigest']) {
    terminalDenied(terminalFixture({ edits: { completion: (record) => { record[key] = 'f'.repeat(64); } } }));
  }
  for (const [key, replacement] of [['source', 'caller'], ['kind', 'checkpoint'], ['observedAt', at(49)], ['recordedAt', at(49)]])
    terminalDenied(terminalFixture({ edits: { completion: (record) => { record[key] = replacement; } } }));
});

test('0077: all terminal outcomes and completed partitions converge to no-op with no recycled chain head', () => {
  for (const result of ['pass', 'fail', 'cancelled']) for (let mask = 0; mask < 8; mask++) {
    const completed = ['copy-1', 'copy-2', 'copy-3'].filter((_, index) => mask & (1 << index));
    const value = terminalFixture({ graphOptions: { checkpoints: [completed], edits: { 'event-2': (event) => { event.result = result; } } } });
    assert.equal(value.terminalVerifier.verify(value.terminalBytes, at(70)).state, 'verified-terminal-replay');
  }
  const value = terminalFixture(), batch = JSON.parse(value.graph.rawBatchBytes), opening = JSON.parse(JSON.parse(batch.openingBytes).headBytes);
  terminalDenied(terminalFixture({ edits: { 'terminal-head': (record) => { record.head = opening.head; } } }));
  terminalDenied(terminalFixture({ edits: { 'current-replay': (record) => { record.recordedAt = at(59); } } }));
  for (const label of ['terminal', 'current']) for (const field of ['headBytes', 'replayBytes', 'reservationBytes']) {
    for (const forge of [true, false]) terminalDenied(terminalFixture({ edits: { [`${label}-store`]: (store) => {
      const record = JSON.parse(store[field]);
      if (forge) { record.signature.valueBase64 = Buffer.alloc(64).toString('base64'); store[field] = jcs(record); }
      else store[field] = jcs(seal(record, 'provider'));
    } } }));
  }
});

test('0077: terminal and current stores require full independent linked committed proofs, never a new winning effect', () => {
  for (const label of ['terminal', 'current']) {
    for (const field of ['headBytes', 'replayBytes', 'reservationBytes'])
      terminalDenied(terminalFixture({ edits: { [`${label}-store`]: (store) => { delete store[field]; } } }));
    for (const [suffix, key, replacement] of [['head', 'headId', 'other'], ['head', 'sequence', 100], ['head', 'previousHead', 'f'.repeat(64)],
      ['replay', 'resultDigest', 'f'.repeat(64)], ['replay', 'status', 'checkpointed'], ['reservation', 'status', 'reserved'],
      ['reservation', 'previousReservationDigest', 'f'.repeat(64)], ['reservation', 'headDigest', 'f'.repeat(64)], ['reservation', 'replayDigest', 'f'.repeat(64)]])
      terminalDenied(terminalFixture({ edits: { [`${label}-${suffix}`]: (record) => { record[key] = replacement; } } }));
  }
  terminalDenied(terminalFixture({ edits: { 'current-reservation': (record) => { record.winner = true; } } }));
  terminalDenied(terminalFixture({ edits: { 'terminal-reservation': (record) => { record.winner = false; } } }));
  terminalDenied(terminalFixture({ edits: { 'current-head': (record) => { record.head = sha256('fork'); } } }));
});

test('0077: original observation does not bypass current expiry, freshness or exact clocks', () => {
  const value = terminalFixture();
  terminalDenied(value, at(59)); terminalDenied(value, until); terminalDenied(value, at(351)); terminalDenied(value, '2027-09-01T00:00:00Z');
  assert.equal(value.terminalVerifier.verify(value.terminalBytes, '2026-09-04T12:02:29.999999999Z').state, 'verified-terminal-replay');
  // Fresh terminal evidence cannot extend an expired original human/action proof.
  const extended = terminalFixture({ edits: Object.fromEntries(['completion', 'terminal-head', 'terminal-replay', 'terminal-reservation',
    'current-head', 'current-replay', 'current-reservation'].map((name) => [name, (record) => { record.validThrough = at(200); }])) });
  terminalDenied(extended, until);
  for (const name of ['completion', 'terminal-head', 'terminal-replay', 'terminal-reservation', 'current-head', 'current-replay', 'current-reservation'])
    terminalDenied(terminalFixture({ edits: { [name]: (record) => { record.recordedAt = at(71); } } }));
  terminalDenied(terminalFixture({ edits: { 'current-head': (record) => { record.recordedAt = at(51); } } }));
});

test('0077: sealed graph still needs every original human, action, receipt and checkpoint proof', () => {
  for (const mutate of [
    (graph) => { graph.tombstone.receiptBytes = '{}'; },
    (graph) => { graph.tombstone.humanBundleBytes = '{}'; },
    (graph) => { graph.copies[0].actionBundleBytes = '{}'; },
    (graph) => { graph.copies[0].receiptBytes = '{}'; },
    (graph) => { graph.continuationBytes = '{}'; },
    (graph) => { graph.aggregateBytes = '{}'; },
    (graph) => { const raw = JSON.parse(graph.rawPolicyBytes); raw.humanBundleBytes = '{}'; graph.rawPolicyBytes = jcs(raw); },
  ]) terminalDenied(terminalFixture({ edits: { envelope: (input) => {
    const graph = JSON.parse(input.graphBytes); mutate(graph); input.graphBytes = jcs(graph);
    // Re-sign the seal to ensure rejection is not merely its graph hash mismatch.
    input.completionBytes = jcs(seal({ ...JSON.parse(input.completionBytes), graphDigest: sha256(input.graphBytes) }, 'authority'));
  } } }));
});

test('0077: malformed, forged, wrong-domain and oversized terminal evidence fails closed', () => {
  for (const mutate of [
    (input) => { input.extra = true; }, (input) => { input.version = 'steer-raw-checkpoint/v2'; },
    (input) => { input.graphBytes += ' '; }, (input) => { input.observedAt = at(71); },
    (input) => { input.completionBytes = jcs(seal(JSON.parse(input.completionBytes), 'provider')); },
    (input) => { const record = JSON.parse(input.completionBytes); record.signature.valueBase64 = Buffer.alloc(64).toString('base64'); input.completionBytes = jcs(record); },
    (input) => { input.currentStoreBytes = input.terminalStoreBytes; },
    (input) => { input.graphBytes = ' '.repeat(16777217); },
  ]) terminalDenied(terminalFixture({ edits: { envelope: mutate } }));
  const value = terminalFixture(); terminalDenied({ ...value, terminalBytes: ' '.repeat(25165825) });
});

const futureCases = [
  { runtimeYear: 2027, recordClass: 'RC-SECURITY-AUDIT', eventType: 'event-committed' },
  { runtimeYear: 2029, recordClass: 'RC-CORPUS-BASELINE', eventType: 'corpus-retired' },
  { runtimeYear: 2033, recordClass: 'RC-DECISION-PROOF', eventType: 'item-closed' },
  { runtimeYear: 2033, recordClass: 'RC-LEGAL-SIGNED-LOG', eventType: 'item-closed' },
];
test('0080: full one-, three- and seven-year lifecycle evidence composes historical facts with current human/actions/providers', () => {
  for (const options of futureCases) for (const replay of [false, true]) {
    const value = fixture({ ...options, replay }), result = value.verifier.verify(value.bytes, value.evaluationTime);
    assert.equal(result.state, 'validated-lifecycle-candidate', `${options.recordClass}/${replay}`);
    assert.equal(result.boundaryAt, `${options.runtimeYear}-09-04T12:00:00Z`);
    assert.equal(result.copyCount, 2); assert.equal(result.protectedActionCount, 3); assert.equal(result.replayCount, replay ? 3 : 0);
    assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
    assert.equal(result.historicalEvidenceDigest, sha256(value.graph.historicalEvidenceBytes));
    assert.equal(createLifecycleGraphVerifier(value.configBytes).verify(value.bytes, value.evaluationTime).state, 'blocked');
  }
});

test('0080: exact retention boundary still schedules before expiry and cannot admit premature disposition', () => {
  for (const options of futureCases) {
    const before = fixture({ ...options, runtimeEpoch: `${options.runtimeYear}-09-04T11:59:00Z`,
      evaluationTime: `${options.runtimeYear}-09-04T11:59:59.999999999Z` });
    assert.equal(before.verifier.verify(before.bytes, before.evaluationTime).state, 'scheduled');
    const exact = fixture({ ...options, runtimeEpoch: `${options.runtimeYear}-09-04T11:59:00Z`,
      evaluationTime: `${options.runtimeYear}-09-04T12:00:00Z` });
    denied(exact, exact.evaluationTime); // Existing receipts are before the boundary.
    const premature = fixture({ ...options, edits: { 'copy-1:operation': (operation) => { operation.requestedAt = `${options.runtimeYear}-09-04T11:59:59.999999999Z`; } } });
    denied(premature, premature.evaluationTime);
  }
});

test('0080: every current copy and separate tombstone retains full human/action/receipt proof requirements', () => {
  for (const label of ['copy-1', 'copy-2', 'tombstone']) {
    for (const mutate of [
      (entry) => { entry.humanBundleBytes = '{}'; }, (entry) => { entry.actionBundleBytes = '{}'; }, (entry) => { entry.receiptBytes = '{}'; },
    ]) {
      const value = fixture({ ...futureCases[2], edits: { graph: (graph) => { mutate(label === 'tombstone' ? graph.tombstone : graph.copies.find((entry) => entry.copyId === label)); } } });
      denied(value, value.evaluationTime);
    }
    const value = fixture({ ...futureCases[2], edits: { [`${label}:reservation`]: (record) => { record.winner = false; } } }); denied(value, value.evaluationTime);
  }
  for (const [name, field, replacement] of [['inventory', 'complete', false], ['state', 'historyComplete', false], ['aggregate', 'allCopiesGone', false],
    ['copy-1:resources', 'provider', 'other-provider'], ['copy-1:receipt', 'requestDigest', 'f'.repeat(64)], ['tombstone:human', 'conditions', []]]) {
    const value = fixture({ ...futureCases[2], edits: { [name]: (record) => { record[field] = replacement; } } }); denied(value, value.evaluationTime);
  }
});

test('0080: historical facts cannot suppress current holds, active references or expired current authority', () => {
  for (const field of ['holdState', 'referenceState']) {
    const value = fixture({ ...futureCases[2], edits: { state: (state) => { state[field] = 'active'; } } });
    const result = value.verifier.verify(value.bytes, value.evaluationTime); assert.equal(result.state, 'retained-on-hold'); assert.deepEqual(result.effects, zeroEffects());
  }
  for (const name of ['copy-1:human', 'copy-2:human', 'tombstone:human']) {
    const value = fixture({ ...futureCases[2], edits: { [name]: (authority) => { authority.expiresAt = '2033-09-04T12:00:50Z'; } } }); denied(value, value.evaluationTime);
  }
  const value = fixture(futureCases[2]); denied(value, '2033-09-04T12:02:30Z');
});

test('0080: archive byte/record/scope bindings and current witnesses are mandatory in the actual graph path', () => {
  for (const [name, field, replacement] of [['historical-attestation', 'historyDigest', 'f'.repeat(64)], ['historical-receipt', 'complete', false],
    ['historical-receipt', 'retainedBytesDigest', 'f'.repeat(64)], ['historical-envelope', 'historyBytes', []],
    ['historical-attestation', 'validThrough', '2033-09-04T12:00:50Z']]) {
    const value = fixture({ ...futureCases[2], edits: { [name]: (record) => { record[field] = replacement; } } }); denied(value, value.evaluationTime);
  }
  const value = fixture({ ...futureCases[2], edits: { graph: (graph) => { delete graph.historicalEvidenceBytes; } } }); denied(value, value.evaluationTime);
  for (const domain of ['record', 'provider']) {
    const revoked = fixture({ ...futureCases[2], edits: { 'runtime-registry': (registry) => {
      registry.bindings.find((key) => key.keyId === `${domain}-key-v1`).revokedAt = '2028-01-01T00:00:00Z';
    } } }); denied(revoked, revoked.evaluationTime);
  }
});

test('0080: independently selected runtime cannot change provider identities, mismatch archives or extend old keys', () => {
  for (const [field, replacement] of [['account', 'other'], ['provider', 'other'], ['tenant', 'other'], ['proofIssuer', 'other'], ['publicKeyHex', 'f'.repeat(64)]])
    assert.throws(() => fixture({ ...futureCases[2], edits: { 'runtime-providers': (providers) => { providers.bindings[0][field] = replacement; } } }), /LIFECYCLE_RUNTIME_CONFIGURATION_INVALID/);
  assert.throws(() => fixture({ ...futureCases[2], edits: { 'runtime-providers': (providers) => { providers.bindings.pop(); } } }), /LIFECYCLE_RUNTIME_CONFIGURATION_INVALID/);
  assert.throws(() => fixture({ ...futureCases[2], edits: { 'runtime-registry': (registry) => { registry.bindings[0].notAfter = '2040-01-01T00:00:00Z'; } } }), /LIFECYCLE_RUNTIME_CONFIGURATION_INVALID/);
  assert.throws(() => fixture({ ...futureCases[2], edits: { 'historical-context': (context) => { context.recordId = 'other'; } } }), /LIFECYCLE_CONFIGURATION_INVALID/);
  assert.throws(() => fixture({ ...futureCases[2], edits: { runtime: (runtime) => { runtime.extra = true; } } }), /LIFECYCLE_RUNTIME_CONFIGURATION_INVALID/);
  assert.throws(() => fixture({ runtimeYear: 2033, recordClass: 'RC-CORPUS-RAW-WORKING' }), /LIFECYCLE_CONFIGURATION_INVALID/);
  assert.throws(() => fixture({ runtimeYear: 2029, recordClass: 'RC-REFERENCED-EVIDENCE', eventType: 'item-closed' }), /LIFECYCLE_CONFIGURATION_INVALID/);
  const value = fixture({ ...futureCases[2], edits: { graph: (graph) => { graph.runtimeBytes = '{}'; } } }); denied(value, value.evaluationTime);
});

test('0080: exact selected provider keys and available-before-state archive proofs cannot be substituted', () => {
  for (const label of ['copy-1', 'copy-2', 'tombstone']) for (const field of ['oldProviderResources', 'oldProviderReceipts']) {
    const value = fixture({ ...futureCases[2], [field]: [label] }); denied(value, value.evaluationTime);
  }
  const late = fixture({ ...futureCases[2], edits: {
    'historical-attestation': (record) => { record.recordedAt = '2033-09-04T12:00:20Z'; },
    'historical-receipt': (record) => { record.recordedAt = '2033-09-04T12:00:21Z'; },
  } }); denied(late, late.evaluationTime);
  const release = fixture({ ...futureCases[2], edits: { state: (state) => { state.holdState = 'released'; } } }); denied(release, release.evaluationTime);
});

const holdSuffix = [{ type: 'hold-applied', second: -10 }, { type: 'hold-released', second: -5 }];
const referenceOptions = { runtimeYear: 2029, recordClass: 'RC-REFERENCED-EVIDENCE', eventType: 'item-closed', referenceRuntime: true,
  qualifiedDecisions: true, archivedOwners: true, currentHistory: [] };
function referenceLifecycleFixture(edits = {}, options = {}) { return fixture({ ...referenceOptions, ...options, edits }); }
test('0089: full referenced-evidence lifecycle verifies both copy hashes, removal, independent actions and named tombstone', () => {
  for (const runtimeYear of [2029, 2033]) for (const replay of [false, true]) {
    const value = referenceLifecycleFixture({}, { runtimeYear, replay });
    const result = value.verifier.verify(value.bytes, value.evaluationTime);
    assert.equal(result.state, 'validated-lifecycle-candidate'); assert.equal(result.copyCount, 2); assert.equal(result.protectedActionCount, 3);
    assert.equal(result.referenceCount, 2); assert.equal(result.tombstoneRecordId, 'tombstone-evidence-1'); assert.equal(result.replayCount, replay ? 3 : 0);
    assert.equal(result.referenceEvidenceDigest, sha256(value.graph.referenceRevocationBytes)); assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
    assert.deepEqual(createReferenceLifecycleVerifier(value.configBytes, value.runtimeBytes).verify(value.bytes, value.evaluationTime), result);
  }
});
const qualifiedOptions = { ...futureCases[2], qualifiedDecisions: true, currentHistory: holdSuffix };
test('0089: missing reference evidence retains while partial, reappeared or substituted evidence blocks', () => {
  const missing = referenceLifecycleFixture({ graph: (graph) => { graph.referenceRevocationBytes = ''; } });
  const result = missing.verifier.verify(missing.bytes, missing.evaluationTime);
  assert.equal(result.state, 'retained-pending-safe-disposition'); assert.equal(result.firstError, 'REFERENCE_EVIDENCE_REQUIRED');
  assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
  for (const field of ['contentBytes', 'eventBytes', 'humanBundleBytes', 'completionBytes']) {
    const value = referenceLifecycleFixture({ graph: (graph) => { const record = JSON.parse(graph.referenceRevocationBytes); record[field] = '{}'; graph.referenceRevocationBytes = jcs(record); } }); denied(value, value.evaluationTime);
  }
  for (const edits of [
    { envelope: (record) => { record.referenceReceiptBytes.pop(); } },
    { 'receipt-0': (record) => { record.remainingMatches = 1; } },
    { completion: (record) => { record.remainingReferenceIds = ['reference-1']; } },
    { completion: (record) => { record.recordedAt = '2029-09-04T12:00:03Z'; } },
    { content: { retention: (record) => { record.complete = false; } } },
  ]) { const value = referenceLifecycleFixture({}, { referenceEdits: edits }); denied(value, value.evaluationTime); }
  for (const edits of [
    { state: (record) => { record.referenceRevocationDigest = 'f'.repeat(64); } },
    { 'combined-history': (records) => { records.pop(); } },
    { 'combined-history': (records) => { records.push(records.at(-1)); } },
    { graph: (record) => { record.referenceRevocationBytes = jcs({ decision: 'authorized' }); } },
  ]) { const value = referenceLifecycleFixture(edits); denied(value, value.evaluationTime); }
});

test('0089: complete version and content hashes bind every copy and provider resource', () => {
  const omitted = referenceLifecycleFixture({ graph: (graph) => { const inventory = JSON.parse(graph.inventoryBytes); delete inventory.copies[0].objectSha256; graph.inventoryBytes = jcs(runtimeSeal(inventory, 'record')); } });
  denied(omitted, omitted.evaluationTime);
  for (const mutate of [(copies) => copies.pop(),
    (copies) => { copies[0].objectSha256 = 'f'.repeat(64); }, (copies) => { copies[0].versionId = 'unknown'; },
    (copies) => { copies[1].versionId = copies[0].versionId; copies[1].objectSha256 = copies[0].objectSha256; },
    (copies) => { copies[0].sourceOriginal = true; }]) {
    const value = referenceLifecycleFixture({ copies: mutate }); denied(value, value.evaluationTime);
  }
  for (const label of ['copy-1', 'copy-2']) {
    const value = referenceLifecycleFixture({ [`${label}:resources`]: (record) => { record.resources.objectSha256 = 'f'.repeat(64); } }); denied(value, value.evaluationTime);
  }
});

test('0089: copy and named tombstone each require independent complete human, shared action and terminal receipt', () => {
  for (const label of ['copy-1', 'copy-2', 'tombstone']) {
    for (const field of ['humanBundleBytes', 'actionBundleBytes', 'receiptBytes']) {
      const value = referenceLifecycleFixture({ graph: (graph) => { (label === 'tombstone' ? graph.tombstone : graph.copies.find((entry) => entry.copyId === label))[field] = '{}'; } });
      denied(value, value.evaluationTime);
    }
    const losing = referenceLifecycleFixture({ [`${label}:reservation`]: (record) => { record.winner = false; } }); denied(losing, losing.evaluationTime);
    for (const field of ['oldProviderResources', 'oldProviderReceipts']) {
      const value = referenceLifecycleFixture({}, { [field]: [label] }); denied(value, value.evaluationTime);
    }
  }
  for (const field of ['tombstoneRecordId', 'verificationBundleDigest']) {
    const value = referenceLifecycleFixture({ 'tombstone:resources': (record) => { record.resources[field] = field === 'tombstoneRecordId' ? 'other-tombstone' : 'f'.repeat(64); } }); denied(value, value.evaluationTime);
  }
  const conditions = referenceLifecycleFixture({ 'tombstone:human': (record) => { record.conditions = record.conditions.filter((condition) => !condition.startsWith('tombstone:')); } });
  denied(conditions, conditions.evaluationTime);
});

test('0089: current and retained historical qualified holds cannot be bypassed by reference clearance', () => {
  const currentHistory = [{ type: 'hold-applied', second: -40 }, { type: 'hold-released', second: -35 }];
  for (const historyOptions of [{ currentHistory }, { history: archiveHoldHistory }]) {
    const value = referenceLifecycleFixture({ state: (record) => { record.holdState = 'released'; } }, { ...historyOptions, referenceHoldState: 'released' });
    assert.equal(value.verifier.verify(value.bytes, value.evaluationTime).state, 'validated-lifecycle-candidate');
    const mismatch = referenceLifecycleFixture({ state: (record) => { record.holdState = 'released'; } }, historyOptions); denied(mismatch, mismatch.evaluationTime);
  }
  const active = referenceLifecycleFixture({ state: (record) => { record.holdState = 'active'; } }, { currentHistory: currentHistory.slice(0, 1), referenceHoldState: 'active' });
  const result = active.verifier.verify(active.bytes, active.evaluationTime);
  assert.equal(result.state, 'retained-on-hold'); assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
  const concealed = referenceLifecycleFixture({}, { currentHistory: currentHistory.slice(0, 1) }); denied(concealed, concealed.evaluationTime);
  const futureRelease = referenceLifecycleFixture({ state: (record) => { record.holdState = 'released'; } }, {
    currentHistory: [currentHistory[0], { type: 'hold-released', second: -8 }], referenceHoldState: 'released' });
  denied(futureRelease, futureRelease.evaluationTime);
  const references = referenceLifecycleFixture({ state: (record) => { record.referenceState = 'active'; } });
  assert.equal(references.verifier.verify(references.bytes, references.evaluationTime).state, 'retained-on-hold');
});

test('0089: exact three-year retention boundary cannot admit premature copy disposition', () => {
  const options = { runtimeEpoch: '2029-09-04T11:59:00Z' };
  const before = referenceLifecycleFixture({}, { ...options, evaluationTime: '2029-09-04T11:59:59.999999999Z' });
  assert.equal(before.verifier.verify(before.bytes, before.evaluationTime).state, 'scheduled');
  const boundary = referenceLifecycleFixture({}, { ...options, evaluationTime: '2029-09-04T12:00:00Z' }); denied(boundary, boundary.evaluationTime);
  const premature = referenceLifecycleFixture({ 'copy-1:operation': (record) => { record.requestedAt = '2029-09-04T11:59:59.999999999Z'; } }); denied(premature, premature.evaluationTime);
  const expired = referenceLifecycleFixture(); denied(expired, '2029-09-04T12:02:30Z');
});

test('0089: reference owner authority and provider identity cannot be reused for later copy approval', () => {
  const source = referenceLifecycleFixture(), proof = JSON.parse(source.graph.referenceRevocationBytes), human = JSON.parse(proof.humanBundleBytes), authority = JSON.parse(human.authorityBytes);
  for (const field of ['authorityId', 'providerRecordId', 'idempotencyKey']) {
    const value = referenceLifecycleFixture({ 'copy-1:human': (record) => { record[field] = authority[field]; } }); denied(value, value.evaluationTime);
  }
});

test('0089: trusted reference runtime is class-specific and cannot downgrade or mismatch its independently selected context', () => {
  const value = referenceLifecycleFixture(), runtime = JSON.parse(value.runtimeBytes);
  for (const version of ['steer-lifecycle-runtime/v1', 'steer-lifecycle-runtime/v4'])
    assert.throws(() => createReferenceLifecycleVerifier(value.configBytes, jcs({ ...runtime, version })), /REFERENCE_LIFECYCLE_CONFIGURATION_INVALID/);
  for (const mutate of [(record) => { delete record.referenceContextBytes; }, (record) => { record.referenceContextBytes = '{}'; }])
    assert.throws(() => referenceLifecycleFixture({ runtime: mutate }), /LIFECYCLE_RUNTIME_CONFIGURATION_INVALID/);
  for (const recordClass of ['RC-DECISION-PROOF', 'RC-CORPUS-RAW-WORKING'])
    assert.throws(() => referenceLifecycleFixture({}, { recordClass }), /LIFECYCLE_CONFIGURATION_INVALID/);
  assert.throws(() => referenceLifecycleFixture({}, { referenceEdits: { context: (record) => { record.environmentId = 'other'; } } }), /LIFECYCLE_CONFIGURATION_INVALID/);
  assert.throws(() => referenceLifecycleFixture({}, { referenceEdits: { content: { context: (record) => { record.repositoryId = 'other'; } } } }), /LIFECYCLE_RUNTIME_CONFIGURATION_INVALID/);
  const downgrade = referenceLifecycleFixture({ graph: (record) => { record.version = 'steer-lifecycle-graph/current-v4'; } }); denied(downgrade, downgrade.evaluationTime);
});
function qualifiedFixture(edits = {}, options = {}) {
  return fixture({ ...qualifiedOptions, ...options, edits: { state: (state) => { state.holdState = 'released'; }, ...edits } });
}
function inspectQualified(value) {
  const runtime = JSON.parse(value.runtimeBytes), archival = runtime.version === 'steer-lifecycle-runtime/v4';
  const verifier = createQualifiedHistoryVerifier(runtime.historicalContextBytes, runtime.archivedOwnerContextBytes);
  const envelope = { version: archival ? 'steer-qualified-history/v2' : 'steer-qualified-history/v1', policyDigest: verifier.policyDigest, archivedEvidenceBytes: value.graph.historicalEvidenceBytes,
    eventBytes: value.graph.eventBytes, historyBytes: value.graph.historyBytes, qualifiedDecisionBytes: value.graph.qualifiedDecisionBytes,
    ...(archival ? { archivedOwnerBytes: value.graph.archivedOwnerBytes } : {}) };
  return { verifier, envelope, result: verifier.verify(jcs(envelope), value.evaluationTime) };
}
const archiveHoldHistory = [{ type: 'record-committed', second: -30 }, { type: 'hold-applied', second: -20 }, { type: 'hold-released', second: -10 }];
function archivedFixture(edits = {}, options = {}) {
  return qualifiedFixture(edits, { archivedOwners: true, history: archiveHoldHistory, currentHistory: [], ...options });
}
function inspectArchived(value) {
  const runtime = JSON.parse(value.runtimeBytes), verifier = createArchivedOwnerVerifier(runtime.historicalContextBytes, runtime.archivedOwnerContextBytes);
  return { verifier, result: verifier.verify(value.graph.archivedOwnerBytes, value.evaluationTime) };
}
test('0084: complete historical owner records and fresh independent retention compose with current lifecycle authority', () => {
  for (const options of futureCases) for (const replay of [false, true]) {
    const value = archivedFixture({}, { ...options, replay });
    const records = inspectArchived(value).result;
    assert.equal(records.state, 'verified-archived-owner-records'); assert.equal(records.decisions.length, 2);
    assert.equal(records.factOnly, true); assert.equal(records.executionAuthorized, false); assert.deepEqual(records.effects, zeroEffects());
    const history = inspectQualified(value).result;
    assert.equal(history.state, 'verified-qualified-history'); assert.equal(history.archivedDecisionCount, 2);
    const result = value.verifier.verify(value.bytes, value.evaluationTime);
    assert.equal(result.state, 'validated-lifecycle-candidate'); assert.equal(result.replayCount, replay ? 3 : 0);
    assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
  }
  const mixed = archivedFixture({}, { currentHistory: holdSuffix });
  assert.equal(inspectQualified(mixed).result.qualifiedDecisionCount, 4);
  assert.equal(mixed.verifier.verify(mixed.bytes, mixed.evaluationTime).state, 'validated-lifecycle-candidate');
  const crossing = archivedFixture({}, { history: archiveHoldHistory.slice(0, 2), currentHistory: [holdSuffix[1]] });
  assert.equal(inspectQualified(crossing).result.archivedDecisionCount, 1);
  assert.equal(crossing.verifier.verify(crossing.bytes, crossing.evaluationTime).state, 'validated-lifecycle-candidate');
  const spaced = archivedFixture({}, { history: [{ type: 'record-committed', second: -2000 }, { type: 'hold-applied', second: -1000 }, { type: 'hold-released', second: -10 }] });
  assert.equal(spaced.verifier.verify(spaced.bytes, spaced.evaluationTime).state, 'validated-lifecycle-candidate');
});

test('0084: every original signed owner record is required and reverified, not replaced by current attestation', () => {
  for (const index of [2, 3]) for (const field of ['authorityBytes', 'providerProofBytes', 'identityEvidenceBytes', 'qualificationEvidenceBytes',
    'assignmentEvidenceBytes', 'inventoryBytes', 'replayLedgerBytes', 'casHeadBytes', 'casReservationBytes']) for (const forge of [false, true]) {
    const value = archivedFixture({ [`qualified-${index}:bundle`]: (bundle) => {
      if (!forge) bundle[field] = '{}';
      else { const record = JSON.parse(bundle[field]); record.signature.valueBase64 = Buffer.alloc(64).toString('base64'); bundle[field] = jcs(record); }
    } });
    assert.equal(inspectArchived(value).result.state, 'blocked'); denied(value, value.evaluationTime);
  }
});

test('0084: exact archive pins, complete ordered owner rows and full event bindings are mandatory', () => {
  for (const mutate of [(rows) => rows.pop(), (rows) => rows.reverse(), (rows) => rows.push(rows[0]),
    (rows) => { rows[0].eventId = rows[1].eventId; }, (rows) => { rows[0].extra = true; }]) {
    const value = archivedFixture({ 'archived-decisions': mutate }); denied(value, value.evaluationTime);
  }
  const pin = archivedFixture({ 'archived-owner-context': (record) => { record.decisionBytesDigest = 'f'.repeat(64); } }); denied(pin, pin.evaluationTime);
  for (const [name, field, replacement] of [
    ['event-2', 'actorId', 'human:other'], ['event-3', 'actorAuthority', 'other-hat'], ['event-3', 'releaseAuthority', 'other-authority'],
    ['qualified-3:authority', 'previousHoldEventDigest', 'f'.repeat(64)], ['qualified-2:authority', 'eventBindingDigest', 'f'.repeat(64)],
    ['qualified-3:authority', 'safeguards', []], ['qualified-2:authority', 'conditions', []],
  ]) {
    const value = archivedFixture({ [name]: (record) => { record[field] = replacement; } }); denied(value, value.evaluationTime);
  }
  for (const mutate of [(record) => { record.historicalContextDigest = 'f'.repeat(64); },
    (record) => { record.archiveReference.revision = 'f'.repeat(40); }, (record) => { record.archiveReference.path = '../owners.json'; },
    (record) => { record.extra = true; }])
    assert.throws(() => archivedFixture({ 'archived-owner-context': mutate }), /LIFECYCLE_RUNTIME_CONFIGURATION_INVALID/);
});

test('0084: per-decision original observation cannot precede its event, exceed the archive or revive expired authority', () => {
  for (const observed of ['2026-09-04T11:59:39.999999999Z', '2026-09-04T12:00:50.000000001Z', '2033-09-04T12:00:50Z']) {
    const value = archivedFixture({ 'qualified-2:bundle': (bundle) => { bundle.evaluationTime = observed; } }); denied(value, value.evaluationTime);
  }
  for (const [name, field, replacement] of [
    ['qualified-2:authority', 'expiresAt', '2026-09-04T11:59:50Z'],
    ['qualified-3:authority', 'decidedAt', '2026-09-04T11:59:39Z'],
    ['qualified-2:casReservationBytes', 'recordedAt', '2026-09-04T11:59:40.000000001Z'],
    ['qualified-3:assignmentEvidenceBytes', 'status', 'revoked'],
  ]) {
    const value = archivedFixture({ [name]: (record) => { record[field] = replacement; } }); denied(value, value.evaluationTime);
  }
  const value = archivedFixture(), check = inspectArchived(value);
  assert.equal(check.verifier.verify(value.graph.archivedOwnerBytes).state, 'blocked');
});

test('0084: revocation known now denies every old owner role without renewing expired historical keys', () => {
  for (const domain of ['authority', 'human-provider', 'provider', 'assignment', 'record', 'replay-authority', 'cas-authority']) {
    const value = archivedFixture({ 'runtime-registry': (registry) => {
      registry.bindings.find((key) => key.keyId === `${domain}-key-v1`).revokedAt = '2028-01-01T00:00:00Z';
    } }); denied(value, value.evaluationTime);
  }
  for (const field of ['notAfter', 'publicKeyHex']) assert.throws(() => archivedFixture({ 'runtime-registry': (registry) => {
    registry.bindings.find((key) => key.keyId === 'human-provider-key-v1')[field] = field === 'notAfter' ? '2040-01-01T00:00:00Z' : 'f'.repeat(64);
  } }), /LIFECYCLE_RUNTIME_CONFIGURATION_INVALID/);
  assert.throws(() => archivedFixture({ 'runtime-registry': (registry) => {
    registry.bindings.find((key) => key.keyId === 'human-provider-key-current').publicKeyHex = registry.bindings.find((key) => key.keyId === 'authority-key-current').publicKeyHex;
  } }), /LIFECYCLE_RUNTIME_CONFIGURATION_INVALID/);
});

test('0084: fresh independent archive witnesses bind retained bytes and must be available before current state', () => {
  for (const [name, field, replacement] of [
    ['owner-attestation', 'decision', 'authorized'], ['owner-attestation', 'source', 'caller'], ['owner-attestation', 'inventoryDigest', 'f'.repeat(64)],
    ['owner-attestation', 'historyDigest', 'f'.repeat(64)], ['owner-attestation', 'decisionCount', 1], ['owner-attestation', 'validThrough', '2033-09-04T12:00:50Z'],
    ['owner-retention', 'attestationDigest', 'f'.repeat(64)], ['owner-retention', 'retainedBytesDigest', 'f'.repeat(64)], ['owner-retention', 'complete', false],
    ['owner-retention', 'recordedAt', '2033-09-04T11:59:57Z'], ['owner-retention', 'validThrough', '2033-09-04T12:02:31Z'],
  ]) {
    const value = archivedFixture({ [name]: (record) => { record[field] = replacement; } }); denied(value, value.evaluationTime);
  }
  for (const field of ['attestationBytes', 'retentionReceiptBytes']) for (const corrupt of [false, true]) {
    const value = archivedFixture({ 'archived-owner-envelope': (envelope) => {
      if (!corrupt) envelope[field] = '{}';
      else { const record = JSON.parse(envelope[field]); record.signature.valueBase64 = Buffer.alloc(64).toString('base64'); envelope[field] = jcs(record); }
    } }); denied(value, value.evaluationTime);
  }
  const wrongRole = archivedFixture({ 'archived-owner-envelope': (envelope) => { envelope.retentionReceiptBytes = jcs(runtimeSeal(JSON.parse(envelope.retentionReceiptBytes), 'authority')); } });
  assert.equal(inspectArchived(wrongRole).result.state, 'blocked');
  const late = archivedFixture({ 'owner-attestation': (record) => { record.recordedAt = '2033-09-04T12:00:03Z'; },
    'owner-retention': (record) => { record.recordedAt = '2033-09-04T12:00:04Z'; } });
  assert.equal(inspectArchived(late).result.state, 'verified-archived-owner-records'); denied(late, late.evaluationTime);
});

test('0084: archived decisions cannot authorize or impersonate current holds, copies or tombstones', () => {
  for (const label of ['copy-1', 'copy-2', 'tombstone']) {
    const reused = archivedFixture({ [`${label}:human`]: (record) => { record.providerRecordId = 'qualified-2-provider'; } }); denied(reused, reused.evaluationTime);
    const substituted = archivedFixture({ graph: (graph) => {
      const archived = JSON.parse(JSON.parse(graph.archivedOwnerBytes).decisionBytes)[0].humanBundleBytes;
      (label === 'tombstone' ? graph.tombstone : graph.copies.find((copy) => copy.copyId === label)).humanBundleBytes = archived;
    } }); denied(substituted, substituted.evaluationTime);
  }
  const reused = archivedFixture({ 'qualified-5:authority': (record) => { record.providerRecordId = 'qualified-2-provider'; } }, { currentHistory: holdSuffix });
  denied(reused, reused.evaluationTime);
  const injected = archivedFixture({ graph: (graph) => { graph.qualifiedDecisionBytes = JSON.parse(graph.archivedOwnerBytes).decisionBytes; } }); denied(injected, injected.evaluationTime);
});

test('0084: archival runtime and envelope are closed, pinned, bounded and cannot downgrade to current-only', () => {
  const value = archivedFixture(), check = inspectArchived(value), old = qualifiedFixture();
  assert.notEqual(value.verifier.policyDigest, old.verifier.policyDigest);
  denied({ ...value, verifier: old.verifier }, value.evaluationTime); denied({ ...old, verifier: value.verifier }, old.evaluationTime);
  for (const mutate of [(envelope) => { envelope.extra = true; }, (envelope) => { envelope.policyDigest = 'f'.repeat(64); },
    (envelope) => { envelope.decisionBytes += ' '; }, (envelope) => { envelope.decisionBytes = ' '.repeat(12582913); },
    (envelope) => { envelope.archivedEvidenceBytes = '{}'; }]) {
    const envelope = JSON.parse(value.graph.archivedOwnerBytes); mutate(envelope);
    assert.equal(check.verifier.verify(jcs(envelope), value.evaluationTime).state, 'blocked');
  }
  assert.equal(check.verifier.verify(' '.repeat(16777217), value.evaluationTime).state, 'blocked');
  const missing = archivedFixture({ graph: (graph) => { delete graph.archivedOwnerBytes; } }); denied(missing, missing.evaluationTime);
  const extra = qualifiedFixture({ graph: (graph) => { graph.archivedOwnerBytes = value.graph.archivedOwnerBytes; } }); denied(extra, extra.evaluationTime);
});

test('0083: full qualified owner decisions bind mixed hold history and every future disposition step', () => {
  for (const options of futureCases) for (const replay of [false, true]) {
    const value = qualifiedFixture({}, { ...options, replay });
    const history = inspectQualified(value).result;
    assert.equal(history.state, 'verified-qualified-history'); assert.equal(history.qualifiedDecisionCount, 2);
    assert.equal(history.factOnly, true); assert.equal(history.executionAuthorized, false); assert.deepEqual(history.effects, zeroEffects());
    const result = value.verifier.verify(value.bytes, value.evaluationTime);
    assert.equal(result.state, 'validated-lifecycle-candidate'); assert.equal(result.replayCount, replay ? 3 : 0);
    assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
  }
  const empty = fixture({ ...futureCases[2], qualifiedDecisions: true, currentHistory: [] });
  assert.equal(inspectQualified(empty).result.qualifiedDecisionCount, 0);
  assert.equal(empty.verifier.verify(empty.bytes, empty.evaluationTime).state, 'validated-lifecycle-candidate');
});

test('0083: each current hold needs all nine current qualified proof records and an exact ordered mapping', () => {
  for (const index of [3, 4]) for (const field of ['authorityBytes', 'providerProofBytes', 'identityEvidenceBytes', 'qualificationEvidenceBytes',
    'assignmentEvidenceBytes', 'inventoryBytes', 'replayLedgerBytes', 'casHeadBytes', 'casReservationBytes']) {
    const value = qualifiedFixture({ [`qualified-${index}:bundle`]: (bundle) => { bundle[field] = '{}'; } });
    denied(value, value.evaluationTime);
  }
  for (const mutate of [(rows) => rows.pop(), (rows) => rows.reverse(), (rows) => rows.push(rows[0]),
    (rows) => { rows[0].eventId = rows[1].eventId; }, (rows) => { rows[0].extra = true; }]) {
    const value = qualifiedFixture({ 'qualified-proofs': mutate }); denied(value, value.evaluationTime);
  }
  const missing = qualifiedFixture({ graph: (graph) => { delete graph.qualifiedDecisionBytes; } }); denied(missing, missing.evaluationTime);
});

test('0083: independently signed actor, event, selector and predecessor substitutions fail closed', () => {
  const mutations = [
    ['event-3', 'actorId', 'human:other'], ['event-3', 'actorAuthority', 'other-hat'], ['event-3', 'reasonAuthority', 'other-owner-record'],
    ['event-3', 'selectorsSha256', 'f'.repeat(64)], ['event-4', 'releaseAuthority', 'other-owner-record'], ['event-4', 'holdId', 'other-hold'],
    ['qualified-3:authority', 'eventBindingDigest', 'f'.repeat(64)], ['qualified-3:authority', 'eventId', '00000000-0000-4000-8000-000000000099'],
    ['qualified-4:authority', 'previousHoldEventDigest', 'f'.repeat(64)], ['qualified-4:authority', 'holdState', 'none'],
    ['qualified-3:authority', 'conditions', []], ['qualified-4:authority', 'safeguards', []],
  ];
  for (const [name, field, replacement] of mutations) {
    const value = qualifiedFixture({ [name]: (record) => { record[field] = replacement; } }); denied(value, value.evaluationTime);
  }
  for (const field of ['recordId', 'recordClass', 'artifactRevision', 'selectorDigest']) {
    const value = qualifiedFixture({ 'qualified-4:inventoryBytes': (record) => { record.items[0][field] = field.endsWith('Digest') ? 'f'.repeat(64) : field === 'artifactRevision' ? 'f'.repeat(40) : 'other'; } });
    denied(value, value.evaluationTime);
  }
});

test('0083: approval must precede event commitment, follow the prior hold and remain currently valid', () => {
  for (const [name, field, replacement] of [
    ['qualified-3:casReservationBytes', 'recordedAt', '2033-09-04T11:59:50.000000001Z'],
    ['qualified-4:authority', 'decidedAt', '2033-09-04T11:59:49Z'],
    ['qualified-3:authority', 'expiresAt', '2033-09-04T12:00:50Z'],
    ['qualified-4:identityEvidenceBytes', 'verifiedAt', '2033-09-04T11:55:49Z'],
  ]) {
    const value = qualifiedFixture({ [name]: (record) => { record[field] = replacement; } }); denied(value, value.evaluationTime);
  }
  const value = qualifiedFixture(), check = inspectQualified(value);
  assert.equal(check.verifier.verify(jcs(check.envelope)).state, 'blocked');
  assert.equal(check.verifier.verify(jcs(check.envelope), '2033-09-04T12:00:51Z').state, 'blocked');
});

test('0083: qualified approvals cannot reuse other hold or copy/tombstone authority identities', () => {
  for (const [field, replacement] of [['authorityId', 'qualified-3'], ['providerRecordId', 'qualified-3-provider'], ['idempotencyKey', 'qualified-3-idem']]) {
    const value = qualifiedFixture({ 'qualified-4:authority': (record) => { record[field] = replacement; },
      ...(field === 'authorityId' ? { 'event-4': (record) => { record.releaseAuthority = replacement; } } : {}) }); denied(value, value.evaluationTime);
  }
  const reservation = qualifiedFixture({ 'qualified-4:casReservationBytes': (record) => { record.reservationId = 'qualified-3-reservation'; } }); denied(reservation, reservation.evaluationTime);
  const head = qualifiedFixture({
    'qualified-4:authority': (record) => { record.casHead = sha256('qualified-3-head'); },
    'qualified-4:casHeadBytes': (record) => { record.headId = 'qualified-3-head'; },
  }); denied(head, head.evaluationTime);
  for (const label of ['copy-1', 'copy-2', 'tombstone']) for (const [field, replacement] of [['authorityId', 'qualified-3'], ['providerRecordId', 'qualified-3-provider'], ['idempotencyKey', 'qualified-3-idem']]) {
    const value = qualifiedFixture({ [`${label}:human`]: (record) => { record[field] = replacement; } }); denied(value, value.evaluationTime);
  }
  for (const label of ['copy-1', 'copy-2', 'tombstone']) {
    const value = qualifiedFixture({ [`${label}:human-bundle`]: (bundle) => {
      const reservation = JSON.parse(bundle.casReservationBytes); reservation.reservationId = 'qualified-3-reservation';
      bundle.casReservationBytes = jcs(runtimeSeal(reservation, 'cas-authority'));
    } }); denied(value, value.evaluationTime);
  }
});

test('0083: restrictive historical applications survive, while unqualified archived releases remain blocked', () => {
  const historicalApply = qualifiedFixture({}, { history: [{ type: 'record-committed', second: -20 }, { type: 'hold-applied', second: -10 }], currentHistory: [holdSuffix[1]] });
  assert.equal(inspectQualified(historicalApply).result.qualifiedDecisionCount, 1);
  assert.equal(historicalApply.verifier.verify(historicalApply.bytes, historicalApply.evaluationTime).state, 'validated-lifecycle-candidate');
  const historicalRelease = qualifiedFixture({}, { history: [{ type: 'record-committed', second: -30 }, { type: 'hold-applied', second: -20 }, { type: 'hold-released', second: -10 }], currentHistory: [] });
  denied(historicalRelease, historicalRelease.evaluationTime);
  const active = qualifiedFixture({ state: (state) => { state.holdState = 'active'; } }, { currentHistory: [holdSuffix[0]] });
  assert.equal(active.verifier.verify(active.bytes, active.evaluationTime).state, 'retained-on-hold');
});

test('0083: explicit version, policy and byte bounds prevent downgrade or proof injection', () => {
  const value = qualifiedFixture(), old = fixture({ ...qualifiedOptions, qualifiedDecisions: false, edits: { state: (state) => { state.holdState = 'released'; } } });
  assert.notEqual(value.verifier.policyDigest, old.verifier.policyDigest);
  denied({ ...value, verifier: old.verifier }, value.evaluationTime); denied({ ...old, verifier: value.verifier }, old.evaluationTime);
  const check = inspectQualified(value);
  for (const mutate of [(envelope) => { envelope.extra = true; }, (envelope) => { envelope.policyDigest = 'f'.repeat(64); },
    (envelope) => { envelope.qualifiedDecisionBytes += ' '; }, (envelope) => { envelope.qualifiedDecisionBytes = ' '.repeat(12582913); },
    (envelope) => { envelope.qualifiedDecisionBytes = jcs(Array.from({ length: 129 }, () => ({}))); }]) {
    const envelope = structuredClone(check.envelope); mutate(envelope);
    assert.equal(check.verifier.verify(jcs(envelope), value.evaluationTime).state, 'blocked');
  }
});

test('0081: mixed-era history composes exact archived facts and current hold/release events into full future disposition', () => {
  for (const options of futureCases) for (const replay of [false, true]) {
    const value = fixture({ ...options, replay, currentHistory: holdSuffix, edits: { state: (state) => { state.holdState = 'released'; } } });
    const result = value.verifier.verify(value.bytes, value.evaluationTime);
    assert.equal(result.state, 'validated-lifecycle-candidate'); assert.equal(result.replayCount, replay ? 3 : 0);
    assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
    const archived = JSON.parse(value.graph.historicalEvidenceBytes);
    assert.equal(archived.historyBytes.length + 1, 2); assert.equal(value.graph.historyBytes.length + 1, 4);
  }
  const empty = fixture({ ...futureCases[2], currentHistory: [] });
  assert.equal(empty.verifier.verify(empty.bytes, empty.evaluationTime).state, 'validated-lifecycle-candidate');
});

test('0081: active and unmatched current holds cannot disappear behind archived history', () => {
  const active = fixture({ ...futureCases[2], currentHistory: [holdSuffix[0]], edits: { state: (state) => { state.holdState = 'active'; } } });
  assert.equal(active.verifier.verify(active.bytes, active.evaluationTime).state, 'retained-on-hold');
  const concealed = fixture({ ...futureCases[2], currentHistory: [holdSuffix[0]] }); denied(concealed, concealed.evaluationTime);
  const orphan = fixture({ ...futureCases[2], currentHistory: [holdSuffix[1]], edits: { state: (state) => { state.holdState = 'released'; } } }); denied(orphan, orphan.evaluationTime);
  const mismatched = fixture({ ...futureCases[2], currentHistory: holdSuffix, edits: { state: (state) => { state.holdState = 'released'; },
    'event-4': (event) => { event.holdId = 'different'; } } }); denied(mismatched, mismatched.evaluationTime);
});

test('0081: global ordering, prefix preservation and identity uniqueness reject cross-era substitution', () => {
  for (const mutate of [
    (all) => { all.shift(); }, (all) => { [all[0], all[1]] = [all[1], all[0]]; },
    (all) => { all[2] = all[0]; }, (all) => { all.reverse(); },
  ]) {
    const value = fixture({ ...futureCases[2], currentHistory: holdSuffix, edits: { 'combined-history': mutate, state: (state) => { state.holdState = 'released'; } } });
    denied(value, value.evaluationTime);
  }
  for (const [field, replacement] of [['eventId', '00000000-0000-4000-8000-000000000001'], ['providerRecordId', 'provider-event-1'],
    ['recordId', 'other'], ['recordClass', 'RC-REBUILDABLE'], ['artifactRevision', 'f'.repeat(40)], ['policySha256', 'f'.repeat(64)], ['organization', 'other']]) {
    const value = fixture({ ...futureCases[2], currentHistory: holdSuffix, edits: { state: (state) => { state.holdState = 'released'; }, 'event-3': (event) => { event[field] = replacement; } } });
    denied(value, value.evaluationTime);
  }
  const reversal = fixture({ ...futureCases[2], currentHistory: [{ type: 'hold-applied', second: -5 }, { type: 'hold-released', second: -10 }],
    edits: { state: (state) => { state.holdState = 'released'; } } }); denied(reversal, reversal.evaluationTime);
});

test('0081: every current suffix provider proof, current key window and state chronology remains mandatory', () => {
  for (const index of [3, 4]) {
    const value = fixture({ ...futureCases[2], currentHistory: holdSuffix, edits: { state: (state) => { state.holdState = 'released'; },
      [`signed-event-proof-${index}`]: (proof) => { proof.signature.valueBase64 = Buffer.alloc(64).toString('base64'); } } }); denied(value, value.evaluationTime);
  }
  for (const domain of ['record', 'provider']) {
    const value = fixture({ ...futureCases[2], currentHistory: holdSuffix, edits: { state: (state) => { state.holdState = 'released'; },
      'runtime-registry': (registry) => { registry.bindings.find((key) => key.keyId === `${domain}-key-current`).revokedAt = '2033-09-04T12:00:50Z'; } } }); denied(value, value.evaluationTime);
  }
  const lateState = fixture({ ...futureCases[2], currentHistory: [{ type: 'hold-applied', second: 3 }], edits: { state: (state) => { state.holdState = 'active'; } } }); denied(lateState, lateState.evaluationTime);
});

test('0081: mixed history is bounded across both eras and remains fact-only outside the lifecycle', () => {
  const inspect = (value) => {
    const selected = createMixedHistoryVerifier(JSON.parse(value.runtimeBytes).historicalContextBytes);
    const bytes = jcs({ version: 'steer-mixed-history/v1', policyDigest: selected.policyDigest, archivedEvidenceBytes: value.graph.historicalEvidenceBytes,
      eventBytes: value.graph.eventBytes, historyBytes: value.graph.historyBytes });
    return { selected, bytes, result: selected.verify(bytes, value.evaluationTime) };
  };
  const source = fixture({ ...futureCases[2], currentHistory: holdSuffix, edits: { state: (state) => { state.holdState = 'released'; } } });
  const result = inspect(source).result;
  assert.equal(result.state, 'verified-mixed-history'); assert.equal(result.archivedEventCount, 2); assert.equal(result.currentEventCount, 2);
  assert.equal(result.factOnly, true); assert.equal(result.currentActionAuthorityRequired, true); assert.equal(result.executionAuthorized, false); assert.deepEqual(result.effects, zeroEffects());
  const maximum = fixture({ ...futureCases[2], currentHistory: Array.from({ length: 127 }, (_, index) => ({ type: 'record-committed', second: index - 127 })) });
  assert.equal(inspect(maximum).result.currentEventCount, 127);
  const excess = fixture({ ...futureCases[2], currentHistory: Array.from({ length: 128 }, (_, index) => ({ type: 'record-committed', second: index - 128 })) });
  denied(excess, excess.evaluationTime);
  const check = inspect(source); assert.equal(check.selected.verify(' '.repeat(16777217), source.evaluationTime).state, 'blocked');
  assert.equal(check.selected.verify(check.bytes).state, 'blocked');
});

test('0081: old current-v1 graphs do not silently accept the mixed-history contract', () => {
  const mixed = fixture({ ...futureCases[2], currentHistory: [] }), old = fixture(futureCases[2]);
  assert.notEqual(mixed.verifier.policyDigest, old.verifier.policyDigest);
  denied({ ...mixed, verifier: old.verifier }, mixed.evaluationTime);
  denied({ ...old, verifier: mixed.verifier }, old.evaluationTime);
  const bad = fixture({ ...futureCases[2], currentHistory: [], edits: { graph: (graph) => { graph.version = 'steer-lifecycle-graph/current-v1'; } } }); denied(bad, bad.evaluationTime);
  for (const [destination, source] of [['provider-key-current', 'record-key-current'], ['authority-key-current', 'record-key-current'],
    ['record-key-current', 'record-key-v1'], ['provider-a-key-current', 'provider-b-key-current']])
    assert.throws(() => fixture({ ...futureCases[2], currentHistory: [], edits: { 'runtime-registry': (registry) => {
      registry.bindings.find((key) => key.keyId === destination).publicKeyHex = registry.bindings.find((key) => key.keyId === source).publicKeyHex;
    } } }), /LIFECYCLE_RUNTIME_CONFIGURATION_INVALID/);
});

test('0068: provenance manifests are independently timed, closed, complete and exactly matched to every event', () => {
  const defaults = { recordClass: 'RC-CORPUS-PROVENANCE', eventType: 'derived-record-deleted', history: [
    { type: 'corpus-retired', second: -30 }, { type: 'derived-record-deleted', second: -20 },
  ] };
  const mutations = [
    (record) => { record.complete = false; },
    (record) => { record.source = 'caller-manifest'; },
    (record) => { record.corpusId = 'other-corpus'; },
    (record) => { record.corpusVersion = 'other-version'; },
    (record) => { record.recordedAt = at(-1); },
    (record) => { record.recordedAt = at(3); },
    (record) => { record.validThrough = evaluation; },
    (record) => { record.entries.pop(); },
    (record) => { record.entries.push({ derivedRecordId: 'missing', derivedRecordClass: 'RC-CORPUS-EXPORT', deletionEventId: 'missing-event' }); },
    (record) => { record.entries[1].derivedRecordId = record.entries[0].derivedRecordId; },
    (record) => { record.entries[1].deletionEventId = record.entries[0].deletionEventId; },
    (record) => { record.entries[0].derivedRecordClass = 'unknown-class'; },
    (record) => { record.entries[0].derivedRecordClass = 'RC-CORPUS-EXPORT'; },
    (record) => { record.entries[0].derivedRecordId = 'record-1'; },
    (record) => { record.entries[0].unexpected = true; },
    (record) => { record.entries.reverse(); },
  ];
  for (const mutate of mutations) denied(fixture({ ...defaults, edits: { 'derived-inventory': mutate } }));
  denied(fixture({ ...defaults, derivedDomain: 'authority' }));
  denied(fixture({ ...defaults, edits: { state: (state) => { state.derivedInventoryDigest = 'f'.repeat(64); } } }));
  for (const field of ['parentCorpusId', 'parentCorpusVersion'])
    denied(fixture({ ...defaults, edits: { 'event-2': (event) => { event[field] = 'substituted-parent'; } } }));
  denied(fixture({ ...defaults, edits: { 'signed-event-proof-2': (proof) => { proof.signature.valueBase64 = Buffer.alloc(64).toString('base64'); } } }));
  const value = fixture(defaults);
  denied({ ...value, bytes: jcs({ ...value.graph, derivedInventoryBytes: value.graph.derivedInventoryBytes + ' ' }) });
  const expired = '2027-09-01T00:00:00Z'; denied(value, expired);
  denied(fixture({ edits: { graph: (graph) => { graph.derivedInventoryBytes = '{}'; } } }));
});
