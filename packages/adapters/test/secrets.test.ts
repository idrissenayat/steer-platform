import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chmod, link, rename, mkdir, symlink, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createEncryptedFileSecretProvider, SecretReadError } from '../src/secrets/file.ts';
import { createSecretFixture } from './secret-fixture.ts';

test('encrypted provider reads only the pinned bundle, binds unwrap context, does not cache and wipes data keys', async () => {
  const fixture = await createSecretFixture();
  try {
    const provider = await createEncryptedFileSecretProvider(fixture, fixture.keyProvider);
    assert.ok(!(await readFile(fixture.file, 'utf8')).includes('synthetic-secret-value'));
    for (let i = 0; i < 2; i++) { const value = await provider.read(fixture.reference); assert.equal(new TextDecoder().decode(value), 'synthetic-secret-value'); value.fill(0); }
    assert.equal(fixture.unwraps(), 2); assert.ok(fixture.returnedKeys.every((key) => key.every((byte) => byte === 0)));
    await chmod(fixture.file, 0o400); assert.equal((await provider.read(fixture.reference)).length, 22);
  } finally { await fixture.close(); }
});

test('unsafe roots, filename traversal, permissions, symlinks and hardlinks fail before key-provider access', async () => {
  const fixture = await createSecretFixture();
  try {
    for (const directory of ['/', 'relative', `${fixture.directory}/../escape`]) await assert.rejects(createEncryptedFileSecretProvider({ directory, scope: fixture.scope }, fixture.keyProvider), SecretReadError);
    await chmod(fixture.directory, 0o755); await assert.rejects(createEncryptedFileSecretProvider(fixture, fixture.keyProvider), SecretReadError);
    await chmod(fixture.directory, 0o700); const provider = await createEncryptedFileSecretProvider(fixture, fixture.keyProvider);
    for (const name of ['../escape', '/absolute', 'nested/name', 'with.dot', 'x\\y']) await assert.rejects(provider.read({ ...fixture.reference, name }), SecretReadError);
    for (const mode of [0o644, 0o660, 0o700]) { await chmod(fixture.file, mode); await assert.rejects(provider.read(fixture.reference), SecretReadError); }
    await chmod(fixture.file, 0o600);
    const alias = join(fixture.directory, 'alias'); await link(fixture.file, alias); await assert.rejects(provider.read(fixture.reference), SecretReadError); await unlink(alias);
    await rename(fixture.file, alias); await symlink(alias, fixture.file); await assert.rejects(provider.read(fixture.reference), SecretReadError);
    assert.equal(fixture.unwraps(), 0);
  } finally { await fixture.close(); }
});

test('directory replacement after provider creation is rejected and unrelated replacement data is not read', async () => {
  const fixture = await createSecretFixture(); const original = `${fixture.directory}-original`;
  try {
    const provider = await createEncryptedFileSecretProvider(fixture, fixture.keyProvider);
    await rename(fixture.directory, original); await mkdir(fixture.directory, { mode: 0o700 });
    await assert.rejects(provider.read(fixture.reference), SecretReadError); assert.equal(fixture.unwraps(), 0);
  } finally { await fixture.close(); await rename(original, fixture.directory); await fixture.close(); }
});

test('digest, size, metadata, canonical encoding and authentication failures never return plaintext', async () => {
  const fixture = await createSecretFixture();
  try {
    const provider = await createEncryptedFileSecretProvider(fixture, fixture.keyProvider);
    await assert.rejects(provider.read({ ...fixture.reference, sha256: '0'.repeat(64) }), SecretReadError);
    for (const value of [{ ...fixture.envelope, scope: 'foreign' }, { ...fixture.envelope, revision: 'r2' },
      { ...fixture.envelope, extra: 'no-extra-fields' }, { ...fixture.envelope, nonce: 'invalid' },
      { ...fixture.envelope, ciphertext: `${fixture.envelope.ciphertext}\n` }]) {
      await assert.rejects(provider.read(await fixture.write(value)), SecretReadError);
    }
    assert.equal(fixture.unwraps(), 0);
    const tag = Buffer.from(fixture.envelope.tag, 'base64'); tag[0] = tag[0]! ^ 1;
    await assert.rejects(provider.read(await fixture.write({ ...fixture.envelope, tag: tag.toString('base64') })), SecretReadError);
    assert.equal(fixture.unwraps(), 1); assert.ok(fixture.returnedKeys[0]!.every((byte) => byte === 0));
    const oversized = 'x'.repeat(65537); await writeFile(fixture.file, oversized);
    await assert.rejects(provider.read({ ...fixture.reference, sha256: createHash('sha256').update(oversized).digest('hex') }), SecretReadError);
  } finally { await fixture.close(); }
});

test('key-provider rejection and invalid keys are generic, and data-key buffers are wiped', async () => {
  const fixture = await createSecretFixture();
  try {
    const wrong = new Uint8Array(3).fill(1);
    for (const unwrap of [async () => { throw new Error('private-key-provider-details'); }, async () => wrong, async () => new Uint8Array(32)]) {
      const provider = await createEncryptedFileSecretProvider(fixture, { unwrap });
      await assert.rejects(provider.read(fixture.reference), /^SecretReadError: The configured secret could not be read\.$/);
    }
    assert.ok(wrong.every((byte) => byte === 0));
  } finally { await fixture.close(); }
});

test('four in-flight reads include actual key-provider work and excess admission does not queue', async () => {
  const fixture = await createSecretFixture(); let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  try {
    const provider = await createEncryptedFileSecretProvider(fixture, { unwrap: async (input) => { await gate; return fixture.keyProvider.unwrap(input); } });
    const pending = Array.from({ length: 4 }, () => provider.read(fixture.reference));
    await assert.rejects(provider.read(fixture.reference), SecretReadError);
    release(); const values = await Promise.all(pending); assert.equal(fixture.unwraps(), 4); values.forEach((value) => value.fill(0));
    (await provider.read(fixture.reference)).fill(0); assert.equal(fixture.unwraps(), 5);
  } finally { release(); await fixture.close(); }
});
