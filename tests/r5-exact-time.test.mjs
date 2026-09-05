import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { exactInstant, formatExactInstant, exactRetentionBoundary, timePolicyDigest } from '../intent/0069/exact-time.candidate.mjs';
import { createTimedRecordVerifier } from '../intent/0058/record-verifier.candidate.mjs';
import { lifecycleBoundary } from '../intent/0061/lifecycle-graph.candidate.mjs';
import { jcs, sha256, strictTime } from '../intent/0001/reviews/domain/round-3/remediation/strict-evidence.candidate.mjs';

const base = '2026-09-04T12:00:00', at = (fraction) => `${base}.${String(fraction).padStart(9, '0')}Z`;
const SECOND = 1000000000n;
// Isolated synthetic signing material. No provider key or frozen registry edits.
function signer(keyId, from, until, revokedAt = null) {
  const privateKey = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), createHash('sha256').update(`0069-test-only:${keyId}`).digest()]), format: 'der', type: 'pkcs8' });
  const publicKeyHex = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
  const registry = { version: 'steer-r3-trust-registry/v1', bindings: [{ domain: 'provider', keyId, algorithm: 'Ed25519', publicKeyHex, notBefore: from, notAfter: until, revokedAt }] };
  return { registry, verifier: createTimedRecordVerifier(jcs(registry)), bytes(recordedAt) {
    const payload = { kind: 'synthetic-proof', recordedAt }, recordDigest = sha256(jcs(payload));
    return jcs({ ...payload, recordDigest, signature: { algorithm: 'Ed25519', keyId, signedDigest: recordDigest, valueBase64: sign(null, Buffer.from(recordDigest), privateKey).toString('base64') } });
  } };
}
const check = (source, recordedAt, evaluatedAt) => source.verifier.verifyBytes(source.bytes(recordedAt), { domain: 'provider', recordedAt, evaluatedAt });

test('exact UTC parser preserves every nanosecond, pre-epoch values and four-digit year endpoints', () => {
  for (const input of ['0000-01-01T00:00:00Z', '0000-02-29T00:00:00.000000001Z', '0099-12-31T23:59:59.999999999Z',
    '1969-12-31T23:59:59.999999999Z', '1970-01-01T00:00:00Z', '2024-02-29T12:00:00.123456789Z', '9999-12-31T23:59:59.999999999Z']) {
    const parsed = exactInstant(input); assert.equal(typeof parsed, 'bigint'); assert.equal(formatExactInstant(parsed), input);
  }
  assert.equal(exactInstant('1969-12-31T23:59:59.999999999Z'), -1n);
  assert.equal(exactInstant(at(1)) - exactInstant(`${base}Z`), 1n);
  assert.equal(exactInstant(at(0)), exactInstant(`${base}Z`));
  assert.equal(formatExactInstant(exactInstant(at(0))), `${base}Z`);
  // Deterministic values on both sides of the epoch, not floating-point time.
  for (let i = -1000n; i <= 1000n; i++) {
    const instant = i * 123456789012345n + 999999999n;
    assert.equal(exactInstant(formatExactInstant(instant)), instant);
  }
});

test('invalid dates, ambiguous precision, offsets, numeric inputs and range overflow never normalize silently', () => {
  for (const input of [null, undefined, 0, 0n, {}, '', '2026-02-29T00:00:00Z', '1900-02-29T00:00:00Z', '2026-04-31T00:00:00Z',
    '2026-09-04T24:00:00Z', '2026-09-04T12:00:60Z', '2026-09-04T12:00:00+00:00', `${base}.1Z`, `${base}.1234567890Z`,
    `${base}.000000001z`, `${base}Z `, '10000-01-01T00:00:00Z', 'x'.repeat(100000)]) assert.equal(exactInstant(input), null);
  for (const value of [0, '0', null, exactInstant('0000-01-01T00:00:00Z') - 1n, exactInstant('9999-12-31T23:59:59.999999999Z') + 1n, 10n ** 100n])
    assert.throws(() => formatExactInstant(value), /^Error: EXACT_TIME_INVALID$/);
  assert.equal(strictTime(at(1)), null); // frozen parser remains unchanged
});

test('retention arithmetic preserves fractions across seconds, days, calendar clamps and exact parent caps', () => {
  for (const [input, duration, expected] of [
    [at(123456789), 'PT60S', '2026-09-04T12:01:00.123456789Z'],
    [at(999999999), 'P30D', '2026-10-04T12:00:00.999999999Z'],
    [at(1), 'P90D', '2026-12-03T12:00:00.000000001Z'],
    ['2024-02-29T12:00:00.123456789Z', 'P1Y', '2025-02-28T12:00:00.123456789Z'],
    ['2024-02-29T12:00:00.123456789Z', 'P4Y', '2028-02-29T12:00:00.123456789Z'],
    ['0096-02-29T12:00:00.000000001Z', 'P4Y', '0100-02-28T12:00:00.000000001Z'],
    ['0000-02-29T00:00:00.000000001Z', 'P1Y', '0001-02-28T00:00:00.000000001Z'],
    ['1969-12-31T23:59:59.999999999Z', 'PT1S', '1970-01-01T00:00:00.999999999Z'],
  ]) {
    assert.equal(exactRetentionBoundary(input, duration), expected);
    assert.equal(lifecycleBoundary(input, duration), expected); // actual public caller
  }
  assert.equal(lifecycleBoundary(at(2), 'immediate', at(1)), at(1));
  assert.equal(lifecycleBoundary(at(2), 'immediate', at(3)), at(2));
  assert.equal(lifecycleBoundary(at(2), 'P7Y', '2033-09-04T12:00:00.000000001Z'), '2033-09-04T12:00:00.000000001Z');
  assert.equal(exactInstant(lifecycleBoundary(at(2), 'PT60S')) - exactInstant(at(2)), 60n * SECOND);
  assert.equal(lifecycleBoundary(at(2), 'indefinite'), null);
  for (const duration of [null, 'P0D', 'P01D', 'P1M', 'P1.5Y', 'PT-1S', 'P1Ytail', 'P999999999999999999999999999999999999D'])
    assert.throws(() => lifecycleBoundary(at(1), duration));
  assert.throws(() => lifecycleBoundary(at(1), 'P1Y', 'bad-parent'));
  assert.throws(() => lifecycleBoundary(at(1), 'indefinite', at(0)));
  assert.throws(() => lifecycleBoundary('9999-12-31T23:59:59.999999999Z', 'PT1S'));
  assert.throws(() => lifecycleBoundary('9999-12-31T23:59:59Z', 'P1Y', at(0)));
});

test('shared signature verifier checks activation, expiry and revocation at individual nanoseconds', () => {
  const source = signer('precise-key', at(100), at(200));
  assert.equal(source.verifier.timePolicyDigest, timePolicyDigest);
  assert.doesNotThrow(() => check(source, at(100), at(199)));
  assert.throws(() => check(source, at(99), at(100)), /^Error: TIMED_RECORD_INVALID$/);
  assert.throws(() => check(source, at(100), at(200)), /^Error: TIMED_RECORD_INVALID$/);
  assert.throws(() => check(source, at(101), at(100)), /^Error: TIMED_RECORD_INVALID$/);
  const revoked = signer('precise-key', at(100), at(200), at(150));
  assert.doesNotThrow(() => check(revoked, at(100), at(149)));
  assert.throws(() => check(revoked, at(100), at(150)));
  assert.throws(() => check(revoked, at(150), at(151)));
  // A real one-nanosecond key window is nonempty, not rounded to zero.
  const tiny = signer('tiny-key', at(100), at(101)); assert.doesNotThrow(() => check(tiny, at(100), at(100)));
  for (const [from, until] of [[at(100), at(100)], [at(101), at(100)], [`${base}.1Z`, at(200)]])
    assert.throws(() => signer('invalid-window', from, until), /^Error: TRUST_CONFIGURATION_INVALID$/);
});

test('precision does not grant archival authority, extend old keys or replace exact signature/registry binding', () => {
  const old = signer('old-key', '2026-09-01T00:00:00Z', '2027-09-01T00:00:00Z');
  assert.doesNotThrow(() => check(old, `${base}Z`, `${base}Z`));
  assert.throws(() => check(old, `${base}Z`, '2033-09-04T12:00:00Z'));
  const future = signer('new-key', '2033-09-01T00:00:00Z', '2034-09-01T00:00:00Z');
  assert.doesNotThrow(() => check(future, '2033-09-04T12:00:00.000000001Z', '2033-09-04T12:00:00.000000002Z'));
  assert.throws(() => check(future, `${base}Z`, '2033-09-04T12:00:00Z'));
  assert.throws(() => future.verifier.verifyBytes(old.bytes(`${base}Z`), { domain: 'provider', recordedAt: `${base}Z`, evaluatedAt: `${base}Z` }));
  const source = signer('precise-key', at(100), at(200));
  const context = { domain: 'provider', recordedAt: at(100), evaluatedAt: at(101) };
  for (const patch of [{ domain: 'authority' }, { evaluatedAt: undefined }, { trustedClock: true }])
    assert.throws(() => source.verifier.verifyBytes(source.bytes(at(100)), { ...context, ...patch }));
  const altered = JSON.parse(source.bytes(at(100))); altered.recordedAt = at(101);
  assert.throws(() => source.verifier.verifyBytes(jcs(altered), { ...context, recordedAt: at(101) }));
  assert.throws(() => source.verifier.verifyBytes(source.bytes(at(100)) + ' ', context));
});
