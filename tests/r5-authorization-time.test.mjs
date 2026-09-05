import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { createAuthorizationTimeVerifier, policyDigest } from '../intent/0066/authorization-time.candidate.mjs';
import { makeAuthorizationBundle, mutateAuthorizationBundle, expectedAuthorizationRecordIds } from '../intent/0001/reviews/domain/round-3/remediation/evidence-fixtures.candidate.mjs';
import { authorizationDecision } from '../intent/0001/reviews/domain/round-3/remediation/semantic-oracles.candidate.mjs';
import { jcs, sha256, TRUST_REGISTRY, zeroEffects } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';
const now = '2026-09-04T12:00:30Z';
// Only module-private synthetic fixture signers, never actual gate credentials.
function seal(input, domain) {
  const key = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), createHash('sha256').update(`steer-r3-r1-${domain}`).digest()]), format: 'der', type: 'pkcs8' });
  const record = Object.fromEntries(Object.entries(input).filter(([key]) => !['recordDigest', 'signature'].includes(key))), digest = sha256(jcs(record));
  return { ...record, recordDigest: digest, signature: { algorithm: 'Ed25519', keyId: `${domain}-key-v1`, signedDigest: digest, valueBase64: sign(null, Buffer.from(digest), key).toString('base64') } };
}
// Independently specified fixture inventory, not obtained from candidate code.
const slots = [['requestBytes', 'record', 'requestedAt'], ['upstreamCredentialBytes', 'upstream', 'issuedAt'], ['downstreamCredentialBytes', 'downstream', 'issuedAt'],
  ['delegationBytes', 'delegation', 'issuedAt'], ['assignmentBytes', 'assignment', null], ['authorityBytes', 'authority', 'decidedAt'],
  ['providerResourcesBytes', 'provider', 'recordedAt'], ['replayLedgerBytes', 'replay-authority', 'snapshotAt'], ['casHeadBytes', 'cas-authority', 'snapshotAt'], ['reservationBytes', 'cas-authority', 'recordedAt']];
function wrap(bundle, change = () => {}, signer = 'verifier', incomplete = false) {
  const bundleBytes = jcs(bundle); let inventory, recordedAt;
  try {
    recordedAt = JSON.parse(bundle.requestBytes).requestedAt;
    inventory = slots.map(([key, domain, field]) => { const record = JSON.parse(bundle[key]); return { path: `bundle/${key}`, domain,
      bytesDigest: sha256(bundle[key]), recordDigest: record.recordDigest ?? null, timeBasis: field === null ? 'observed-as-of' : `signed:${field}`,
      recordedAt: field === null ? recordedAt : record[field] ?? null }; });
  } catch (error) { if (!incomplete) throw error; inventory = []; recordedAt = now; }
  const observation = { version: 'steer-authorization-observation/v1', bundleDigest: sha256(bundleBytes), policyDigest, registryDigest: sha256(jcs(TRUST_REGISTRY)),
    inventoryDigest: sha256(jcs(inventory)), recordCount: inventory.length, recordedAt };
  change(observation, inventory);
  return { version: 'steer-authorization-time/v1', policyDigest, bundleBytes, observationBytes: jcs(seal(observation, signer)) };
}
const evaluate = (input, evaluatedAt = now) => createAuthorizationTimeVerifier(jcs({ version: 'steer-audit-clock/v1', evaluatedAt })).verify(jcs(input));
const denied = (value) => assert.deepEqual(value, { decision: 'DENY', firstError: 'AUTHORIZATION_TIME_INVALID', effects: zeroEffects(), executionAuthorized: false });

test('all 32 original authorization cases retain decisions, but audit never reports hypothetical writes as actual effects', () => {
  const controls = JSON.parse(readFileSync(new URL('../intent/0001/reviews/domain/round-3/remediation/CONTROL-FIXTURES.candidate.json', import.meta.url)));
  assert.equal(controls.authorizationKinds.length, 32);
  for (const kind of controls.authorizationKinds) {
    const bundle = mutateAuthorizationBundle(makeAuthorizationBundle(), kind), input = wrap(bundle, () => {}, 'verifier', !['positive', 'retry'].includes(kind));
    const before = jcs(input), base = authorizationDecision(bundle), result = evaluate(input);
    assert.equal(base.decision, kind === 'positive' ? 'ALLOW' : kind === 'retry' ? 'REPLAY_NOOP' : 'DENY', kind);
    if (['positive', 'retry'].includes(kind)) {
      assert.equal(result.decision, 'VERIFIED'); assert.equal(result.recordedDecision, base.decision);
      assert.deepEqual(result.consumedRecordIds, expectedAuthorizationRecordIds); assert.equal(result.timedRecordCount, 10); assert.equal(result.observedAsOfCount, 1);
    } else denied(result);
    assert.deepEqual(result.effects, zeroEffects()); assert.equal(result.executionAuthorized, false); assert.equal(jcs(input), before);
    if (kind === 'positive') assert.equal(base.effects.gitWrite, 1, 'Old counter is a hypothetical model effect only.');
  }
});

test('every signature and native event timestamp is checked even for a committed replay', () => {
  for (const mode of ['positive', 'retry']) for (const [key, domain, field] of slots) {
    const bundle = mutateAuthorizationBundle(makeAuthorizationBundle(), mode), record = JSON.parse(bundle[key]);
    record.signature.valueBase64 = Buffer.alloc(64).toString('base64'); bundle[key] = jcs(record); denied(evaluate(wrap(bundle)));
    if (field !== null) for (const at of ['2026-08-31T23:59:59Z', '2026-09-04T12:00:31Z', 'not-a-time']) {
      const value = mutateAuthorizationBundle(makeAuthorizationBundle(), mode);
      value[key] = jcs(seal({ ...JSON.parse(value[key]), [field]: at }, domain)); denied(evaluate(wrap(value)));
    }
  }
});

test('pre-key resource, replay, head and authority evidence reaches frozen acceptance then is rejected', () => {
  for (const [key, domain, field] of [['providerResourcesBytes', 'provider', 'recordedAt'], ['replayLedgerBytes', 'replay-authority', 'snapshotAt'], ['casHeadBytes', 'cas-authority', 'snapshotAt'], ['authorityBytes', 'authority', 'decidedAt']]) {
    const bundle = makeAuthorizationBundle(); bundle[key] = jcs(seal({ ...JSON.parse(bundle[key]), [field]: '2026-08-31T23:59:59Z' }, domain));
    if (key === 'authorityBytes') bundle.requestBytes = jcs(seal({ ...JSON.parse(bundle.requestBytes), authorityDigest: JSON.parse(bundle[key]).recordDigest }, 'record'));
    assert.equal(authorizationDecision(bundle).decision, 'ALLOW', key); denied(evaluate(wrap(bundle)));
  }
});

test('fully re-signed replay cannot hide an arbitrary immutable request digest', () => {
  const bundle = mutateAuthorizationBundle(makeAuthorizationBundle(), 'retry'), request = JSON.parse(bundle.requestBytes), fake = 'f'.repeat(64);
  for (const [key, domain] of [['delegationBytes', 'delegation'], ['reservationBytes', 'cas-authority'], ['replayLedgerBytes', 'replay-authority']])
    bundle[key] = jcs(seal({ ...JSON.parse(bundle[key]), requestDigest: fake }, domain));
  request.immutableRequestDigest = fake; request.delegationDigest = JSON.parse(bundle.delegationBytes).recordDigest; request.reservationDigest = JSON.parse(bundle.reservationBytes).recordDigest;
  bundle.requestBytes = jcs(seal(request, 'record'));
  assert.equal(authorizationDecision(bundle).decision, 'REPLAY_NOOP'); denied(evaluate(wrap(bundle)));
});

test('trusted evaluation enforces currentness and snapshot freshness instead of a caller-selected old time', () => {
  const input = wrap(makeAuthorizationBundle());
  assert.equal(evaluate(input, '2026-09-04T12:00:59Z').decision, 'VERIFIED'); denied(evaluate(input, '2026-09-04T12:01:00Z'));
  denied(evaluate(input, '2026-09-04T12:00:29Z')); denied(evaluate(input, '2027-09-01T00:00:00Z'));
  const bundle = makeAuthorizationBundle();
  bundle.providerResourcesBytes = jcs(seal({ ...JSON.parse(bundle.providerResourcesBytes), recordedAt: '2026-09-04T11:55:30Z' }, 'provider'));
  assert.equal(evaluate(wrap(bundle)).decision, 'VERIFIED'); denied(evaluate(wrap(bundle), '2026-09-04T12:00:31Z'));
  for (const context of [null, '{}', jcs({ version: 'steer-audit-clock/v1' }), jcs({ version: 'steer-audit-clock/v1', evaluatedAt: 'bad' }),
    jcs({ version: 'steer-audit-clock/v1', evaluatedAt: now, registry: {} })]) assert.throws(() => createAuthorizationTimeVerifier(context), /AUTHORIZATION_TIME_CONTEXT_INVALID/);
  denied(evaluate({ ...input, evaluatedAt: now }));
});

test('independent observation must bind the whole bundle and exact inventory; malformed envelopes cannot select a fallback', () => {
  for (const change of [(x) => { x.bundleDigest = 'f'.repeat(64); }, (x) => { x.policyDigest = 'f'.repeat(64); }, (x) => { x.registryDigest = 'f'.repeat(64); },
    (x) => { x.recordCount--; }, (x) => { x.recordedAt = '2026-09-04T12:00:00Z'; }, (x) => { x.extra = true; },
    (x, rows) => { rows.reverse(); x.inventoryDigest = sha256(jcs(rows)); }, (x, rows) => { rows.pop(); x.recordCount--; x.inventoryDigest = sha256(jcs(rows)); }])
    denied(evaluate(wrap(makeAuthorizationBundle(), change)));
  for (const domain of ['record', 'authority', 'provider', 'cas-authority']) denied(evaluate(wrap(makeAuthorizationBundle(), () => {}, domain)));
  const input = wrap(makeAuthorizationBundle()), verifier = createAuthorizationTimeVerifier(jcs({ version: 'steer-audit-clock/v1', evaluatedAt: now }));
  for (const value of [null, {}, input.bundleBytes, jcs(input) + ' ', 'x'.repeat(1048577), jcs({ ...input, policyDigest: 'f'.repeat(64) })]) denied(verifier.verify(value));
});
