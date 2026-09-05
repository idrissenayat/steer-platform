import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdtemp, realpath, chmod, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

/** Test-owned encrypted bundle; no real key/provider or plaintext file. */
export async function createSecretFixture(plaintext = new TextEncoder().encode('synthetic-secret-value')) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'steer-0030-'))); await chmod(directory, 0o700);
  const scope = 'synthetic-scope'; const name = 'identity-runtime'; const revision = 'r1'; const keyId = 'synthetic-wrapping-key';
  const wrappedKey = randomBytes(64).toString('base64'); const dataKey = randomBytes(32); const nonce = randomBytes(12);
  const version = 'steer-encrypted-secret/v1';
  const cipher = createCipheriv('aes-256-gcm', dataKey, nonce, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(JSON.stringify([version, scope, name, revision, keyId, wrappedKey])));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const envelope = { version, scope, name, revision, keyId, wrappedKey, nonce: nonce.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
  const file = join(directory, `${name}.${revision}.json`);
  const returnedKeys: Uint8Array[] = []; let unwraps = 0;
  const keyProvider = { async unwrap(input: { keyId: string; wrappedKey: Uint8Array; context: Readonly<Record<string, string>> }) {
    unwraps++; assert.equal(input.keyId, keyId); assert.equal(Buffer.from(input.wrappedKey).toString('base64'), wrappedKey);
    assert.deepEqual(input.context, { purpose: version, scope, name, revision });
    const copy = Uint8Array.from(dataKey); returnedKeys.push(copy); return copy;
  } };
  const write = async (value: unknown = envelope) => {
    const encoded = JSON.stringify(value); await writeFile(file, encoded, { mode: 0o600 });
    return { name, revision, sha256: createHash('sha256').update(encoded).digest('hex') };
  };
  const reference = await write();
  return { directory, scope, file, envelope, reference, keyProvider, returnedKeys, unwraps: () => unwraps, write,
    close: async () => { dataKey.fill(0); await rm(directory, { recursive: true, force: true }); } };
}
