import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { createSessionCipher, SessionStorageError } from '../src/session-crypto.ts';
import { sessionNamespace, createPostgresBrowserSessionStore } from '../src/browser-session.ts';
import type { Pool } from 'pg';

test('cipher encrypts credentials with fresh IVs and authenticates exact associated data', () => {
  const cipher = createSessionCipher({ currentKeyId: 'k1', keys: { k1: randomBytes(32) } });
  const value = { accessToken: 'synthetic-secret-token', verifier: 'synthetic-secret-verifier' };
  const a = cipher.encrypt(value, 'namespace-kind-key-times'); const b = cipher.encrypt(value, 'namespace-kind-key-times');
  assert.notEqual(a.iv, b.iv); assert.notEqual(a.ciphertext, b.ciphertext);
  assert.ok(!JSON.stringify(a).includes('synthetic-secret'));
  assert.deepEqual(cipher.decrypt(a, 'namespace-kind-key-times'), value);
  assert.throws(() => createSessionCipher({ currentKeyId: 'k1', keys: { k1: randomBytes(32) } }).decrypt(a, 'namespace-kind-key-times'), SessionStorageError);
  assert.throws(() => cipher.decrypt(a, 'other-namespace'), SessionStorageError);
  for (const change of [{ tag: 'A'.repeat(22) }, { ciphertext: 'AAAA' }, { version: 2 }, { iv: 'A'.repeat(16) }, { keyId: 'missing' }, { extra: true }]) {
    assert.throws(() => cipher.decrypt({ ...a, ...change }, 'namespace-kind-key-times'), SessionStorageError);
  }
});

test('explicit key rotation reads old ciphertext and new writes use the new key', () => {
  const old = randomBytes(32); const next = randomBytes(32);
  const first = createSessionCipher({ currentKeyId: 'old', keys: { old } });
  const ciphertext = first.encrypt({ token: 'synthetic' }, 'aad');
  const rotated = createSessionCipher({ currentKeyId: 'next', keys: { old, next } });
  assert.deepEqual(rotated.decrypt(ciphertext, 'aad'), { token: 'synthetic' });
  assert.equal(rotated.encrypt({}, 'aad').keyId, 'next');
  old.fill(0); // The cipher owns a copy; caller mutation must not alter its key.
  assert.deepEqual(first.decrypt(ciphertext, 'aad'), { token: 'synthetic' });
  assert.throws(() => createSessionCipher({ currentKeyId: 'next', keys: { next } }).decrypt(ciphertext, 'aad'), SessionStorageError);
});

test('invalid key material, oversized envelopes and invalid binding fail without leaking values', () => {
  for (const config of [{ currentKeyId: 'absent', keys: {} }, { currentKeyId: 'k', keys: { k: randomBytes(16) } }]) {
    assert.throws(() => createSessionCipher(config), { message: 'Session storage is unavailable or invalid.' });
  }
  const cipher = createSessionCipher({ currentKeyId: 'k', keys: { k: randomBytes(32) } });
  assert.throws(() => cipher.encrypt('secret'.repeat(10000), 'aad'), SessionStorageError);
  const binding = { issuer: 'https://identity.example/realm', clientId: 'steer', redirectUri: 'https://steer.example/callback' };
  assert.equal(sessionNamespace(binding), sessionNamespace({ redirectUri: binding.redirectUri, clientId: binding.clientId, issuer: binding.issuer }));
  assert.notEqual(sessionNamespace(binding), sessionNamespace({ ...binding, clientId: 'other' }));
  assert.throws(() => sessionNamespace({ ...binding, issuer: 'http://identity.example' }), SessionStorageError);
  assert.throws(() => createPostgresBrowserSessionStore({} as Pool, { binding, keyring: { currentKeyId: 'k', keys: { k: randomBytes(32) } }, maxEntriesPerKind: 0 }), SessionStorageError);
});
