import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createLifecycleGraphVerifier, lifecycleBoundary, policyDigest } from '../intent/0061/lifecycle-graph.candidate.mjs';
import { humanAuthorityBindingDigest } from '../intent/0058/human-authority.candidate.mjs';
import { manifestBytes, manifestDigest } from '../intent/0060/protected-actions.candidate.mjs';
import { exactInstant, formatExactInstant } from '../intent/0069/exact-time.candidate.mjs';
import { policyDigest as preterminalPolicy } from '../intent/0073/raw-preterminal.candidate.mjs';
import { policyDigest as rawBatchPolicy } from '../intent/0074/raw-batch.candidate.mjs';
import { policyDigest as checkpointPolicy } from '../intent/0075/raw-checkpoint.candidate.mjs';
import { makeHumanAuthorityBundle, makeLifecycleEventBytes, makeLifecycleGraph } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { lifecycleGraphDecision as frozen } from '../intent/0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { jcs, sha256, TRUST_REGISTRY, TARGET_REVISION, TARGET_EXAM_SHA, AUTHORIZATION_POLICY_PATH, AUTHORIZATION_POLICY_SHA, AUTHORIZATION_POLICY_BYTES, RETENTION_POLICY_SHA, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const epoch = Date.parse('2026-09-04T12:00:00Z');
const at = (seconds) => new Date(epoch + seconds * 1000).toISOString().replace('.000Z', 'Z');
const evaluation = at(50), until = at(150);
const keys = new Map();
function seal(input, domain) {
  if (!keys.has(domain)) keys.set(domain, createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), createHash('sha256').update(`steer-r3-r1-${domain}`).digest()]), format: 'der', type: 'pkcs8' }));
  const payload = Object.fromEntries(Object.entries(input).filter(([key]) => !['recordDigest', 'signature'].includes(key))), digest = sha256(jcs(payload));
  return { ...payload, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-v1`, signedDigest: digest, valueBase64: sign(null, Buffer.from(digest), keys.get(domain)).toString('base64') } };
}
const scope = { organization: 'steer-platform', tenant: 'steer-platform', repositoryId: 'steer-platform', installationId: 'fixture-installation', item: '0001-flight-deck-foundation' };
const target = { examRevision: TARGET_REVISION, examDigest: TARGET_EXAM_SHA, implementationRevision: 'e'.repeat(40), authorizationPolicyPath: AUTHORIZATION_POLICY_PATH,
  authorizationPolicyRevision: TARGET_REVISION, authorizationPolicyDigest: AUTHORIZATION_POLICY_SHA, authorizationPolicyBytes: AUTHORIZATION_POLICY_BYTES };

// All keys and signing helpers are synthetic and private to this test file.
function fixture(options = {}) {
  const at = (seconds) => formatExactInstant(BigInt(epoch) * 1000000n + BigInt(seconds) * BigInt(options.tickNanoseconds ?? 1000000000) + BigInt(options.nanoseconds ?? 0));
  const evaluatedAt = options.evaluationTime ?? at(50), until = at(150), offset = options.offset ?? 0;
  const edits = options.edits ?? {}, edit = (key, value) => { edits[key]?.(value); return value; };
  const config = { version: 'steer-lifecycle-context/v1', implementationRevision: target.implementationRevision, repositoryId: scope.repositoryId, installationId: scope.installationId,
    recordId: 'record-1', recordClass: options.recordClass ?? 'RC-REBUILDABLE', artifactRevision: 'b'.repeat(40), environmentId: null,
    actorSubject: 'service:lifecycle-worker', upstreamSubject: 'authority:lifecycle', tombstonePath: 'intent/0001/evidence/tombstone.json', tombstoneProviderBindingId: 'fixture-provider-a-binding' };
  edit('config', config); const configBytes = jcs(config), configDigest = sha256(configBytes);
  const raw = config.recordClass === 'RC-CORPUS-RAW-WORKING';
  const continuation = raw && Array.isArray(options.continueCopies);
  const type = options.eventType ?? (raw ? 'corpus-sanitization-terminal' : 'record-superseded');
  function event(eventType, index, second) {
    const value = { ...JSON.parse(makeLifecycleEventBytes(eventType, index)), recordId: config.recordId, recordClass: config.recordClass, artifactRevision: config.artifactRevision,
      policySha256: RETENTION_POLICY_SHA, occurredAt: at(second), ...(eventType === 'corpus-sanitization-terminal' ? { result: 'pass', sanitizerRevision: 'sanitizer-v1', inspectionRevision: 'inspector-v1' } : {}),
      ...(eventType === 'run-terminal' ? { terminalStatus: 'failed' } : {}),
      ...(eventType === 'derived-record-deleted' ? { derivedRecordId: `derived-${String(index).padStart(3, '0')}`, derivedRecordClass: 'RC-CORPUS-DERIVED-TEXT', parentCorpusId: 'corpusId-value', parentCorpusVersion: 'corpusVersion-value' } : {}) };
    edit(`event-${index}`, value);
    const payload = Object.fromEntries(Object.entries(value).filter(([key]) => !['providerProofBytes', 'providerProofDigest', 'recordDigest', 'signature'].includes(key)));
    const proof = seal(edit(`event-proof-${index}`, { providerRecordId: value.providerRecordId, eventId: value.eventId, eventBindingDigest: sha256(jcs(payload)), recordedAt: value.occurredAt }), 'provider');
    edit(`signed-event-proof-${index}`, proof);
    return jcs(seal({ ...value, providerProofBytes: jcs(proof), providerProofDigest: proof.recordDigest }, 'record'));
  }
  const history = options.history ?? [{ type: options.historyType ?? 'record-committed', second: -10 }];
  const historyBytes = history.map((entry, index) => event(entry.type, index + 1, entry.second));
  const eventBytes = event(type, history.length + 1, 0);
  // Explicit test expectation, not a call back into the verifier's selector.
  const trigger = JSON.parse(options.triggerHistoryIndex === undefined ? eventBytes : historyBytes[options.triggerHistoryIndex]);
  const copies = (raw ? ['a', 'b', 'a'] : ['a', 'b']).map((suffix, index) => ({ copyId: `copy-${index + 1}`, copyKind: raw ? 'temporary-working' : 'replica', provider: `fixture-provider-${suffix}`,
    providerBindingId: `fixture-provider-${suffix}-binding`, account: `fixture-account-${suffix}`, objectKey: `object-${index}`, versionId: 'version-1', keyId: `key-${index}`, sourceOriginal: false }));
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
    historyDigest: sha256(jcs([...historyBytes, eventBytes])), historyComplete: true, holdState: 'none', referenceState: 'cleared', referenceRevocationDigest: null, parentExpiryAt: null, recordedAt: at(2), validThrough: until,
    ...(provenance ? { derivedInventoryDigest: derived.recordDigest } : {}) }), options.stateDomain ?? 'authority');
  const graph = { version: continuation ? 'steer-lifecycle-graph/raw-v3' : raw ? 'steer-lifecycle-graph/raw-v2' : 'steer-lifecycle-graph/v1', configDigest, policyDigest, eventBytes, historyBytes, inventoryBytes: jcs(inventory), stateBytes: jcs(state), referenceRevocationBytes: '', copies: [], aggregateBytes: '', tombstone: {},
    ...(provenance ? { derivedInventoryBytes: jcs(derived) } : {}) };
  const tupleDigest = sha256(jcs(copies));
  function human(label, selected, conditions, method, isRaw, second) {
    const bundle = makeHumanAuthorityBundle(), prior = JSON.parse(bundle.authorityBytes);
    const humanInventory = seal({ inventoryId: `human-inventory-${label}`, organization: scope.organization, tenant: scope.tenant, item: scope.item,
      items: selected.map((copy) => ({ copyId: copy.copyId, provider: copy.provider, objectDigest: sha256(jcs(copy)) })),
      ...(isRaw ? { preparationDigest: preparation.recordDigest } : { lifecycleInventoryDigest: inventory.recordDigest }), tupleDigest, capturedAt: at(isRaw ? -19 : 2) }, 'record');
    const identity = seal({ ...JSON.parse(bundle.identityEvidenceBytes), verifiedAt: at(second - 1) }, 'provider');
    let authority = edit(`${label}:human`, { ...prior, authorityId: `human-${label}`, authorityType: isRaw ? 'raw-policy-grant' : 'disposition-authorization',
      identityEvidenceDigest: identity.recordDigest, copyInventoryDigest: humanInventory.recordDigest, conditions, allowedCopyProviders: [...new Set(selected.map((copy) => copy.provider))].sort(),
      eraseMethod: method, terminalEventId: trigger.eventId, authenticatedAt: at(second - 1), decidedAt: at(second), idempotencyKey: `human-idem-${label}`, providerRecordId: `human-provider-${label}`,
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
  const baseDigest = sha256(jcs({ configDigest, policyDigest, eventBytes, historyBytes, inventoryBytes: graph.inventoryBytes, stateBytes: graph.stateBytes, referenceRevocationBytes: '',
    ...(provenance ? { derivedInventoryBytes: graph.derivedInventoryBytes } : {}), ...(raw ? { rawGrantBindingDigest } : {}) }));
  const plannedRequests = new Map();
  function action(label, grant, authority, second) {
    const recoveringCopy = continuation && label !== 'tombstone';
    const replayed = label === 'tombstone' ? (options.tombstoneReplay ?? options.replay) : recoveringCopy ? options.continueCopies.includes(label) : (options.replayCopies ? options.replayCopies.includes(label) : options.replay);
    const context = { version: 'steer-protected-action-context/v1', manifestDigest, trustRegistryBytes: jcs(TRUST_REGISTRY), target: structuredClone(target), scope: structuredClone(scope), grants: [structuredClone(grant)] };
    edit(`${label}:context`, context);
    const contextDigest = sha256(jcs(context)), definition = JSON.parse(manifestBytes).actions.find((entry) => entry.action === grant.action);
    const operation = { requestId: `request-${label}`, grantId: grant.grantId, idempotencyKey: `idem-${label}`, casHead: 'a'.repeat(64), requestedAt: at(second) };
    edit(`${label}:operation`, operation);
    const operationDigest = sha256(jcs({ contextDigest, operation })), records = {};
    const emit = (kind, values, domain, recordedAt = at(second - 4)) => records[kind] = seal(edit(`${label}:${kind}`, { kind, contextDigest, operationDigest, recordedAt, validThrough: until, ...values }), domain);
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
    const receipt = seal(edit(`${label}:receipt`, { kind: 'receipt', configDigest, contextDigest, inputDigest: baseDigest, requestDigest: request.recordDigest,
      resourcesDigest: sha256(jcs(grant.resources)), authorityDigest: authority.recordDigest, action: grant.action, transactionId: `transaction-${label}`,
      effect: grant.action === 'lifecycle.crypto-erase' ? 'crypto-erased' : grant.action === 'lifecycle.commit-tombstone' ? 'tombstone-committed' : 'deleted', status: 'terminal-success', recordedAt: at(second + (recoveringCopy && !replayed ? 11 : 4)) }), grant.resourceDomain);
    const replay = emit('replay', { ledgerId: `replay-${label}`, source: 'authoritative-replay-store', requestDigest: request.recordDigest, idempotencyKey: operation.idempotencyKey,
      status: replayed ? 'committed' : 'unused', resultDigest: replayed ? receipt.recordDigest : null, headId: `head-${label}` }, 'replay-authority', at(second + (recoveringCopy ? (replayed ? 8 : 10) : replayed ? 5 : 1)));
    const head = emit('head', { headId: `head-${label}`, source: 'authoritative-cas-store', requestDigest: request.recordDigest, head: operation.casHead, previousHead: '9'.repeat(64), sequence: 4 }, 'cas-authority', at(second + (recoveringCopy ? (replayed ? 8 : 10) : 1)));
    emit('reservation', { reservationId: `reserve-${label}`, source: 'authoritative-cas-store', requestDigest: request.recordDigest, headId: head.headId,
      headDigest: head.recordDigest, replayDigest: replay.recordDigest, expectedHead: head.head, idempotencyKey: operation.idempotencyKey, winner: !replayed,
      status: replayed ? 'already-committed' : 'reserved' }, 'cas-authority', at(second + (recoveringCopy ? (replayed ? 9 : 10) : replayed ? 6 : 2)));
    const bundle = { version: 'steer-protected-action-bundle/v1', contextDigest, ...Object.fromEntries(Object.entries(records).map(([kind, record]) => [`${kind}Bytes`, jcs(record)])) };
    edit(`${label}:action-bundle`, bundle); return { actionBundleBytes: jcs(bundle), receiptBytes: jcs(receipt) };
  }
  for (const copy of copies) {
    const conditions = [`lifecycle-inventory:${inventory.recordDigest}`, `tuple:${sha256(jcs(copy))}`, `input:${baseDigest}`];
    const full = raw ? rawFull : human(copy.copyId, [copy], conditions, 'provider-delete', false, 5 + offset);
    const resources = { objectId: config.recordId, recordClass: config.recordClass, ...Object.fromEntries(['copyId', 'copyKind', 'providerBindingId', 'account', 'objectKey', 'versionId', 'keyId'].map((key) => [key, copy[key]])), inventoryDigest: inventory.recordDigest, tupleDigest };
    const grant = { grantId: copy.copyId, action: raw ? 'lifecycle.crypto-erase' : 'lifecycle.delete-copy', actorSubject: config.actorSubject, upstreamSubject: config.upstreamSubject,
      provider: copy.provider, resourceDomain: copy.provider.endsWith('-b') ? 'provider-b' : 'provider-a', resources, authorityEvidenceDigest: full.authority.recordDigest, inputDigest: baseDigest };
    graph.copies.push({ copyId: copy.copyId, ...(!raw ? { humanBundleBytes: full.bytes, rawGrantBytes: '' } : {}), ...action(copy.copyId, grant, full.authority, 15 + offset) });
  }
  const aggregate = seal(edit('aggregate', { kind: 'aggregate', configDigest, inputDigest: baseDigest, inventoryDigest: inventory.recordDigest,
    receiptDigests: graph.copies.map((entry) => JSON.parse(entry.receiptBytes).recordDigest), allCopiesGone: true, recordedAt: at((continuation ? 28 : 25) + offset) }), 'provider'); graph.aggregateBytes = jcs(aggregate);
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
    if (continuation) {
      const freshHistory = [...historyBytes, eventBytes, ...(options.checkpointHistory ?? []).map((row, index) => event(row.type, historyBytes.length + 2 + index, row.second + offset))];
      const freshHistoryDigest = sha256(jcs(freshHistory));
      const pending = copies.filter((copy) => !options.continueCopies.includes(copy.copyId));
      const freshInventory = seal(edit('checkpoint-inventory', { kind: 'raw-checkpoint-inventory', configDigest, source: 'authoritative-copy-inventory',
        inventoryId: 'fresh-raw-inventory', copies: structuredClone(pending), complete: true, recordedAt: at(20 + offset), validThrough: until }), 'provider');
      const freshState = seal(edit('checkpoint-state', { kind: 'raw-checkpoint-state', configDigest, source: 'authoritative-lifecycle-store', inventoryDigest: freshInventory.recordDigest,
        historyDigest: freshHistoryDigest, historyComplete: true, holdState: 'none', referenceState: 'cleared', recordedAt: at(21 + offset), validThrough: until }), 'authority');
      checkpoint = seal(edit('checkpoint-record', { kind: 'raw-checkpoint', configDigest, source: 'authoritative-raw-recovery', checkpointId: 'checkpoint-1',
        sequence: 1, previousCheckpointDigest: null, consumptionKey: rawGrantBindingDigest, inputDigest: baseDigest, planDigest: plan.recordDigest,
        openingReservationDigest: openingReservation.recordDigest, authorityDigest: rawFull.authority.recordDigest, tupleDigest,
        completed: graph.copies.filter((copy) => options.continueCopies.includes(copy.copyId)).map((copy) => ({ copyId: copy.copyId,
          requestDigest: plannedRequests.get(copy.copyId).recordDigest, receiptDigest: JSON.parse(copy.receiptBytes).recordDigest })),
        remaining: pending.map((copy) => copy.copyId), inventoryDigest: freshInventory.recordDigest, stateDigest: freshState.recordDigest, historyDigest: freshHistoryDigest,
        recordedAt: at(22 + offset), validThrough: until }), 'authority');
      graph.continuationBytes = jcs(edit('checkpoint-envelope', { version: 'steer-raw-checkpoint/v1', policyDigest: checkpointPolicy,
        inventoryBytes: jcs(freshInventory), stateBytes: jcs(freshState), checkpointBytes: jcs(checkpoint), eventBytes: freshHistory.at(-1), historyBytes: freshHistory.slice(0, -1) }));
    }
    const head = emit('head', { source: 'authoritative-cas-store', planDigest: plan.recordDigest, openingReservationDigest: openingReservation.recordDigest, headId: openingHead.headId,
      head: continuation || options.replay ? '8'.repeat(64) : openingHead.head, previousHead: continuation || options.replay ? openingHead.head : openingHead.previousHead,
      sequence: continuation || options.replay ? 2 : 1 }, continuation ? 23 : options.replay ? 26 : 16, 'cas-authority');
    const replay = emit('replay', { source: 'authoritative-replay-store', planDigest: plan.recordDigest, openingReservationDigest: openingReservation.recordDigest, headId: head.headId,
      status: continuation ? 'checkpointed' : options.replay ? 'committed' : 'unused', resultDigest: continuation ? checkpoint.recordDigest : options.replay ? aggregate.recordDigest : null }, continuation ? 23 : options.replay ? 26 : 16, 'replay-authority');
    const reservation = emit('reservation', { source: 'authoritative-cas-store', planDigest: plan.recordDigest, openingReservationDigest: openingReservation.recordDigest, headId: head.headId, headDigest: head.recordDigest,
      replayDigest: replay.recordDigest, expectedHead: head.head, winner: continuation || !options.replay, status: !continuation && options.replay ? 'already-committed' : 'reserved' }, continuation ? 24 : options.replay ? 27 : 16, 'cas-authority');
    const opening = edit('raw-batch-opening', { headBytes: jcs(openingHead), replayBytes: jcs(openingReplay), reservationBytes: jcs(openingReservation) });
    graph.rawBatchBytes = jcs(edit('raw-batch', { version: continuation ? 'steer-raw-batch/v2' : 'steer-raw-batch/v1', policyDigest: rawBatchPolicy, planBytes: jcs(plan), openingBytes: jcs(opening), headBytes: jcs(head), replayBytes: jcs(replay), reservationBytes: jcs(reservation) }));
  }
  const full = human('tombstone', copies, [`lifecycle-inventory:${inventory.recordDigest}`, `aggregate:${aggregate.recordDigest}`, `input:${baseDigest}`,
    ...(continuation ? [`raw-checkpoint:${checkpoint.recordDigest}`] : [])], 'provider-delete', false, (continuation ? 30 : 27) + offset);
  const grant = { grantId: 'tombstone', action: 'lifecycle.commit-tombstone', actorSubject: config.actorSubject, upstreamSubject: config.upstreamSubject,
    provider: 'fixture-provider-a', resourceDomain: 'provider-a', resources: { objectId: config.recordId, recordClass: config.recordClass, inventoryDigest: inventory.recordDigest,
      tupleDigest, aggregateReceiptDigest: aggregate.recordDigest, path: config.tombstonePath }, authorityEvidenceDigest: full.authority.recordDigest, inputDigest: baseDigest };
  graph.tombstone = { humanBundleBytes: full.bytes, ...action('tombstone', grant, full.authority, (continuation ? 38 : 35) + offset) };
  edit('graph', graph); return { graph, config, configBytes, evaluationTime: evaluatedAt, bytes: jcs(graph), verifier: createLifecycleGraphVerifier(configBytes) };
}
const denied = (value, now = evaluation) => assert.deepEqual(value.verifier.verify(value.bytes, now), { state: 'blocked', firstError: 'LIFECYCLE_GRAPH_INVALID', effects: zeroEffects() });

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
