// Offline audit of the original authorization contract, not a write capability.
import { readFileSync } from 'node:fs';
import { authorizationDecision } from '../0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { exactKeys, jcs, parseCanonical, sha256, strictTime, zeroEffects } from '../0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
import { createTimedRecordVerifier } from '../0058/record-verifier.candidate.mjs';
const registryBytes = jcs(JSON.parse(readFileSync(new URL('../0001/reviews/domain/round-3/remediation/TRUST-REGISTRY.candidate.json', import.meta.url), 'utf8')));
const timed = createTimedRecordVerifier(registryBytes);
const records = [
  ['requestBytes', 'record', 'requestedAt', null], ['upstreamCredentialBytes', 'upstream', 'issuedAt', 'expiresAt'],
  ['downstreamCredentialBytes', 'downstream', 'issuedAt', 'expiresAt'], ['delegationBytes', 'delegation', 'issuedAt', 'expiresAt'],
  ['assignmentBytes', 'assignment', null, 'expiresAt'], ['authorityBytes', 'authority', 'decidedAt', 'validThrough'],
  ['providerResourcesBytes', 'provider', 'recordedAt', null], ['replayLedgerBytes', 'replay-authority', 'snapshotAt', 'validThrough'],
  ['casHeadBytes', 'cas-authority', 'snapshotAt', 'validThrough'], ['reservationBytes', 'cas-authority', 'recordedAt', 'validThrough'],
];
const immutableFields = ['requestId', 'action', 'organization', 'tenant', 'repositoryId', 'installationId', 'item', 'path', 'targetExamRevision', 'targetExamSha256',
  'authorizationPolicyPath', 'authorizationPolicyDigest', 'actorSubject', 'actorRole', 'principal', 'provider', 'upstreamPrincipal', 'upstreamCredentialId',
  'upstreamCredentialDigest', 'idempotencyKey', 'casHead', 'requestedAt'];
export const policyDigest = sha256(jcs({ version: 'steer-authorization-time/v1', registryDigest: timed.registryDigest, timePolicyDigest: timed.timePolicyDigest,
  observationDomain: 'verifier', recordLimit: 16384, snapshotAgeMs: 300000, records, immutableFields,
  rules: 'complete exact-byte independent observation; explicit native/as-of/evaluation times and current expiry; immutable request hash checked before replay; original manifest/authority semantics; zero effects, no write authority' }));
const requireValue = (value) => { if (!value) throw new Error('AUTHORIZATION_TIME_INVALID'); };
const bytes = (value, limit) => typeof value === 'string' && value.length > 0 && value.length <= limit;
const time = (value) => { const parsed = strictTime(value); requireValue(parsed !== null); return parsed; };

export function createAuthorizationTimeVerifier(contextBytes) {
  let evaluatedAt;
  try {
    requireValue(bytes(contextBytes, 1024)); const context = parseCanonical(contextBytes);
    requireValue(exactKeys(context, ['version', 'evaluatedAt']) && context.version === 'steer-audit-clock/v1');
    time(context.evaluatedAt); evaluatedAt = context.evaluatedAt;
  } catch { throw new Error('AUTHORIZATION_TIME_CONTEXT_INVALID'); }
  return Object.freeze({
    verify(serialized) {
      const reject = () => ({ decision: 'DENY', firstError: 'AUTHORIZATION_TIME_INVALID', effects: zeroEffects(), executionAuthorized: false });
      try {
        requireValue(bytes(serialized, 1048576)); const input = parseCanonical(serialized);
        requireValue(exactKeys(input, ['version', 'policyDigest', 'bundleBytes', 'observationBytes']) && input.version === 'steer-authorization-time/v1' &&
          input.policyDigest === policyDigest && bytes(input.bundleBytes, 524288) && bytes(input.observationBytes, 8192));
        const bundle = parseCanonical(input.bundleBytes);
        requireValue(exactKeys(bundle, ['manifestBytes', 'trustRegistryBytes', 'authorizationPolicyBytes', ...records.map(([key]) => key)]));
        const request = parseCanonical(bundle.requestBytes), observation = parseCanonical(input.observationBytes);
        const requested = time(request.requestedAt), evaluated = time(evaluatedAt); requireValue(requested <= evaluated);
        requireValue(exactKeys(observation, ['version', 'bundleDigest', 'policyDigest', 'registryDigest', 'inventoryDigest', 'recordCount', 'recordedAt', 'recordDigest', 'signature']) &&
          observation.version === 'steer-authorization-observation/v1' && observation.bundleDigest === sha256(input.bundleBytes) &&
          observation.policyDigest === policyDigest && observation.registryDigest === timed.registryDigest && observation.recordedAt === request.requestedAt);
        const observer = timed.verifyBytes(input.observationBytes, { domain: 'verifier', recordedAt: observation.recordedAt, evaluatedAt });
        const inventory = [];
        for (const [key, domain, field, expiry] of records) {
          requireValue(bytes(bundle[key], 16384)); const record = parseCanonical(bundle[key]), recordedAt = field === null ? request.requestedAt : record[field];
          requireValue(time(recordedAt) <= requested); const verified = timed.verifyBytes(bundle[key], { domain, recordedAt, evaluatedAt });
          requireValue(verified.anchorDigest !== observer.anchorDigest);
          if (expiry !== null) requireValue(evaluated < time(record[expiry]));
          if (key === 'assignmentBytes') requireValue(time(record.validFrom) <= evaluated);
          if (['providerResourcesBytes', 'replayLedgerBytes', 'casHeadBytes', 'reservationBytes'].includes(key)) requireValue(evaluated - time(recordedAt) <= 300000);
          inventory.push({ path: `bundle/${key}`, domain, bytesDigest: sha256(bundle[key]), recordDigest: record.recordDigest,
            timeBasis: field === null ? 'observed-as-of' : `signed:${field}`, recordedAt });
        }
        requireValue(observation.recordCount === inventory.length && observation.inventoryDigest === sha256(jcs(inventory)));
        // The old replay branch returns before this derivation. Recompute it on
        // both paths so a self-consistent replay claim cannot hide request drift.
        requireValue(request.immutableRequestDigest === sha256(jcs(Object.fromEntries(immutableFields.map((field) => [field, request[field]])))));
        const result = authorizationDecision(input.bundleBytes); requireValue(['ALLOW', 'REPLAY_NOOP'].includes(result.decision));
        // Original ALLOW reports hypothetical credential/provider/Git effects.
        // None occurred here: deliberately construct zero counters instead.
        return { decision: 'VERIFIED', recordedDecision: result.decision, firstError: null, effects: zeroEffects(), executionAuthorized: false,
          consumedRecordIds: result.consumedRecordIds, timePolicyDigest: policyDigest, evaluatedAt, observationDigest: observation.recordDigest,
          timedRecordCount: inventory.length, observedAsOfCount: 1 };
      } catch { return reject(); }
    },
  });
}
