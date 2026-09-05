// Offline successor contract. No credentials, providers, stores or effect executors.
import { exactKeys, hex, jcs, parseCanonical, sha256, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
import { exactInstant as strictTime, timePolicyDigest } from '../0069/exact-time.candidate.mjs';

const copyKeys = ['objectId', 'recordClass', 'copyId', 'copyKind', 'providerBindingId', 'account', 'objectKey', 'versionId', 'keyId', 'inventoryDigest', 'tupleDigest'];
const migrationKeys = ['database', 'schema', 'schemaFrom', 'schemaTo', 'oldAppVersion', 'newAppVersion', 'batch', 'checkpoint', 'executionId', 'planDigest'];
const rule = (action, upstreamAction, principal, role, resourceKeys) => ({ action, upstreamAction, principal, role, upstreamPrincipal: 'operation-authority', resourceKeys });
const actions = [
  { ...rule('github.exam.candidate.commit', 'exam.candidate.author', 'test-agent', 'independent-test-agent', ['path']), upstreamPrincipal: 'exam-authority' },
  rule('lifecycle.delete-copy', 'lifecycle.disposition.authorize', 'lifecycle-worker', 'lifecycle-executor', copyKeys),
  rule('lifecycle.crypto-erase', 'lifecycle.raw-policy.authorize', 'lifecycle-worker', 'lifecycle-executor', copyKeys),
  rule('lifecycle.commit-tombstone', 'lifecycle.tombstone.authorize', 'lifecycle-worker', 'lifecycle-executor', ['objectId', 'recordClass', 'inventoryDigest', 'tupleDigest', 'aggregateReceiptDigest', 'path']),
  ...['expand', 'backfill', 'contract'].map((phase) => rule(`migration.${phase}`, `migration.${phase}.authorize`, 'schema-migration-runner', 'schema-migration-runner', migrationKeys)),
];
export const manifestBytes = jcs({ version: 'steer-protected-actions/v1', denyByDefault: true, actions, timePolicyDigest,
  maxCredentialLifetimeSeconds: 300, maxEvidenceAgeSeconds: 300, maxGrants: 128,
  contract: 'one verifier for all seven actions; exact independently installed grants and nanosecond comparisons; zero effects' });
export const manifestDigest = sha256(manifestBytes);
const common = ['kind', 'contextDigest', 'operationDigest', 'recordedAt', 'validThrough'];
const signed = ['recordDigest', 'signature'];
const recordFields = {
  request: ['operation', 'upstreamDigest', 'downstreamDigest', 'delegationDigest', 'assignmentDigest', 'authorityDigest', 'resourcesDigest'],
  upstream: ['credentialId', 'principal', 'subject', 'provider', 'action', 'oneUse', 'lastUsedAt', 'selectorsDigest'],
  downstream: ['credentialId', 'principal', 'subject', 'provider', 'action', 'oneUse', 'lastUsedAt', 'selectorsDigest'],
  delegation: ['delegationId', 'issuerPrincipal', 'issuerSubject', 'recipientPrincipal', 'recipientSubject', 'upstreamDigest', 'downstreamDigest'],
  assignment: ['assignmentId', 'actorSubject', 'actorRole', 'status'],
  authority: ['authorityId', 'actorSubject', 'actorRole', 'action', 'authorityEvidenceDigest', 'assignmentDigest', 'decision'],
  resources: ['snapshotId', 'provider', 'resources'],
  replay: ['ledgerId', 'source', 'requestDigest', 'idempotencyKey', 'status', 'resultDigest', 'headId'],
  head: ['headId', 'source', 'requestDigest', 'head', 'previousHead', 'sequence'],
  reservation: ['reservationId', 'source', 'requestDigest', 'headId', 'headDigest', 'replayDigest', 'expectedHead', 'idempotencyKey', 'winner', 'status'],
};
const kinds = Object.keys(recordFields);
const text = (value) => typeof value === 'string' && value.length > 0 && value.length <= 512 &&
  !/[\u0000-\u001f\u007f*?]/u.test(value) && value.trim() === value;
const same = (left, right) => jcs(left) === jcs(right);
const fail = () => { throw new Error('PROTECTED_ACTION_INVALID'); };
const requireValue = (condition) => { if (!condition) fail(); };
const deny = () => ({ decision: 'DENY', firstError: 'PROTECTED_ACTION_INVALID', effects: zeroEffects() });

// Only trusted composition installs this immutable context. It must not originate
// from the action envelope, an agent tool argument, or an unverified graph.
export function createProtectedActionVerifier(trustedContextBytes) {
  let context, verifier;
  try {
    requireValue(typeof trustedContextBytes === 'string' && trustedContextBytes.length <= 1048576);
    context = parseCanonical(trustedContextBytes);
    requireValue(exactKeys(context, ['version', 'manifestDigest', 'trustRegistryBytes', 'target', 'scope', 'grants']) &&
      context.version === 'steer-protected-action-context/v1' && context.manifestDigest === manifestDigest);
    const target = context.target;
    requireValue(exactKeys(target, ['examRevision', 'examDigest', 'implementationRevision', 'authorizationPolicyPath', 'authorizationPolicyRevision', 'authorizationPolicyDigest', 'authorizationPolicyBytes']) &&
      ['examRevision', 'implementationRevision', 'authorizationPolicyRevision'].every((key) => hex(target[key], 40)) &&
      hex(target.examDigest, 64) && hex(target.authorizationPolicyDigest, 64) && text(target.authorizationPolicyPath) &&
      !target.authorizationPolicyPath.startsWith('/') && !target.authorizationPolicyPath.split('/').some((part) => ['.', '..', ''].includes(part)) &&
      typeof target.authorizationPolicyBytes === 'string' && target.authorizationPolicyBytes.length > 0 && target.authorizationPolicyBytes.length <= 65536 &&
      sha256(target.authorizationPolicyBytes) === target.authorizationPolicyDigest);
    requireValue(exactKeys(context.scope, ['organization', 'tenant', 'repositoryId', 'installationId', 'item']) && Object.values(context.scope).every(text));
    verifier = createTimedRecordVerifier(context.trustRegistryBytes);
    const registry = parseCanonical(context.trustRegistryBytes);
    requireValue(Array.isArray(context.grants) && context.grants.length > 0 && context.grants.length <= 128);
    const ids = new Set();
    for (const grant of context.grants) {
      requireValue(exactKeys(grant, ['grantId', 'action', 'actorSubject', 'upstreamSubject', 'provider', 'resourceDomain', 'resources', 'authorityEvidenceDigest', 'inputDigest']) &&
        ['grantId', 'action', 'actorSubject', 'upstreamSubject', 'provider', 'resourceDomain'].every((key) => text(grant[key])) &&
        !ids.has(grant.grantId) && hex(grant.authorityEvidenceDigest, 64) && hex(grant.inputDigest, 64));
      ids.add(grant.grantId);
      const action = actions.find((entry) => entry.action === grant.action);
      requireValue(action && exactKeys(grant.resources, action.resourceKeys) && Object.values(grant.resources).every(text));
      for (const [key, value] of Object.entries(grant.resources)) if (key.endsWith('Digest')) requireValue(hex(value, 64));
      // Resource assertions must come from an independently selected provider,
      // never from the ordinary request, runner, credential or authority domain.
      requireValue(/^provider(?:-[a-z0-9-]+)?$/.test(grant.resourceDomain) && registry.bindings.some((binding) => binding.domain === grant.resourceDomain));
      if (grant.action === 'github.exam.candidate.commit') requireValue(grant.provider === 'github' && grant.resources.path === 'intent/0001/EXAM.md');
    }
  } catch { throw new Error('PROTECTED_ACTION_CONFIGURATION_INVALID'); }
  const contextDigest = sha256(trustedContextBytes);
  return Object.freeze({ contextDigest, manifestDigest,
    // evaluationTime is supplied by the trusted invoking service, not serialized
    // into the untrusted bundle. There is intentionally no clock default.
    verify(serialized, evaluationTime) {
      try {
        const now = strictTime(evaluationTime);
        requireValue(now !== null && typeof serialized === 'string' && serialized.length <= 1048576);
        const bundle = parseCanonical(serialized);
        requireValue(exactKeys(bundle, ['version', 'contextDigest', ...kinds.map((kind) => `${kind}Bytes`)]) &&
          bundle.version === 'steer-protected-action-bundle/v1' && bundle.contextDigest === contextDigest);
        const rawRequest = parseCanonical(bundle.requestBytes), operation = rawRequest.operation;
        requireValue(exactKeys(operation, ['requestId', 'grantId', 'idempotencyKey', 'casHead', 'requestedAt']) &&
          ['requestId', 'grantId', 'idempotencyKey'].every((key) => text(operation[key])) && hex(operation.casHead, 64));
        const requested = strictTime(operation.requestedAt);
        requireValue(requested !== null && requested <= now && now - requested <= 300000000000n);
        const grant = context.grants.find((value) => value.grantId === operation.grantId);
        requireValue(grant); const action = actions.find((value) => value.action === grant.action);
        const operationDigest = sha256(jcs({ contextDigest, operation })), records = {};
        for (const kind of kinds) {
          const bytes = bundle[`${kind}Bytes`];
          requireValue(typeof bytes === 'string' && bytes.length > 0 && bytes.length <= 65536);
          const raw = parseCanonical(bytes);
          const domain = kind === 'request' ? 'record' : kind === 'resources' ? grant.resourceDomain :
            kind === 'replay' ? 'replay-authority' : ['head', 'reservation'].includes(kind) ? 'cas-authority' : kind;
          const { record } = verifier.verifyBytes(bytes, { domain, recordedAt: raw.recordedAt, evaluatedAt: evaluationTime });
          requireValue(exactKeys(record, [...common, ...recordFields[kind], ...signed]) && record.kind === kind &&
            record.contextDigest === contextDigest && record.operationDigest === operationDigest);
          const at = strictTime(record.recordedAt), until = strictTime(record.validThrough);
          requireValue(at !== null && until !== null && at <= now && now < until && until - at <= 300000000000n &&
            now - at <= 300000000000n && (['replay', 'head', 'reservation'].includes(kind) || at <= requested));
          records[kind] = record;
        }
        const { request, upstream, downstream, delegation, assignment, authority, resources, replay, head, reservation } = records;
        requireValue(request.recordedAt === operation.requestedAt);
        for (const kind of ['upstream', 'downstream', 'delegation', 'assignment', 'authority', 'resources'])
          requireValue(request[`${kind}Digest`] === records[kind].recordDigest);
        const selectorsDigest = sha256(jcs({ scope: context.scope, target: context.target, grant }));
        for (const [credential, principal, subject, provider, credentialAction] of [
          [upstream, action.upstreamPrincipal, grant.upstreamSubject, 'steer-identity', action.upstreamAction],
          [downstream, action.principal, grant.actorSubject, grant.provider, action.action],
        ]) {
          const used = strictTime(credential.lastUsedAt);
          requireValue(text(credential.credentialId) && credential.principal === principal && credential.subject === subject &&
            credential.provider === provider && credential.action === credentialAction && credential.oneUse === true &&
            credential.selectorsDigest === selectorsDigest && used !== null && strictTime(credential.recordedAt) <= used && used <= requested);
        }
        requireValue(upstream.credentialId !== downstream.credentialId && text(delegation.delegationId) &&
          delegation.issuerPrincipal === upstream.principal && delegation.issuerSubject === upstream.subject &&
          delegation.recipientPrincipal === downstream.principal && delegation.recipientSubject === downstream.subject &&
          delegation.upstreamDigest === upstream.recordDigest && delegation.downstreamDigest === downstream.recordDigest);
        for (const credential of [upstream, downstream]) requireValue(strictTime(delegation.recordedAt) >= strictTime(credential.recordedAt) &&
          strictTime(delegation.validThrough) <= strictTime(credential.validThrough));
        requireValue(text(assignment.assignmentId) && assignment.actorSubject === grant.actorSubject && assignment.actorRole === action.role && assignment.status === 'current');
        requireValue(text(authority.authorityId) && authority.actorSubject === grant.actorSubject && authority.actorRole === action.role &&
          authority.action === action.action && authority.authorityEvidenceDigest === grant.authorityEvidenceDigest &&
          authority.assignmentDigest === assignment.recordDigest && authority.decision === 'authorized' &&
          strictTime(authority.recordedAt) >= strictTime(assignment.recordedAt) && strictTime(authority.validThrough) <= strictTime(assignment.validThrough));
        requireValue(text(resources.snapshotId) && resources.provider === grant.provider && same(resources.resources, grant.resources));
        for (const record of [replay, head, reservation]) requireValue(record.requestDigest === request.recordDigest);
        requireValue(text(replay.ledgerId) && text(head.headId) && text(reservation.reservationId) &&
          replay.source === 'authoritative-replay-store' && head.source === 'authoritative-cas-store' && reservation.source === 'authoritative-cas-store' &&
          replay.headId === head.headId && reservation.headId === head.headId && reservation.headDigest === head.recordDigest &&
          reservation.replayDigest === replay.recordDigest && head.head === operation.casHead && reservation.expectedHead === head.head &&
          hex(head.previousHead, 64) && Number.isSafeInteger(head.sequence) && head.sequence > 0 &&
          replay.idempotencyKey === operation.idempotencyKey && reservation.idempotencyKey === operation.idempotencyKey &&
          strictTime(replay.recordedAt) >= requested && strictTime(head.recordedAt) >= requested &&
          strictTime(reservation.recordedAt) >= strictTime(replay.recordedAt) && strictTime(reservation.recordedAt) >= strictTime(head.recordedAt) &&
          strictTime(reservation.validThrough) <= strictTime(replay.validThrough) && strictTime(reservation.validThrough) <= strictTime(head.validThrough));
        requireValue((replay.status === 'unused' && replay.resultDigest === null && reservation.status === 'reserved' && reservation.winner === true) ||
          (replay.status === 'committed' && hex(replay.resultDigest, 64) && reservation.status === 'already-committed' && reservation.winner === false));
        // Returning a descriptor is not acquiring a token, consuming a credential,
        // reserving CAS, invoking a provider, or executing a lifecycle/migration effect.
        return { decision: replay.status === 'committed' ? 'REPLAY_NOOP' : 'AUTHORIZED_CANDIDATE', firstError: null, effects: zeroEffects(),
          contextDigest, operationDigest, requestDigest: request.recordDigest, action: action.action,
          resourcesDigest: sha256(jcs(grant.resources)), inputDigest: grant.inputDigest, authorityEvidenceDigest: grant.authorityEvidenceDigest,
          evaluatedAt: evaluationTime, validThrough: Object.values(records).map((record) => record.validThrough).sort((a, b) => strictTime(a) < strictTime(b) ? -1 : strictTime(a) > strictTime(b) ? 1 : 0)[0],
          resultDigest: replay.resultDigest, reservationDigest: reservation.recordDigest };
      } catch { return deny(); }
    },
  });
}
