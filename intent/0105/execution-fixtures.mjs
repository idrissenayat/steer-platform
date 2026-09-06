// Closed synthetic fixtures adapted from tests/r5-protected-actions.test.mjs.
// No generic signer, mutation callback, credential, provider or effect API is exported.
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { createProtectedActionVerifier, manifestBytes, manifestDigest } from '../0060/protected-actions.candidate.mjs';
import { makeAuthorizationBundle } from '../0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { jcs, sha256, TRUST_REGISTRY, TARGET_REVISION, TARGET_EXAM_SHA, AUTHORIZATION_POLICY_BYTES, AUTHORIZATION_POLICY_PATH, AUTHORIZATION_POLICY_SHA } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';

const actions = ['lifecycle.delete-copy', 'lifecycle.crypto-erase', 'lifecycle.commit-tombstone', 'migration.expand', 'migration.backfill', 'migration.contract'];
const definitions = JSON.parse(manifestBytes).actions;
const kinds = ['upstream', 'downstream', 'delegation', 'assignment', 'authority', 'resources', 'request', 'replay', 'head', 'reservation'];
const semanticEdits = {
  'upstream-one-use': ['upstream', 'oneUse', false], 'downstream-one-use': ['downstream', 'oneUse', false],
  'actor-substitution': ['downstream', 'subject', 'service:other-worker'], 'delegation-substitution': ['delegation', 'recipientSubject', 'service:other-worker'],
  'wrong-role': ['assignment', 'actorRole', 'builder'], 'revoked-assignment': ['assignment', 'status', 'revoked'],
  'wrong-authority': ['authority', 'authorityEvidenceDigest', 'f'.repeat(64)], 'denied-authority': ['authority', 'decision', 'denied'],
  'caller-replay': ['replay', 'source', 'caller'], 'caller-head': ['head', 'source', 'caller'],
  'stale-head': ['head', 'head', 'b'.repeat(64)], 'wrong-replay-lineage': ['reservation', 'replayDigest', 'f'.repeat(64)],
  'wrong-head-lineage': ['reservation', 'headDigest', 'f'.repeat(64)], 'loser': ['reservation', 'winner', false],
  'wrong-idempotency': ['reservation', 'idempotencyKey', 'other-key'],
};
const at = (second) => `2026-09-04T12:00:${String(second).padStart(2, '0')}Z`;
const evaluation = at(40), until = '2026-09-04T12:03:00Z';
function seal(input, domain) {
  const payload = Object.fromEntries(Object.entries(input).filter(([key]) => !['recordDigest', 'signature'].includes(key))), digest = sha256(jcs(payload));
  const key = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), createHash('sha256').update(`steer-r3-r1-${domain}`).digest()]), format: 'der', type: 'pkcs8' });
  return { ...payload, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-v1`, signedDigest: digest, valueBase64: sign(null, Buffer.from(digest), key).toString('base64') } };
}
function definition(action) {
  if (!actions.includes(action)) throw new Error('UNKNOWN_SHARED_ACTION_FIXTURE');
  return definitions.find((entry) => entry.action === action);
}
export function sharedActionVariants(action) {
  const entry = definition(action);
  return ['positive', 'replay', ...kinds.flatMap((kind) => [`omit:${kind}`, `signature:${kind}`]), ...Object.keys(semanticEdits),
    ...entry.resourceKeys.map((key) => `resource:${key}`), ...['organization', 'tenant', 'repositoryId', 'installationId', 'item'].map((key) => `scope:${key}`),
    ...['examRevision', 'examDigest', 'implementationRevision'].map((key) => `target:${key}`), 'ordinary-replay-signature', 'ordinary-cas-signature', 'expired'];
}
export function sharedActionExecutionCase(actionName, variant = 'positive') {
  const action = definition(actionName);
  if (!sharedActionVariants(actionName).includes(variant)) throw new Error('UNKNOWN_SHARED_ACTION_VARIANT');
  const context = { version: 'steer-protected-action-context/v1', manifestDigest, trustRegistryBytes: jcs(TRUST_REGISTRY),
    target: { examRevision: TARGET_REVISION, examDigest: TARGET_EXAM_SHA, implementationRevision: 'e'.repeat(40),
      authorizationPolicyPath: AUTHORIZATION_POLICY_PATH, authorizationPolicyRevision: TARGET_REVISION,
      authorizationPolicyDigest: AUTHORIZATION_POLICY_SHA, authorizationPolicyBytes: AUTHORIZATION_POLICY_BYTES },
    scope: { organization: 'steer-platform', tenant: 'steer-platform', repositoryId: 'steer-platform', installationId: 'fixture-installation', item: '0001' },
    grants: [{ grantId: 'grant-1', action: actionName, actorSubject: `service:${action.principal}`, upstreamSubject: 'authority:scoped-fixture',
      provider: 'fixture-provider-a', resourceDomain: 'provider-a', authorityEvidenceDigest: sha256('authority-1'), inputDigest: sha256('input-1'),
      resources: Object.fromEntries(action.resourceKeys.map((key) => [key, key.endsWith('Digest') ? sha256(key) : key === 'path' ? 'evidence/tombstone.json' : `exact-${key}`])) }],
  };
  const contextBytes = jcs(context), contextDigest = sha256(contextBytes), grant = context.grants[0];
  const operation = { requestId: 'operation-1', grantId: grant.grantId, idempotencyKey: 'idempotency-1', casHead: 'a'.repeat(64), requestedAt: at(30) };
  const operationDigest = sha256(jcs({ contextDigest, operation })), records = {};
  const emit = (kind, fields, domain, recordedAt = at(10)) => {
    const value = { kind, contextDigest, operationDigest, recordedAt, validThrough: until, ...fields }, edit = semanticEdits[variant];
    if (edit?.[0] === kind) value[edit[1]] = edit[2];
    if (kind === 'resources' && variant.startsWith('resource:')) {
      const key = variant.slice(9); value.resources[key] = key.endsWith('Digest') ? 'f'.repeat(64) : 'substituted-resource';
    }
    if ((variant === 'ordinary-replay-signature' && kind === 'replay') || (variant === 'ordinary-cas-signature' && kind === 'reservation')) domain = 'record';
    return records[kind] = seal(value, domain);
  };
  const selectorsDigest = sha256(jcs({ scope: context.scope, target: context.target, grant }));
  const upstream = emit('upstream', { credentialId: 'credential-up', principal: action.upstreamPrincipal, subject: grant.upstreamSubject,
    provider: 'steer-identity', action: action.upstreamAction, oneUse: true, lastUsedAt: at(20), selectorsDigest }, 'upstream');
  const downstream = emit('downstream', { credentialId: 'credential-down', principal: action.principal, subject: grant.actorSubject,
    provider: grant.provider, action: action.action, oneUse: true, lastUsedAt: at(20), selectorsDigest }, 'downstream');
  emit('delegation', { delegationId: 'delegation-1', issuerPrincipal: upstream.principal, issuerSubject: upstream.subject,
    recipientPrincipal: downstream.principal, recipientSubject: downstream.subject, upstreamDigest: upstream.recordDigest, downstreamDigest: downstream.recordDigest }, 'delegation', at(15));
  const assignment = emit('assignment', { assignmentId: 'assignment-1', actorSubject: grant.actorSubject, actorRole: action.role, status: 'current' }, 'assignment');
  emit('authority', { authorityId: 'authority-1', actorSubject: grant.actorSubject, actorRole: action.role, action: action.action,
    authorityEvidenceDigest: grant.authorityEvidenceDigest, assignmentDigest: assignment.recordDigest, decision: 'authorized' }, 'authority', at(20));
  emit('resources', { snapshotId: 'snapshot-1', provider: grant.provider, resources: structuredClone(grant.resources) }, grant.resourceDomain, at(25));
  const request = emit('request', { operation, ...Object.fromEntries(['upstream', 'downstream', 'delegation', 'assignment', 'authority', 'resources'].map((kind) => [`${kind}Digest`, records[kind].recordDigest])) }, 'record', at(30));
  const replay = emit('replay', { ledgerId: 'ledger-1', source: 'authoritative-replay-store', requestDigest: request.recordDigest,
    idempotencyKey: operation.idempotencyKey, status: variant === 'replay' ? 'committed' : 'unused', resultDigest: variant === 'replay' ? 'd'.repeat(64) : null, headId: 'head-1' }, 'replay-authority', at(31));
  const head = emit('head', { headId: 'head-1', source: 'authoritative-cas-store', requestDigest: request.recordDigest,
    head: operation.casHead, previousHead: '9'.repeat(64), sequence: 4 }, 'cas-authority', at(31));
  emit('reservation', { reservationId: 'reservation-1', source: 'authoritative-cas-store', requestDigest: request.recordDigest, headId: head.headId,
    headDigest: head.recordDigest, replayDigest: replay.recordDigest, expectedHead: head.head, idempotencyKey: operation.idempotencyKey,
    winner: variant !== 'replay', status: variant === 'replay' ? 'already-committed' : 'reserved' }, 'cas-authority', at(32));
  const bundle = { version: 'steer-protected-action-bundle/v1', contextDigest, ...Object.fromEntries(Object.entries(records).map(([kind, record]) => [`${kind}Bytes`, jcs(record)])) };
  if (variant.startsWith('omit:')) delete bundle[`${variant.slice(5)}Bytes`];
  if (variant.startsWith('signature:')) {
    const field = `${variant.slice(10)}Bytes`, record = JSON.parse(bundle[field]); record.signature.valueBase64 = Buffer.alloc(64).toString('base64'); bundle[field] = jcs(record);
  }
  // These transplants alter the independently installed verifier, not the candidate's own context.
  const installed = structuredClone(context);
  if (variant.startsWith('scope:')) installed.scope[variant.slice(6)] = 'other-scope';
  if (variant.startsWith('target:')) { const field = variant.slice(7); installed.target[field] = 'f'.repeat(field === 'examDigest' ? 64 : 40); }
  const installedContextBytes = jcs(installed), bytes = jcs(bundle), evaluatedAt = variant === 'expired' ? until : evaluation;
  return { action: actionName, variant, bytes, installedContextBytes, evaluatedAt, records,
    input: jcs({ installedContextBytes, bytes, evaluatedAt }), verifier: createProtectedActionVerifier(installedContextBytes) };
}
export function legacyUnlistedActionCase(action) {
  definition(action); const bundle = makeAuthorizationBundle(), request = JSON.parse(bundle.requestBytes);
  request.action = action; bundle.requestBytes = jcs(seal(request, 'record')); return bundle;
}
