// Closed synthetic original-era fixtures adapted from the existing full lifecycle tests.
// Signing, generic construction and all dormant raw/current-era helpers stay private.
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createLifecycleGraphVerifier, createCurrentLifecycleGraphVerifier, createLifecycleReadinessVerifier, createCurrentLifecycleReadinessVerifier, lifecycleBoundary, policyDigest } from '../0061/lifecycle-graph.candidate.mjs';
import { humanAuthorityBindingDigest } from '../0058/human-authority.candidate.mjs';
import { manifestBytes, manifestDigest } from '../0060/protected-actions.candidate.mjs';
import { exactInstant, formatExactInstant } from '../0069/exact-time.candidate.mjs';
import { policyDigest as preterminalPolicy } from '../0073/raw-preterminal.candidate.mjs';
import { policyDigest as rawBatchPolicy } from '../0074/raw-batch.candidate.mjs';
import { policyDigest as checkpointPolicy } from '../0075/raw-checkpoint.candidate.mjs';
import { policyDigest as chainPolicy } from '../0076/raw-checkpoint-chain.candidate.mjs';
import { createRawTerminalVerifier, policyDigest as terminalPolicy } from '../0077/raw-terminal.candidate.mjs';
import { policyDigest as historicalPolicy } from '../0078/historical-events.candidate.mjs';
import { createMixedHistoryVerifier } from '../0081/mixed-history.candidate.mjs';
import { createQualifiedHistoryVerifier } from '../0083/qualified-history.candidate.mjs';
import { createArchivedOwnerVerifier, policyDigest as archivedOwnerPolicy } from '../0084/archived-owner.candidate.mjs';
import { manifestBytes as referenceActionManifestBytes, manifestDigest as referenceActionManifestDigest } from '../0088/reference-actions.candidate.mjs';
import { createReferenceLifecycleVerifier } from '../0089/reference-lifecycle.candidate.mjs';
import { revocationFixture } from '../../tests/fixtures/reference-evidence.mjs';
import { makeHumanAuthorityBundle, makeLifecycleEventBytes, makeLifecycleGraph } from '../0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { jcs, sha256, TRUST_REGISTRY, TARGET_REVISION, TARGET_EXAM_SHA, AUTHORIZATION_POLICY_PATH, AUTHORIZATION_POLICY_SHA, AUTHORIZATION_POLICY_BYTES, RETENTION_POLICY_SHA, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const epoch = Date.parse('2026-12-03T12:00:00Z');
const at = (seconds) => new Date(epoch + seconds * 1000).toISOString().replace('.000Z', 'Z');
const evaluation = at(50), until = at(150);
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
  // Only closed exported adapters select the source fixture's historical clock.
  const epoch = options.fixtureEpoch ?? Date.parse('2026-12-03T12:00:00Z');
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
  let eventBytes = event(type, history.length + 1, options.triggerSecond ?? 0);
  // Explicit test expectation, not a call back into the verifier's selector.
  const trigger = JSON.parse(options.triggerHistoryIndex === undefined ? eventBytes : historyBytes[options.triggerHistoryIndex]);
  let runtimeBytes, historicalEvidenceBytes, archivedOwnerBytes, referenceProof, trustedRegistryBytes = jcs(TRUST_REGISTRY);
  if (options.runtimeYear) {
    const registry = structuredClone(TRUST_REGISTRY);
    for (const key of TRUST_REGISTRY.bindings) registry.bindings.push({ ...key, keyId: `${key.domain}-key-current`,
      publicKeyHex: createPublicKey(runtimeKey(key.domain)).export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex'),
      notBefore: `${options.runtimeYear}-01-01T00:00:00Z`, notAfter: `${options.runtimeYear + 1}-01-01T00:00:00Z`, revokedAt: null });
    edit('runtime-registry', registry); trustedRegistryBytes = jcs(registry);
    const providers = JSON.parse(readFileSync(new URL('../0001/reviews/domain/round-3/remediation/PROVIDER-KEY-REGISTRY.candidate.json', import.meta.url), 'utf8'));
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
    ...(continuation ? [`raw-checkpoint:${checkpoint.recordDigest}`] : []), ...(chained ? [`raw-checkpoint-chain:${sha256(graph.continuationBytes)}`] : [])], 'provider-delete', false, options.tombstoneHumanSecond ?? ((continuation ? 30 + recoveryShift : 27) + offset));
  const grant = { grantId: 'tombstone', action: 'lifecycle.commit-tombstone', actorSubject: config.actorSubject, upstreamSubject: config.upstreamSubject,
    provider: 'fixture-provider-a', resourceDomain: 'provider-a', resources: { objectId: config.recordId, recordClass: config.recordClass, inventoryDigest: inventory.recordDigest,
      tupleDigest, aggregateReceiptDigest: aggregate.recordDigest, path: config.tombstonePath,
      ...(referenceProof ? { tombstoneRecordId: JSON.parse(referenceProof.contextBytes).tombstoneRecordId, verificationBundleDigest: JSON.parse(referenceProof.source.contextBytes).verificationBundleDigest } : {}) },
    authorityEvidenceDigest: full.authority.recordDigest, inputDigest: baseDigest };
  graph.tombstone = { humanBundleBytes: full.bytes, ...action('tombstone', grant, full.authority, options.tombstoneActionSecond ?? ((continuation ? 38 + recoveryShift : 35) + offset)) };
  edit('graph', graph); return { graph, config, configBytes, runtimeBytes, evaluationTime: evaluatedAt, bytes: jcs(graph), verifier: selectedVerifier };
}
const proofKinds = ['request', 'upstream', 'downstream', 'delegation', 'assignment', 'authority', 'resources', 'replay', 'head', 'reservation'];
const eventFields = ['eventVersion', 'eventId', 'organization', 'itemId', 'environmentId', 'recordId', 'artifactRevision', 'actorId', 'actorAuthority', 'correlationId', 'timestampAuthority', 'providerRecordId'];
export function lifecycleGraphVariants() {
  return ['positive', 'replay', ...eventFields.map((key) => 'event-missing:' + key), 'history-proof-corrupt', 'current-proof-corrupt',
    'history-wrong-record', 'wrong-policy', 'wrong-history-digest', 'surrogate-trigger', 'active-hold',
    ...['copy-1', 'copy-2', 'tombstone'].flatMap((label) => [...proofKinds.map((kind) => 'omit:' + label + ':' + kind), 'human:' + label, 'loser:' + label, 'receipt:' + label]), 'expired'];
}
export function lifecycleGraphExecutionCase(variant = 'positive') {
  if (!lifecycleGraphVariants().includes(variant)) throw new Error('UNKNOWN_LIFECYCLE_GRAPH_VARIANT');
  // Same original key era, exactly 90 days after a real run-terminal event.
  const options = { recordClass: 'RC-FAILED-RUN', eventType: 'run-terminal', triggerSecond: -7776000,
    history: [{ type: 'record-committed', second: -7776010 }], edits: {} };
  if (variant === 'replay') options.replay = true;
  if (variant.startsWith('event-missing:')) {
    const field = variant.slice(14);
    if (['eventId', 'providerRecordId'].includes(field)) {
      // Keep construction well-defined, then remove the identity from the actual
      // event envelope. These two schema negatives do not claim rebuilt lineage.
      options.edits.graph = (graph) => { const event = JSON.parse(graph.eventBytes); delete event[field]; graph.eventBytes = jcs(originalSeal(event, 'record')); };
    } else options.edits['event-2'] = (event) => { delete event[field]; };
  }
  if (variant === 'history-proof-corrupt') options.edits['signed-event-proof-1'] = (proof) => { proof.signature.valueBase64 = Buffer.alloc(64).toString('base64'); };
  if (variant === 'current-proof-corrupt') options.edits['signed-event-proof-2'] = (proof) => { proof.signature.valueBase64 = Buffer.alloc(64).toString('base64'); };
  if (variant === 'history-wrong-record') options.edits['event-1'] = (event) => { event.recordId = 'other-record'; };
  if (variant === 'wrong-policy') options.edits['event-2'] = (event) => { event.policySha256 = 'f'.repeat(64); };
  if (variant === 'wrong-history-digest') options.edits.state = (record) => { record.historyDigest = 'f'.repeat(64); };
  if (variant === 'active-hold') options.history.push({ type: 'hold-applied', second: -20 });
  if (variant.startsWith('omit:')) { const [, label, kind] = variant.split(':'); options.edits[label + ':action-bundle'] = (bundle) => { delete bundle[kind + 'Bytes']; }; }
  if (variant.startsWith('human:')) options.edits[variant.slice(6) + ':human'] = (record) => { record.terminalEventId = 'wrong-event'; };
  if (variant.startsWith('loser:')) options.edits[variant.slice(6) + ':reservation'] = (record) => { record.winner = false; };
  if (variant.startsWith('receipt:')) options.edits[variant.slice(8) + ':receipt'] = (record) => { record.requestDigest = 'f'.repeat(64); };
  if (variant === 'surrogate-trigger') options.edits.graph = (graph) => { graph.eventBytes = JSON.parse(makeLifecycleGraph('RC-FAILED-RUN', 'complete', 'complete')).triggerBytes; };
  if (variant === 'expired') options.evaluationTime = until;
  const value = fixture(options);
  return { ...value, variant, input: jcs({ configBytes: value.configBytes, bytes: value.bytes, evaluatedAt: value.evaluationTime }) };
}

// Closed adapters for exact frozen ordinary lifecycle negative IDs. Raw/reference
// evidence needs separate complete controls and is deliberately not accepted here.
export function lifecycleNegativeExecutionCase(kind) {
  const kinds = ['active-hold', 'hold-conflict', 'stale-inventory', 'provider-partial', 'provider-wrong-copy', 'aggregate-missing', 'early-tombstone',
    'ordinary-replay', 'missing-authority', 'request-reused', 'restored-race', 'local-signer-receipt', 'copy-missing', 'copy-duplicate', 'copy-extra',
    'tuple-key-mismatch', 'provider-mismatch', 'policy-mismatch', 'target-mismatch', 'cas-loser', 'receipt-missing', 'receipt-duplicate',
    'crash-before-aggregate', 'invalid-human-schema', 'provider-before-not-before', 'provider-after-expiry', 'provider-registry-substitution'];
  if (!kinds.includes(kind)) throw new Error('UNKNOWN_LIFECYCLE_NEGATIVE_CASE');
  const options = { recordClass: 'RC-FAILED-RUN', eventType: 'run-terminal', triggerSecond: -7776000,
    history: [{ type: 'record-committed', second: -7776010 }], edits: {} };
  if (kind === 'active-hold') {
    options.history.push({ type: 'run-terminal', second: -7776000 }); options.eventType = 'hold-applied';
    options.triggerSecond = -20; options.triggerHistoryIndex = 1;
    options.edits.state = (record) => { record.holdState = 'active'; };
  }
  if (kind === 'hold-conflict') options.edits.state = (record) => { record.holdState = 'overlapping'; };
  if (kind === 'stale-inventory') options.edits.inventory = (record) => { record.recordedAt = at(-600); };
  if (kind === 'provider-partial') options.edits['copy-1:receipt'] = (record) => { record.status = 'partial'; };
  if (kind === 'provider-wrong-copy') options.edits['copy-1:resources'] = (record) => { record.resources.copyId = 'other-copy'; };
  if (kind === 'tuple-key-mismatch') options.edits['copy-1:resources'] = (record) => { record.resources.keyId = 'other-key'; };
  if (kind === 'provider-mismatch') options.edits['copy-1:resources'] = (record) => { record.provider = 'other-provider'; };
  if (kind === 'aggregate-missing') options.edits.aggregate = (record) => { record.receiptDigests = []; };
  if (kind === 'early-tombstone') options.edits['tombstone:receipt'] = (record) => { record.recordedAt = at(1); };
  if (kind === 'policy-mismatch') options.edits['copy-1:context'] = (context) => { context.target.authorizationPolicyBytes = '{}'; context.target.authorizationPolicyDigest = sha256('{}'); };
  if (kind === 'target-mismatch') options.edits['copy-1:context'] = (context) => { context.target.examRevision = 'f'.repeat(40); };
  if (kind === 'cas-loser') options.edits['copy-1:reservation'] = (record) => { record.winner = false; record.status = 'lost'; };
  if (kind === 'invalid-human-schema') options.edits['copy-1:human'] = (record) => { delete record.version; };
  if (kind === 'provider-before-not-before') options.edits['copy-1:receipt'] = (record) => { record.recordedAt = '2026-08-31T23:59:59Z'; };
  if (kind === 'provider-after-expiry') options.edits['copy-1:receipt'] = (record) => { record.recordedAt = '2040-09-01T00:00:00Z'; };
  const value = fixture(options), graph = value.graph;
  // Envelope/set/race variants preserve the originally authorized downstream bytes.
  if (kind === 'ordinary-replay') {
    const bundle = JSON.parse(graph.copies[0].actionBundleBytes); bundle.replayBytes = jcs(originalSeal(JSON.parse(bundle.replayBytes), 'record'));
    graph.copies[0].actionBundleBytes = jcs(bundle);
  }
  if (kind === 'missing-authority') graph.copies[1].humanBundleBytes = '';
  if (kind === 'request-reused') graph.copies[1].actionBundleBytes = graph.copies[0].actionBundleBytes;
  if (['restored-race', 'copy-missing', 'copy-duplicate', 'copy-extra'].includes(kind)) {
    const inventory = JSON.parse(graph.inventoryBytes);
    if (kind === 'restored-race') inventory.copies[0].versionId = 'restored-version';
    if (kind === 'copy-missing') inventory.copies.pop();
    if (kind === 'copy-duplicate') inventory.copies.push(structuredClone(inventory.copies[0]));
    if (kind === 'copy-extra') inventory.copies.push({ ...inventory.copies[0], copyId: 'extra-copy', objectKey: 'extra-object' });
    graph.inventoryBytes = jcs(originalSeal(inventory, 'provider'));
  }
  if (kind === 'local-signer-receipt') graph.copies[0].receiptBytes = jcs(originalSeal(JSON.parse(graph.copies[0].receiptBytes), 'record'));
  if (kind === 'receipt-missing') graph.copies[1].receiptBytes = '';
  if (kind === 'receipt-duplicate') graph.copies[1].receiptBytes = graph.copies[0].receiptBytes;
  if (kind === 'crash-before-aggregate') graph.aggregateBytes = '';
  if (kind === 'provider-registry-substitution') {
    const registry = JSON.parse(readFileSync(new URL('../0001/reviews/domain/round-3/remediation/PROVIDER-KEY-REGISTRY.candidate.json', import.meta.url), 'utf8'));
    registry.bindings[0].publicKeyHex = 'f'.repeat(64); graph.providerKeyRegistryBytes = jcs(registry);
  }
  const bytes = jcs(graph);
  return { ...value, bytes, kind, input: jcs({ configBytes: value.configBytes, bytes, evaluatedAt: value.evaluationTime }) };
}

export function specialLifecycleExecutionCase(kind, variant = 'negative') {
  if (!['reference-missing', 'raw-grant-missing', 'malformed-raw-grant'].includes(kind) || !['positive', 'replay', 'negative'].includes(variant))
    throw new Error('UNKNOWN_SPECIAL_LIFECYCLE_CASE');
  const reference = kind === 'reference-missing';
  const options = { fixtureEpoch: Date.parse('2026-09-04T12:00:00Z'), replay: variant === 'replay', edits: {},
    ...(reference ? { runtimeYear: 2029, recordClass: 'RC-REFERENCED-EVIDENCE', eventType: 'item-closed', referenceRuntime: true,
      qualifiedDecisions: true, archivedOwners: true, currentHistory: [] } : { recordClass: 'RC-CORPUS-RAW-WORKING' }) };
  if (variant === 'negative') options.edits.graph = (graph) => {
    if (reference) graph.referenceRevocationBytes = '';
    else {
      const raw = JSON.parse(graph.rawPolicyBytes);
      if (kind === 'raw-grant-missing') { raw.rawGrantBytes = ''; raw.humanBundleBytes = ''; }
      else raw.rawGrantBytes = jcs([JSON.parse(raw.rawGrantBytes).authority]);
      graph.rawPolicyBytes = jcs(raw);
    }
  };
  const value = fixture(options);
  // Use the narrow no-downgrade reference entry point for the reference profile.
  const verifier = reference ? createReferenceLifecycleVerifier(value.configBytes, value.runtimeBytes) : value.verifier;
  return { ...value, verifier, kind, variant, input: jcs({ configBytes: value.configBytes, runtimeBytes: value.runtimeBytes ?? null, bytes: value.bytes, evaluatedAt: value.evaluationTime }) };
}

// The frozen matrix uses a September 4 trigger and a 15-day parent cap. Keep
// these exact instants while constructing fresh, complete evidence near expiry.
export function shortRetentionExecutionCase(classId, boundary, variant = 'positive') {
  const classes = {
    'RC-FAILED-RUN': ['run-terminal', '2026-12-03T12:00:00Z', false],
    'RC-POSTHOG-RAW': ['event-committed', '2026-12-03T12:00:00Z', false],
    'RC-CORPUS-DERIVED-TEXT': ['run-terminal', '2026-09-19T12:00:00Z', true],
    'RC-CORPUS-EXPORT': ['export-completed', '2026-09-19T12:00:00Z', true],
  };
  if (!Object.hasOwn(classes, classId) || !['before', 'complete'].includes(boundary) || !['positive', 'replay', 'missing-state', 'missing-receipt', 'wrong-parent'].includes(variant))
    throw new Error('UNKNOWN_SHORT_RETENTION_CASE');
  const [eventType, boundaryAt, parentCap] = classes[classId];
  if (variant === 'wrong-parent' && !parentCap) throw new Error('UNKNOWN_SHORT_RETENTION_CASE');
  const triggerEpoch = Date.parse('2026-09-04T12:00:00Z'), expiryEpoch = Date.parse(boundaryAt);
  const fixtureEpoch = expiryEpoch - (boundary === 'before' ? 60000 : 0);
  // 100 ms ordered proof steps let the complete path finish at the source's
  // exact +6 second observation. No current proof lies after evaluation.
  const triggerSecond = (triggerEpoch - fixtureEpoch) / 100;
  const options = { recordClass: classId, eventType, fixtureEpoch, triggerSecond, tickNanoseconds: 100000000,
    horizon: 1500, evaluationTime: new Date(expiryEpoch + (boundary === 'before' ? -1000 : 6000)).toISOString().replace('.000Z', 'Z'),
    history: [{ type: 'originator-draft-saved', second: triggerSecond - 100 }], replay: variant === 'replay', edits: {} };
  if (parentCap) options.edits.state = (state) => { state.parentExpiryAt = variant === 'wrong-parent' ? null : '2026-09-19T12:00:00Z'; };
  if (variant === 'missing-state') options.edits.graph = (graph) => { graph.stateBytes = ''; };
  if (variant === 'missing-receipt') options.edits.graph = (graph) => { graph.copies[0].receiptBytes = ''; };
  const value = fixture(options);
  return { ...value, classId, boundary, boundaryAt, variant, input: jcs({ configBytes: value.configBytes, bytes: value.bytes, evaluatedAt: value.evaluationTime }) };
}

export function longRetentionExecutionCase(classId, boundary, variant = 'positive') {
  const classes = {
    'RC-SECURITY-AUDIT': [2027, 'event-committed'],
    'RC-CORPUS-BASELINE': [2029, 'corpus-retired'],
    'RC-DECISION-PROOF': [2033, 'item-closed'],
    'RC-LEGAL-SIGNED-LOG': [2033, 'item-closed'],
    'RC-REFERENCED-EVIDENCE': [2029, 'item-closed'],
  };
  if (!Object.hasOwn(classes, classId) || !['before', 'complete'].includes(boundary) ||
    !['positive', 'replay', 'missing-history', 'missing-state', 'missing-receipt', 'missing-reference'].includes(variant) ||
    variant === 'missing-reference' && classId !== 'RC-REFERENCED-EVIDENCE') throw new Error('UNKNOWN_LONG_RETENTION_CASE');
  const [runtimeYear, eventType] = classes[classId], boundaryAt = `${runtimeYear}-09-04T12:00:00Z`, expiryEpoch = Date.parse(boundaryAt);
  const reference = classId === 'RC-REFERENCED-EVIDENCE';
  const options = { fixtureEpoch: Date.parse('2026-09-04T12:00:00Z'), recordClass: classId, eventType,
    historyType: 'originator-draft-saved', runtimeYear, runtimeEpoch: new Date(expiryEpoch - (boundary === 'before' ? 60000 : 0)).toISOString(),
    tickNanoseconds: 100000000, horizon: 1500, replay: variant === 'replay', qualifiedDecisions: true, archivedOwners: true, currentHistory: [],
    referenceRuntime: reference, evaluationTime: new Date(expiryEpoch + (boundary === 'before' ? -1000 : 6000)).toISOString().replace('.000Z', 'Z'), edits: {} };
  if (variant !== 'positive' && variant !== 'replay') options.edits.graph = (graph) => {
    if (variant === 'missing-history') graph.historicalEvidenceBytes = '';
    if (variant === 'missing-state') graph.stateBytes = '';
    if (variant === 'missing-receipt') graph.copies[0].receiptBytes = '';
    if (variant === 'missing-reference') graph.referenceRevocationBytes = '';
  };
  const value = fixture(options), verifier = reference ? createReferenceLifecycleVerifier(value.configBytes, value.runtimeBytes) : value.verifier;
  return { ...value, verifier, classId, boundary, boundaryAt, variant,
    input: jcs({ configBytes: value.configBytes, runtimeBytes: value.runtimeBytes, bytes: value.bytes, evaluatedAt: value.evaluationTime }) };
}

export function lifecycleReadinessExecutionCase(classId, point, variant = 'positive') {
  const short = ['RC-FAILED-RUN', 'RC-POSTHOG-RAW', 'RC-CORPUS-DERIVED-TEXT', 'RC-CORPUS-EXPORT'];
  const long = ['RC-SECURITY-AUDIT', 'RC-CORPUS-BASELINE', 'RC-DECISION-PROOF', 'RC-LEGAL-SIGNED-LOG', 'RC-REFERENCED-EVIDENCE'];
  const variants = ['positive', 'missing-state', 'bad-history', 'stale-inventory', 'future-state', 'wrong-provider', 'wrong-target', 'wrong-policy', 'wrong-config', 'active-hold', 'reference-active', 'extra-field', 'missing-cap'];
  if (![...short, ...long].includes(classId) || !['before', 'at', 'after', 'complete'].includes(point) || !variants.includes(variant) ||
    variant === 'missing-cap' && !['RC-CORPUS-DERIVED-TEXT', 'RC-CORPUS-EXPORT'].includes(classId)) throw new Error('UNKNOWN_LIFECYCLE_READINESS_CASE');
  const current = long.includes(classId), value = (current ? longRetentionExecutionCase : shortRetentionExecutionCase)(classId, 'before');
  const graph = structuredClone(value.graph), seal = current ? runtimeSeal : originalSeal;
  const evaluationTime = new Date(Date.parse(value.boundaryAt) + ({ before: -1000, at: 0, after: 1000, complete: 6000 })[point]).toISOString().replace('.000Z', 'Z');
  let state = JSON.parse(graph.stateBytes);
  if (['stale-inventory', 'wrong-provider'].includes(variant)) {
    const inventory = JSON.parse(graph.inventoryBytes);
    if (variant === 'stale-inventory') inventory.recordedAt = new Date(Date.parse(value.boundaryAt) - 600000).toISOString().replace('.000Z', 'Z');
    else inventory.copies[0].provider = 'unbound-provider';
    const signedInventory = seal(inventory, 'provider'); graph.inventoryBytes = jcs(signedInventory); state.inventoryDigest = signedInventory.recordDigest;
  }
  if (variant === 'future-state') state.recordedAt = new Date(Date.parse(evaluationTime) + 2000).toISOString().replace('.000Z', 'Z');
  if (variant === 'active-hold') state.holdState = 'active';
  if (variant === 'reference-active') state.referenceState = 'active';
  if (variant === 'missing-cap') state.parentExpiryAt = null;
  graph.stateBytes = jcs(seal(state, 'authority'));
  if (variant === 'bad-history') {
    const prior = JSON.parse(graph.historyBytes[0]); prior.signature.valueBase64 = 'A'.repeat(86) + '=='; graph.historyBytes[0] = jcs(prior);
    state = JSON.parse(graph.stateBytes); state.historyDigest = sha256(jcs([...graph.historyBytes, graph.eventBytes])); graph.stateBytes = jcs(seal(state, 'authority'));
  }
  if (variant === 'missing-state') graph.stateBytes = '';
  const verifier = current ? createCurrentLifecycleReadinessVerifier(value.configBytes, value.runtimeBytes) : createLifecycleReadinessVerifier(value.configBytes);
  const head = { version: 'steer-lifecycle-readiness/v1', policyDigest: verifier.policyDigest, dispositionPolicyDigest: value.verifier.policyDigest,
    target: Object.fromEntries(['examRevision', 'examDigest', 'implementationRevision', 'authorizationPolicyPath', 'authorizationPolicyRevision', 'authorizationPolicyDigest'].map((field) => [field, target[field]])),
    ...Object.fromEntries(['configDigest', 'eventBytes', 'historyBytes', 'inventoryBytes', 'stateBytes', ...(current ? ['historicalEvidenceBytes', 'qualifiedDecisionBytes', 'archivedOwnerBytes'] : [])].map((field) => [field, graph[field]])) };
  if (variant === 'wrong-target') head.target.implementationRevision = 'f'.repeat(40);
  if (variant === 'wrong-policy') head.policyDigest = value.verifier.policyDigest;
  if (variant === 'wrong-config') head.configDigest = 'f'.repeat(64);
  if (variant === 'extra-field') head.executionAuthorized = true;
  const bytes = jcs(head);
  return { configBytes: value.configBytes, runtimeBytes: value.runtimeBytes, boundaryAt: value.boundaryAt, classId, point, variant, head, bytes, verifier,
    fullVerifier: value.verifier, evaluationTime, input: jcs({ configBytes: value.configBytes, runtimeBytes: value.runtimeBytes ?? null, bytes, evaluatedAt: evaluationTime }) };
}

export function immutableRetentionExecutionCase(boundary, variant = 'positive') {
  if (!['before', 'at', 'after', 'complete'].includes(boundary) || !['positive', 'active-hold', 'effects-injected', 'missing-state', 'missing-inventory',
    'wrong-parent', 'future-state', 'wrong-history', 'wrong-trigger', 'proposed-expiry', 'bad-event-proof'].includes(variant)) throw new Error('UNKNOWN_IMMUTABLE_RETENTION_CASE');
  const sourceTime = '2026-09-04T12:00:00Z';
  const options = { fixtureEpoch: Date.parse(sourceTime), recordClass: 'RC-AUTHORITATIVE-ARTIFACT',
    eventType: variant === 'wrong-trigger' ? 'item-closed' : 'record-committed', historyType: 'originator-draft-saved', evaluationTime: sourceTime,
    edits: { inventory: (record) => { record.recordedAt = sourceTime; }, state: (record) => {
      record.recordedAt = variant === 'future-state' ? '2026-09-04T12:00:00.000000001Z' : sourceTime;
      if (variant === 'active-hold') record.holdState = 'active';
      if (variant === 'wrong-parent') record.parentExpiryAt = sourceTime;
      if (variant === 'wrong-history') record.historyDigest = 'f'.repeat(64);
    }, graph: (graph) => {
      // An indefinite policy never consumes effect evidence. The ordinary
      // control supplies empty effect slots, not receipts from the future.
      if (variant !== 'effects-injected') { graph.copies = []; graph.aggregateBytes = ''; graph.tombstone = {}; }
      if (variant === 'missing-state') graph.stateBytes = '';
      if (variant === 'missing-inventory') graph.inventoryBytes = '';
      if (variant === 'proposed-expiry') graph.expiresAt = sourceTime;
      if (variant === 'bad-event-proof') {
        const event = JSON.parse(graph.eventBytes), proof = JSON.parse(event.providerProofBytes); proof.signature.valueBase64 = 'A'.repeat(86) + '==';
        graph.eventBytes = jcs(originalSeal({ ...event, providerProofBytes: jcs(proof) }, 'record'));
        const state = JSON.parse(graph.stateBytes); state.historyDigest = sha256(jcs([...graph.historyBytes, graph.eventBytes])); graph.stateBytes = jcs(originalSeal(state, 'authority'));
      }
    } } };
  const value = fixture(options);
  return { ...value, boundary, variant, input: jcs({ configBytes: value.configBytes, bytes: value.bytes, evaluatedAt: value.evaluationTime }) };
}

export function rawDeadlineExecutionCase(boundary, variant = 'positive') {
  const observations = { before: 59, at: 60, after: 61, complete: 66 };
  if (!Object.hasOwn(observations, boundary) || !['positive', 'replay', 'missing-grant', 'expired-grant', 'missing-state', 'held', 'reference-active',
    'missing-receipt', 'missing-batch', 'missing-tombstone', 'deadline-receipt', 'late-receipt', 'late-second'].includes(variant)) throw new Error('UNKNOWN_RAW_DEADLINE_CASE');
  const fixtureEpoch = Date.parse('2026-09-04T12:00:00Z'), boundaryAt = '2026-09-04T12:01:00Z';
  const evaluationTime = formatExactInstant(BigInt(fixtureEpoch) * 1000000n + BigInt(observations[boundary]) * 1000000000n);
  const options = { fixtureEpoch, recordClass: 'RC-CORPUS-RAW-WORKING', tickNanoseconds: 100000000, horizon: 1500, evaluationTime,
    replay: variant === 'replay', edits: { state: (record) => {
      if (variant === 'held') record.holdState = 'active';
      if (variant === 'reference-active') record.referenceState = 'active';
    }, 'raw-policy:human': (record) => { if (variant === 'expired-grant') record.expiresAt = '2026-09-04T12:00:00Z'; },
    graph: (graph) => {
      if (variant === 'missing-grant') graph.rawPolicyBytes = '';
      if (variant === 'missing-state') graph.stateBytes = '';
      if (variant === 'missing-receipt') graph.copies[0].receiptBytes = '';
      if (variant === 'missing-batch') graph.rawBatchBytes = '';
      if (variant === 'missing-tombstone') graph.tombstone.receiptBytes = '';
    } } };
  if (['deadline-receipt', 'late-receipt', 'late-second'].includes(variant)) {
    // Identical otherwise-valid lineage. Only the last provider receipt crosses
    // the inclusive deadline; aggregate and tombstone follow it and are audited
    // at +66s. They are future evidence at earlier observation coordinates.
    options.edits['copy-3:receipt'] = (record) => { record.recordedAt = variant === 'deadline-receipt' ? boundaryAt :
      variant === 'late-receipt' ? '2026-09-04T12:01:00.000000001Z' : '2026-09-04T12:01:01Z'; };
    options.edits.aggregate = (record) => { record.recordedAt = '2026-09-04T12:01:01.100000000Z'; };
    options.tombstoneHumanSecond = 613; options.tombstoneActionSecond = 621;
  }
  const value = fixture(options);
  return { ...value, boundary, boundaryAt, variant, input: jcs({ configBytes: value.configBytes, bytes: value.bytes, evaluatedAt: evaluationTime }) };
}
