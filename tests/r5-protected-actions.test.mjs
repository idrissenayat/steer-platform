import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { createProtectedActionVerifier, manifestBytes, manifestDigest } from '../intent/0060/protected-actions.candidate.mjs';
import { jcs, sha256, TRUST_REGISTRY, TARGET_REVISION, TARGET_EXAM_SHA, AUTHORIZATION_POLICY_BYTES, AUTHORIZATION_POLICY_PATH, AUTHORIZATION_POLICY_SHA, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { authorizationDecision } from '../intent/0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { makeAuthorizationBundle } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';

// Synthetic keys remain private to this test module. No real credential is read.
const signFixture = (input, domain) => {
  const payload = Object.fromEntries(Object.entries(input).filter(([key]) => !['recordDigest', 'signature'].includes(key)));
  const digest = sha256(jcs(payload));
  const key = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), createHash('sha256').update(`steer-r3-r1-${domain}`).digest()]), format: 'der', type: 'pkcs8' });
  return { ...payload, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-v1`, signedDigest: digest, valueBase64: sign(null, Buffer.from(digest), key).toString('base64') } };
};
const definitions = JSON.parse(manifestBytes).actions;
const at = (second) => `2026-09-04T12:00:${String(second).padStart(2, '0')}Z`;
const until = '2026-09-04T12:03:00Z';
const evaluation = at(40);
function trustedContext() {
  return { version: 'steer-protected-action-context/v1', manifestDigest, trustRegistryBytes: jcs(TRUST_REGISTRY),
    target: { examRevision: TARGET_REVISION, examDigest: TARGET_EXAM_SHA, implementationRevision: 'e'.repeat(40),
      authorizationPolicyPath: AUTHORIZATION_POLICY_PATH, authorizationPolicyRevision: TARGET_REVISION,
      authorizationPolicyDigest: AUTHORIZATION_POLICY_SHA, authorizationPolicyBytes: AUTHORIZATION_POLICY_BYTES },
    scope: { organization: 'steer-platform', tenant: 'steer-platform', repositoryId: 'steer-platform', installationId: 'fixture-installation', item: '0001' },
    grants: definitions.map((action, index) => ({ grantId: `grant-${index}`, action: action.action, actorSubject: `service:${action.principal}`, upstreamSubject: 'authority:scoped-fixture',
      provider: index === 0 ? 'github' : 'fixture-provider-a', resourceDomain: 'provider-a', authorityEvidenceDigest: sha256(`authority-${index}`), inputDigest: sha256(`input-${index}`),
      resources: Object.fromEntries(action.resourceKeys.map((key) => [key, key.endsWith('Digest') ? sha256(key) : key === 'path' ? 'intent/0001/EXAM.md' : `exact-${key}`])),
    })),
  };
}
function fixture(index = 1, edits = {}, options = {}) {
  const context = options.context ?? trustedContext(), contextBytes = jcs(context), contextDigest = sha256(contextBytes);
  const grant = context.grants[index], action = definitions.find((entry) => entry.action === grant.action);
  const operation = { requestId: 'operation-1', grantId: grant.grantId, idempotencyKey: 'idempotency-1', casHead: 'a'.repeat(64), requestedAt: at(30), ...options.operation };
  const operationDigest = sha256(jcs({ contextDigest, operation })), records = {};
  const emit = (kind, fields, domain, recordedAt = at(10)) => {
    const value = { kind, contextDigest, operationDigest, recordedAt, validThrough: until, ...fields };
    edits[kind]?.(value);
    return records[kind] = signFixture(value, options.domains?.[kind] ?? domain);
  };
  const selectorsDigest = sha256(jcs({ scope: context.scope, target: context.target, grant }));
  const upstream = emit('upstream', { credentialId: 'credential-up', principal: action.upstreamPrincipal, subject: grant.upstreamSubject,
    provider: 'steer-identity', action: action.upstreamAction, oneUse: true, lastUsedAt: at(20), selectorsDigest }, 'upstream');
  const downstream = emit('downstream', { credentialId: 'credential-down', principal: action.principal, subject: grant.actorSubject,
    provider: grant.provider, action: action.action, oneUse: true, lastUsedAt: at(20), selectorsDigest }, 'downstream');
  const delegation = emit('delegation', { delegationId: 'delegation-1', issuerPrincipal: upstream.principal, issuerSubject: upstream.subject,
    recipientPrincipal: downstream.principal, recipientSubject: downstream.subject, upstreamDigest: upstream.recordDigest, downstreamDigest: downstream.recordDigest }, 'delegation', at(15));
  const assignment = emit('assignment', { assignmentId: 'assignment-1', actorSubject: grant.actorSubject, actorRole: action.role, status: 'current' }, 'assignment');
  const authority = emit('authority', { authorityId: 'authority-1', actorSubject: grant.actorSubject, actorRole: action.role, action: action.action,
    authorityEvidenceDigest: grant.authorityEvidenceDigest, assignmentDigest: assignment.recordDigest, decision: 'authorized' }, 'authority', at(20));
  const resources = emit('resources', { snapshotId: 'snapshot-1', provider: grant.provider, resources: structuredClone(grant.resources) }, grant.resourceDomain, at(25));
  const request = emit('request', { operation, upstreamDigest: upstream.recordDigest, downstreamDigest: downstream.recordDigest,
    delegationDigest: delegation.recordDigest, assignmentDigest: assignment.recordDigest, authorityDigest: authority.recordDigest, resourcesDigest: resources.recordDigest }, 'record', at(30));
  const replay = emit('replay', { ledgerId: 'ledger-1', source: 'authoritative-replay-store', requestDigest: request.recordDigest,
    idempotencyKey: operation.idempotencyKey, status: options.replay ? 'committed' : 'unused', resultDigest: options.replay ? 'd'.repeat(64) : null, headId: 'head-1' }, 'replay-authority', at(31));
  const head = emit('head', { headId: 'head-1', source: 'authoritative-cas-store', requestDigest: request.recordDigest,
    head: operation.casHead, previousHead: '9'.repeat(64), sequence: 4 }, 'cas-authority', at(31));
  emit('reservation', { reservationId: 'reservation-1', source: 'authoritative-cas-store', requestDigest: request.recordDigest, headId: head.headId,
    headDigest: head.recordDigest, replayDigest: replay.recordDigest, expectedHead: head.head, idempotencyKey: operation.idempotencyKey,
    winner: !options.replay, status: options.replay ? 'already-committed' : 'reserved' }, 'cas-authority', at(32));
  const bundle = { version: 'steer-protected-action-bundle/v1', contextDigest, ...Object.fromEntries(Object.entries(records).map(([kind, record]) => [`${kind}Bytes`, jcs(record)])) };
  return { context, contextBytes, bundle, records, bytes: jcs(bundle), verifier: createProtectedActionVerifier(contextBytes) };
}
const rejected = (value, expectedVerifier = value.verifier, now = evaluation) => {
  const result = expectedVerifier.verify(value.bytes, now);
  assert.deepEqual(result, { decision: 'DENY', firstError: 'PROTECTED_ACTION_INVALID', effects: zeroEffects() });
};

test('one successor verifier covers the prior Exam action and all six omitted lifecycle/migration actions', () => {
  assert.equal(definitions.length, 7);
  assert.equal(new Set(definitions.map((action) => action.action)).size, 7);
  for (const [index, action] of definitions.entries()) {
    const value = fixture(index), result = value.verifier.verify(value.bytes, evaluation);
    assert.equal(result.decision, 'AUTHORIZED_CANDIDATE', action.action);
    assert.equal(result.action, action.action);
    assert.equal(result.requestDigest, value.records.request.recordDigest);
    assert.deepEqual(result.effects, zeroEffects());
    assert.equal(result.evaluatedAt, evaluation);
    assert.equal(result.validThrough, until);
    rejected(fixture(index, { assignment: (record) => { record.actorRole = 'builder'; } }));
    for (const kind of Object.keys(value.records)) {
      const incomplete = { ...value.bundle }; delete incomplete[`${kind}Bytes`];
      rejected({ ...value, bytes: jcs(incomplete) });
    }
    const replay = fixture(index, {}, { replay: true });
    assert.equal(replay.verifier.verify(replay.bytes, evaluation).decision, 'REPLAY_NOOP');
    const old = makeAuthorizationBundle(), request = JSON.parse(old.requestBytes);
    request.action = action.action; old.requestBytes = jcs(signFixture(request, 'record'));
    if (index) assert.equal(authorizationDecision(old).firstError, 'ACTION_UNLISTED');
  }
});

test('each signed authority boundary denies hostile semantics even with downstream lineage re-signed', () => {
  const cases = [
    ['upstream', 'principal', 'builder'], ['upstream', 'subject', 'other-authority'], ['upstream', 'provider', 'github'],
    ['upstream', 'action', 'lifecycle.raw-policy.authorize'], ['upstream', 'oneUse', false], ['upstream', 'selectorsDigest', 'f'.repeat(64)],
    ['downstream', 'principal', 'platform-agent'], ['downstream', 'subject', 'service:other-worker'], ['downstream', 'action', 'migration.expand'],
    ['downstream', 'provider', 'other-provider'], ['downstream', 'oneUse', false], ['downstream', 'credentialId', 'credential-up'],
    ['delegation', 'issuerSubject', 'other-authority'], ['delegation', 'recipientSubject', 'other-worker'], ['delegation', 'upstreamDigest', 'f'.repeat(64)],
    ['delegation', 'downstreamDigest', 'f'.repeat(64)], ['assignment', 'actorRole', 'builder'], ['assignment', 'actorSubject', 'other-worker'],
    ['assignment', 'status', 'revoked'], ['authority', 'decision', 'denied'], ['authority', 'action', 'lifecycle.crypto-erase'],
    ['authority', 'actorSubject', 'other-worker'], ['authority', 'authorityEvidenceDigest', 'f'.repeat(64)], ['authority', 'assignmentDigest', 'f'.repeat(64)],
    ['resources', 'provider', 'other-provider'], ['replay', 'source', 'caller'], ['head', 'source', 'caller'], ['reservation', 'source', 'caller'],
    ['replay', 'requestDigest', 'f'.repeat(64)], ['head', 'requestDigest', 'f'.repeat(64)], ['reservation', 'requestDigest', 'f'.repeat(64)],
    ['replay', 'headId', 'other-head'], ['reservation', 'headId', 'other-head'], ['reservation', 'headDigest', 'f'.repeat(64)],
    ['reservation', 'replayDigest', 'f'.repeat(64)], ['head', 'head', 'b'.repeat(64)], ['head', 'sequence', 0], ['head', 'previousHead', 'bad'],
    ['reservation', 'expectedHead', 'b'.repeat(64)], ['reservation', 'winner', false], ['reservation', 'status', 'lost'],
    ['replay', 'idempotencyKey', 'other-key'], ['reservation', 'idempotencyKey', 'other-key'], ['replay', 'resultDigest', 'f'.repeat(64)],
  ];
  for (const [kind, field, value] of cases) rejected(fixture(1, { [kind]: (record) => { record[field] = value; } }));
  for (const role of ['originator', 'platform-agent', 'worker', 'builder', 'compromised-caller', 'fallback'])
    rejected(fixture(1, { assignment: (record) => { record.actorRole = role; } }));
});

test('exact resource sets, context target/policy/actor isolation and action transplants fail closed', () => {
  for (const [index, action] of definitions.entries()) {
    for (const key of action.resourceKeys) {
      rejected(fixture(index, { resources: (record) => { record.resources[key] = '*'; } }));
      rejected(fixture(index, { resources: (record) => { delete record.resources[key]; } }));
      rejected(fixture(index, { resources: (record) => { record.resources[key] = 'wrong-exact-value'; } }));
    }
    rejected(fixture(index, { resources: (record) => { record.resources.admin = 'all'; } }));
  }
  const baseline = fixture();
  for (const field of Object.keys(baseline.context.target)) {
    const changed = trustedContext();
    if (field === 'authorizationPolicyBytes' || field === 'authorizationPolicyDigest') {
      changed.target.authorizationPolicyBytes += '\n'; changed.target.authorizationPolicyDigest = sha256(changed.target.authorizationPolicyBytes);
    } else changed.target[field] = field.endsWith('Revision') ? 'f'.repeat(40) : field.endsWith('Digest') ? 'f'.repeat(64) : 'other/policy.json';
    rejected(fixture(1, {}, { context: changed }), baseline.verifier);
  }
  for (const field of Object.keys(baseline.context.scope)) {
    const changed = trustedContext(); changed.scope[field] = 'other-scope';
    rejected(fixture(1, {}, { context: changed }), baseline.verifier);
  }
  for (const kind of Object.keys(baseline.records)) {
    const other = fixture(2), altered = structuredClone(baseline.bundle);
    altered[`${kind}Bytes`] = other.bundle[`${kind}Bytes`]; rejected({ bytes: jcs(altered), verifier: baseline.verifier });
  }
});

test('every evidence domain uses explicit record and evaluation time, closed schemas and independent signatures', () => {
  for (const kind of Object.keys(fixture().records)) {
    rejected(fixture(1, { [kind]: (record) => { record.recordedAt = '2000-01-01T00:00:00Z'; } }));
    rejected(fixture(1, { [kind]: (record) => { record.validThrough = evaluation; } }));
    rejected(fixture(1, { [kind]: (record) => { record.recordedAt = 'invalid'; } }));
    rejected(fixture(1, { [kind]: (record) => { record.extra = 'untrusted-content-must-not-escape'; } }));
    if (kind !== 'request') rejected(fixture(1, {}, { domains: { [kind]: 'record' } }));
    const value = fixture(), record = JSON.parse(value.bundle[`${kind}Bytes`]);
    record.signature.valueBase64 = Buffer.alloc(64).toString('base64');
    value.bundle[`${kind}Bytes`] = jcs(record); rejected({ ...value, bytes: jcs(value.bundle) });
  }
  const value = fixture();
  assert.equal(value.verifier.verify(value.bytes).decision, 'DENY');
  rejected(value, value.verifier, at(29));
  rejected(value, value.verifier, '2027-09-01T00:00:00Z');
  for (const kind of ['upstream', 'downstream']) {
    rejected(fixture(1, { [kind]: (record) => { record.lastUsedAt = at(5); } }));
    rejected(fixture(1, { [kind]: (record) => { record.lastUsedAt = at(31); } }));
    rejected(fixture(1, { [kind]: (record) => { record.validThrough = '2026-09-04T12:06:00Z'; } }));
  }
  rejected(fixture(1, { delegation: (record) => { record.recordedAt = at(5); } }));
  rejected(fixture(1, { delegation: (record) => { record.validThrough = '2026-09-04T12:03:01Z'; } }));
  rejected(fixture(1, { authority: (record) => { record.recordedAt = at(5); } }));
  rejected(fixture(1, { resources: (record) => { record.recordedAt = at(31); } }));
  rejected(fixture(1, { replay: (record) => { record.recordedAt = at(29); } }));
  rejected(fixture(1, { head: (record) => { record.recordedAt = at(29); } }));
  rejected(fixture(1, { reservation: (record) => { record.recordedAt = at(30); } }));
  for (const domain of ['record', 'upstream', 'downstream', 'delegation', 'assignment', 'authority', 'provider-a', 'replay-authority', 'cas-authority']) {
    const context = trustedContext(), registry = JSON.parse(context.trustRegistryBytes);
    registry.bindings.find((binding) => binding.domain === domain).revokedAt = at(35);
    context.trustRegistryBytes = jcs(registry);
    rejected(fixture(1, {}, { context }));
  }
});

test('replay needs exact result/head/reservation lineage and cannot short circuit invalid authority', () => {
  const options = { replay: true };
  for (const [kind, field, value] of [
    ['replay', 'resultDigest', null], ['replay', 'requestDigest', 'f'.repeat(64)], ['replay', 'status', 'unknown'],
    ['reservation', 'winner', true], ['reservation', 'status', 'reserved'], ['reservation', 'headDigest', 'f'.repeat(64)],
    ['authority', 'decision', 'denied'], ['downstream', 'oneUse', false],
    ['request', 'upstreamDigest', 'f'.repeat(64)],
  ]) rejected(fixture(1, { [kind]: (record) => { record[field] = value; } }, options));
  const value = fixture(1, {}, options), request = JSON.parse(value.bundle.requestBytes);
  request.operation.idempotencyKey = 'retry-drift'; value.bundle.requestBytes = jcs(signFixture(request, 'record'));
  rejected({ ...value, bytes: jcs(value.bundle) });
});

test('trusted context and public envelope are bounded, immutable and cannot accept caller-installed grants', () => {
  const invalidConfig = (mutate) => { const context = trustedContext(); mutate(context); assert.throws(() => createProtectedActionVerifier(jcs(context)), /PROTECTED_ACTION_CONFIGURATION_INVALID/); };
  invalidConfig((context) => { context.grants.push(structuredClone(context.grants[0])); });
  invalidConfig((context) => { context.grants[1].action = 'unlisted-action'; });
  invalidConfig((context) => { context.manifestDigest = 'f'.repeat(64); });
  invalidConfig((context) => { context.grants[1].resources.objectKey = '*'; });
  invalidConfig((context) => { context.grants[1].resourceDomain = 'record'; });
  invalidConfig((context) => { context.grants[1].resourceDomain = 'provider-unknown'; });
  invalidConfig((context) => { context.target.authorizationPolicyBytes = 'substituted'; });
  invalidConfig((context) => { context.target.authorizationPolicyPath = '../policy.json'; });
  invalidConfig((context) => { context.grants[0].resources.path = 'intent/0001/BRIEF.md'; });
  invalidConfig((context) => { context.grants = []; });
  assert.throws(() => createProtectedActionVerifier(' '.repeat(1048577)), /PROTECTED_ACTION_CONFIGURATION_INVALID/);
  const value = fixture();
  for (const bytes of [value.bytes + '\n', ' '.repeat(1048577), '{"version":1,"version":2}', '{}']) rejected({ ...value, bytes });
  for (const key of Object.keys(value.bundle)) {
    const bundle = structuredClone(value.bundle); delete bundle[key]; rejected({ ...value, bytes: jcs(bundle) });
  }
  for (const field of ['trustRegistryBytes', 'manifestBytes', 'contextBytes', 'evaluationTime', 'casWinner']) {
    rejected({ ...value, bytes: jcs({ ...value.bundle, [field]: 'caller-controlled' }) });
  }
  const oversized = { ...value.bundle, upstreamBytes: ' '.repeat(65537) };
  rejected({ ...value, bytes: jcs(oversized) });
  value.context.grants[1].actorSubject = 'caller:changed-after-install';
  assert.equal(value.verifier.verify(value.bytes, evaluation).decision, 'AUTHORIZED_CANDIDATE');
});
