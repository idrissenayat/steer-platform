import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { DraftStorageError, openDraft, sealDraft } from '../src/draft-envelope.ts';

test('per-draft authenticated envelopes preserve Unicode with fresh nonces and no plaintext or key fields', () => {
  const key = { keyId: 'synthetic-key', bytes: randomBytes(32) }, value = { brief: '🌸 Intent\nفارسی', spec: 'AC-01', exam: 'NOT RUN' };
  const first = sealDraft(value, 'owner/op/revision/policy', key), second = sealDraft(value, 'owner/op/revision/policy', key);
  assert.deepEqual(openDraft(first, 'owner/op/revision/policy', key), value);
  assert.notEqual(first.iv, second.iv); assert.notEqual(first.ciphertext, second.ciphertext);
  assert.equal(JSON.stringify(first).includes('Intent'), false); assert.equal(JSON.stringify(first).includes(key.bytes.toString('base64url')), false);
  assert.deepEqual(Object.keys(first), ['version', 'keyId', 'iv', 'tag', 'ciphertext']);
  assert.notDeepEqual(key.bytes, Buffer.alloc(32));
});

test('ciphertext, nonce, tag, scope and key substitutions fail without disclosing contents', () => {
  const key = { keyId: 'synthetic-key', bytes: randomBytes(32) }, original = sealDraft({ text: 'private-marker' }, 'bound-scope', key);
  const change = (s: string) => `${s[0] === 'A' ? 'B' : 'A'}${s.slice(1)}`;
  for (const [envelope, scope, lease] of [
    [{ ...original, ciphertext: change(original.ciphertext) }, 'bound-scope', key],
    [{ ...original, iv: change(original.iv) }, 'bound-scope', key],
    [{ ...original, tag: change(original.tag) }, 'bound-scope', key],
    [original, 'other-owner/op/revision', key],
    [original, 'bound-scope', { ...key, bytes: randomBytes(32) }],
    [{ ...original, keyId: 'other-key' }, 'bound-scope', { ...key, keyId: 'other-key' }],
    [{ ...original, tag: original.tag + '\n' }, 'bound-scope', key],
    [{ ...original, secret: 'private-marker' }, 'bound-scope', key],
  ] as const) assert.throws(() => openDraft(envelope, scope, lease), DraftStorageError);
});

test('malformed keys, oversized plaintext and non-JSON values are rejected generically', () => {
  const key = { keyId: 'synthetic-key', bytes: randomBytes(32) };
  for (const run of [() => sealDraft(undefined, '', key), () => sealDraft('a'.repeat(786432), '', key),
    () => sealDraft({}, 'a'.repeat(16385), key), () => sealDraft({}, '', { ...key, bytes: randomBytes(31) }),
    () => sealDraft({}, '', { ...key, keyId: 'key\n' })])
    assert.throws(run, cause => cause instanceof DraftStorageError && cause.message === 'Draft storage is unavailable.');
});
