import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createLifecycleGraphVerifier, lifecycleBoundary, policyDigest } from '../intent/0061/lifecycle-graph.candidate.mjs';
import { humanAuthorityBindingDigest } from '../intent/0058/human-authority.candidate.mjs';
import { manifestBytes, manifestDigest } from '../intent/0060/protected-actions.candidate.mjs';
import { exactInstant, formatExactInstant } from '../intent/0069/exact-time.candidate.mjs';
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
  const copies = ['a', 'b'].map((suffix, index) => ({ copyId: `copy-${index + 1}`, copyKind: raw ? 'temporary-working' : 'replica', provider: `fixture-provider-${suffix}`,
    providerBindingId: `fixture-provider-${suffix}-binding`, account: `fixture-account-${suffix}`, objectKey: `object-${index}`, versionId: 'version-1', keyId: `key-${index}`, sourceOriginal: false }));
  edit('copies', copies);
  const inventory = seal(edit('inventory', { kind: 'inventory', configDigest, inventoryId: 'inventory-1', source: 'authoritative-copy-inventory', copies, complete: true, recordedAt: at(1), validThrough: until }), options.inventoryDomain ?? 'provider');
  const provenance = config.recordClass === 'RC-CORPUS-PROVENANCE';
  const derived = provenance ? seal(edit('derived-inventory', { kind: 'derived-inventory', configDigest, source: 'authoritative-derived-record-manifest',
    manifestId: 'derived-manifest-1', corpusId: 'corpusId-value', corpusVersion: 'corpusVersion-value', complete: true,
    entries: [...historyBytes, eventBytes].map(JSON.parse).filter((event) => event.eventType === 'derived-record-deleted').map((event) => ({ derivedRecordId: event.derivedRecordId, derivedRecordClass: event.derivedRecordClass, deletionEventId: event.eventId })),
    recordedAt: at(1), validThrough: until }), options.derivedDomain ?? 'provider') : null;
  const state = seal(edit('state', { kind: 'state', configDigest, source: 'authoritative-lifecycle-store', inventoryDigest: inventory.recordDigest,
    historyDigest: sha256(jcs([...historyBytes, eventBytes])), historyComplete: true, holdState: 'none', referenceState: 'cleared', referenceRevocationDigest: null, parentExpiryAt: null, recordedAt: at(2), validThrough: until,
    ...(provenance ? { derivedInventoryDigest: derived.recordDigest } : {}) }), options.stateDomain ?? 'authority');
  const graph = { version: 'steer-lifecycle-graph/v1', configDigest, policyDigest, eventBytes, historyBytes, inventoryBytes: jcs(inventory), stateBytes: jcs(state), referenceRevocationBytes: '', copies: [], aggregateBytes: '', tombstone: {},
    ...(provenance ? { derivedInventoryBytes: jcs(derived) } : {}) };
  const tupleDigest = sha256(jcs(copies)), baseDigest = sha256(jcs({ configDigest, policyDigest, eventBytes, historyBytes, inventoryBytes: graph.inventoryBytes, stateBytes: graph.stateBytes, referenceRevocationBytes: '',
    ...(provenance ? { derivedInventoryBytes: graph.derivedInventoryBytes } : {}) }));
  function human(label, selected, conditions, method, isRaw, second) {
    const bundle = makeHumanAuthorityBundle(), prior = JSON.parse(bundle.authorityBytes);
    const humanInventory = seal({ inventoryId: `human-inventory-${label}`, organization: scope.organization, tenant: scope.tenant, item: scope.item,
      items: selected.map((copy) => ({ copyId: copy.copyId, provider: copy.provider, objectDigest: sha256(jcs(copy)) })),
      lifecycleInventoryDigest: inventory.recordDigest, tupleDigest, capturedAt: at(2) }, 'record');
    const identity = seal({ ...JSON.parse(bundle.identityEvidenceBytes), verifiedAt: at(second - 1) }, 'provider');
    let authority = edit(`${label}:human`, { ...prior, authorityId: `human-${label}`, authorityType: isRaw ? 'raw-policy-grant' : 'disposition-authorization',
      identityEvidenceDigest: identity.recordDigest, copyInventoryDigest: humanInventory.recordDigest, conditions, allowedCopyProviders: [...new Set(selected.map((copy) => copy.provider))].sort(),
      eraseMethod: method, terminalEventId: trigger.eventId, authenticatedAt: at(second - 1), decidedAt: at(second), idempotencyKey: `human-idem-${label}`, providerRecordId: `human-provider-${label}` });
    const proof = seal({ ...JSON.parse(bundle.providerProofBytes), providerRecordId: authority.providerRecordId, authorityBindingDigest: humanAuthorityBindingDigest(authority), recordedAt: authority.decidedAt }, 'human-provider');
    authority = seal({ ...authority, providerProofDigest: proof.recordDigest }, 'authority');
    const head = seal({ ...JSON.parse(bundle.casHeadBytes), headId: `human-head-${label}`, snapshotAt: at(second), validThrough: until }, 'cas-authority');
    const replay = seal({ ...JSON.parse(bundle.replayLedgerBytes), headId: head.headId, snapshotAt: at(second), validThrough: until }, 'replay-authority');
    const reservation = seal({ ...JSON.parse(bundle.casReservationBytes), idempotencyKey: authority.idempotencyKey, requestDigest: authority.recordDigest,
      authorityDigest: authority.recordDigest, headId: head.headId, reservationId: `human-reserve-${label}`, recordedAt: at(second + 1), validThrough: until }, 'cas-authority');
    Object.assign(bundle, { authorityBytes: jcs(authority), providerProofBytes: jcs(proof), identityEvidenceBytes: jcs(identity), inventoryBytes: jcs(humanInventory),
      casHeadBytes: jcs(head), replayLedgerBytes: jcs(replay), casReservationBytes: jcs(reservation), evaluationTime: evaluatedAt });
    edit(`${label}:human-bundle`, bundle);
    return { bytes: jcs(bundle), authority };
  }
  function action(label, grant, authority, second) {
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
    const receipt = seal(edit(`${label}:receipt`, { kind: 'receipt', configDigest, contextDigest, inputDigest: baseDigest, requestDigest: request.recordDigest,
      resourcesDigest: sha256(jcs(grant.resources)), authorityDigest: authority.recordDigest, action: grant.action, transactionId: `transaction-${label}`,
      effect: grant.action === 'lifecycle.crypto-erase' ? 'crypto-erased' : grant.action === 'lifecycle.commit-tombstone' ? 'tombstone-committed' : 'deleted', status: 'terminal-success', recordedAt: at(second + 4) }), grant.resourceDomain);
    const replay = emit('replay', { ledgerId: `replay-${label}`, source: 'authoritative-replay-store', requestDigest: request.recordDigest, idempotencyKey: operation.idempotencyKey,
      status: options.replay ? 'committed' : 'unused', resultDigest: options.replay ? receipt.recordDigest : null, headId: `head-${label}` }, 'replay-authority', at(second + (options.replay ? 5 : 1)));
    const head = emit('head', { headId: `head-${label}`, source: 'authoritative-cas-store', requestDigest: request.recordDigest, head: operation.casHead, previousHead: '9'.repeat(64), sequence: 4 }, 'cas-authority', at(second + 1));
    emit('reservation', { reservationId: `reserve-${label}`, source: 'authoritative-cas-store', requestDigest: request.recordDigest, headId: head.headId,
      headDigest: head.recordDigest, replayDigest: replay.recordDigest, expectedHead: head.head, idempotencyKey: operation.idempotencyKey, winner: !options.replay,
      status: options.replay ? 'already-committed' : 'reserved' }, 'cas-authority', at(second + (options.replay ? 6 : 2)));
    const bundle = { version: 'steer-protected-action-bundle/v1', contextDigest, ...Object.fromEntries(Object.entries(records).map(([kind, record]) => [`${kind}Bytes`, jcs(record)])) };
    edit(`${label}:action-bundle`, bundle); return { actionBundleBytes: jcs(bundle), receiptBytes: jcs(receipt) };
  }
  for (const copy of copies) {
    const conditions = [`lifecycle-inventory:${inventory.recordDigest}`, `tuple:${sha256(jcs(copy))}`, `input:${baseDigest}`];
    const full = human(copy.copyId, [copy], conditions, raw ? 'cryptographic-erase' : 'provider-delete', raw, 5 + offset);
    const resources = { objectId: config.recordId, recordClass: config.recordClass, ...Object.fromEntries(['copyId', 'copyKind', 'providerBindingId', 'account', 'objectKey', 'versionId', 'keyId'].map((key) => [key, copy[key]])), inventoryDigest: inventory.recordDigest, tupleDigest };
    const grant = { grantId: copy.copyId, action: raw ? 'lifecycle.crypto-erase' : 'lifecycle.delete-copy', actorSubject: config.actorSubject, upstreamSubject: config.upstreamSubject,
      provider: copy.provider, resourceDomain: copy.provider.endsWith('-b') ? 'provider-b' : 'provider-a', resources, authorityEvidenceDigest: full.authority.recordDigest, inputDigest: baseDigest };
    const rawGrant = raw ? jcs(edit(`${copy.copyId}:raw`, { version: 'steer-raw-policy-grant/v4', authority: full.authority, recordClass: config.recordClass,
      sanitizerRevision: trigger.sanitizerRevision, inspectorRevision: trigger.inspectionRevision, completeInventoryRequired: true, receiptRequired: true, permittedTargetKind: 'temporary-copy-only' })) : '';
    graph.copies.push({ copyId: copy.copyId, humanBundleBytes: full.bytes, rawGrantBytes: rawGrant, ...action(copy.copyId, grant, full.authority, 15 + offset) });
  }
  const aggregate = seal(edit('aggregate', { kind: 'aggregate', configDigest, inputDigest: baseDigest, inventoryDigest: inventory.recordDigest,
    receiptDigests: graph.copies.map((entry) => JSON.parse(entry.receiptBytes).recordDigest), allCopiesGone: true, recordedAt: at(25 + offset) }), 'provider'); graph.aggregateBytes = jcs(aggregate);
  const full = human('tombstone', copies, [`lifecycle-inventory:${inventory.recordDigest}`, `aggregate:${aggregate.recordDigest}`, `input:${baseDigest}`], 'provider-delete', false, 27 + offset);
  const grant = { grantId: 'tombstone', action: 'lifecycle.commit-tombstone', actorSubject: config.actorSubject, upstreamSubject: config.upstreamSubject,
    provider: 'fixture-provider-a', resourceDomain: 'provider-a', resources: { objectId: config.recordId, recordClass: config.recordClass, inventoryDigest: inventory.recordDigest,
      tupleDigest, aggregateReceiptDigest: aggregate.recordDigest, path: config.tombstonePath }, authorityEvidenceDigest: full.authority.recordDigest, inputDigest: baseDigest };
  graph.tombstone = { humanBundleBytes: full.bytes, ...action('tombstone', grant, full.authority, 35 + offset) };
  edit('graph', graph); return { graph, config, configBytes, evaluationTime: evaluatedAt, bytes: jcs(graph), verifier: createLifecycleGraphVerifier(configBytes) };
}
const denied = (value, now = evaluation) => assert.deepEqual(value.verifier.verify(value.bytes, now), { state: 'blocked', firstError: 'LIFECYCLE_GRAPH_INVALID', effects: zeroEffects() });

test('composed lifecycle validates both providers and all three protected operations, including exact replay', () => {
  for (const recordClass of ['RC-REBUILDABLE', 'RC-CORPUS-RAW-WORKING']) for (const replay of [false, true]) {
    const value = fixture({ recordClass, replay }), before = value.bytes, result = value.verifier.verify(value.bytes, evaluation);
    assert.equal(result.state, 'validated-lifecycle-candidate', JSON.stringify({ recordClass, replay, result }));
    assert.equal(result.copyCount, 2); assert.equal(result.protectedActionCount, 3); assert.equal(result.replayCount, replay ? 3 : 0);
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
    denied(fixture({ recordClass, edits: { 'copy-2:raw': (record) => { record[field] = value; } } }));
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
      assert.equal(result.protectedActionCount, 3); assert.equal(result.replayCount, replay ? 3 : 0);
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
