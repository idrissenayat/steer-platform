import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, join, normalize } from 'node:path';
import { createDecipheriv, createHash } from 'node:crypto';
import { z } from 'zod';

const name = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
export const secretReferenceSchema = z.strictObject({ name, revision: name, sha256: z.string().regex(/^[a-f0-9]{64}$/) });
export type SecretReference = z.infer<typeof secretReferenceSchema>;
export interface SecretProvider { read(reference: SecretReference): Promise<Uint8Array> }
export interface SecretKeyUnwrapper {
  /** Transfer a fresh 32-byte data-key buffer; the reader wipes it after use. No key caching here. */
  unwrap(input: { keyId: string; wrappedKey: Uint8Array; context: Readonly<Record<string, string>> }): Promise<Uint8Array>;
}
export class SecretReadError extends Error { constructor() { super('The configured secret could not be read.'); this.name = 'SecretReadError'; } }
const envelopeSchema = z.strictObject({ version: z.literal('steer-encrypted-secret/v1'), scope: z.string().min(1).max(200),
  name, revision: name, keyId: z.string().min(1).max(500), wrappedKey: z.string().max(12000),
  nonce: z.string().max(24), tag: z.string().max(24), ciphertext: z.string().max(45000) });
const hash = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const bytes = (value: string, maximum: number, exact?: number) => {
  const result = Buffer.from(value, 'base64');
  if (!result.length || result.length > maximum || (exact !== undefined && result.length !== exact) || result.toString('base64') !== value) throw new SecretReadError();
  return result;
};

/** Encrypted local binding of a portable secret-provider seam. Never discovers or writes secrets. */
export async function createEncryptedFileSecretProvider(configuration: { directory: string; scope: string }, keys: SecretKeyUnwrapper): Promise<SecretProvider> {
  try {
    const directory = configuration.directory; const scope = configuration.scope; const uid = process.getuid?.();
    if (uid === undefined || !isAbsolute(directory) || normalize(directory) !== directory || directory === '/' ||
        typeof scope !== 'string' || !scope || scope.length > 200 || typeof keys.unwrap !== 'function' || await realpath(directory) !== directory) throw new SecretReadError();
    const root = await lstat(directory);
    if (!root.isDirectory() || root.uid !== uid || (root.mode & 0o7777) !== 0o700) throw new SecretReadError();
    const unwrap = keys.unwrap.bind(keys); let active = 0;
    const checkRoot = async () => {
      const current = await lstat(directory);
      if (!current.isDirectory() || current.uid !== uid || (current.mode & 0o7777) !== 0o700 ||
          current.dev !== root.dev || current.ino !== root.ino || await realpath(directory) !== directory) throw new SecretReadError();
    };
    return { async read(rawReference) {
      if (active >= 4) throw new SecretReadError(); active++;
      let file: Awaited<ReturnType<typeof open>> | undefined; let dataKey: Uint8Array | undefined;
      let tentative: Buffer | undefined; let tail: Buffer | undefined;
      try {
        const reference = secretReferenceSchema.parse(rawReference); await checkRoot();
        // Fixed child name, final-component no-follow, and nonblocking open before file-type checks.
        file = await open(join(directory, `${reference.name}.${reference.revision}.json`), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        const before = await file.stat();
        const validFile = (value: typeof before) => value.isFile() && value.uid === uid && value.nlink === 1 &&
          [0o400, 0o600].includes(value.mode & 0o7777) && value.size > 0 && value.size <= 65536;
        if (!validFile(before)) throw new SecretReadError();
        const buffer = Buffer.alloc(65537); let length = 0;
        while (length < buffer.length) {
          const result = await file.read(buffer, length, buffer.length - length, length);
          if (!result.bytesRead) break; length += result.bytesRead;
        }
        const after = await file.stat(); await checkRoot();
        if (!validFile(after) || length !== before.size || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw new SecretReadError();
        const encoded = buffer.subarray(0, length);
        if (hash(encoded) !== reference.sha256) throw new SecretReadError();
        const envelope = envelopeSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(encoded)));
        if (envelope.scope !== scope || envelope.name !== reference.name || envelope.revision !== reference.revision) throw new SecretReadError();
        const ciphertext = bytes(envelope.ciphertext, 32768); const nonce = bytes(envelope.nonce, 12, 12); const tag = bytes(envelope.tag, 16, 16);
        const wrappedKey = bytes(envelope.wrappedKey, 8192);
        await file.close(); file = undefined;
        dataKey = await unwrap({ keyId: envelope.keyId, wrappedKey,
          context: { purpose: 'steer-encrypted-secret/v1', scope, name: reference.name, revision: reference.revision } });
        if (!(dataKey instanceof Uint8Array) || dataKey.byteLength !== 32) throw new SecretReadError();
        const decipher = createDecipheriv('aes-256-gcm', dataKey, nonce, { authTagLength: 16 });
        decipher.setAAD(Buffer.from(JSON.stringify([envelope.version, scope, envelope.name, envelope.revision, envelope.keyId, envelope.wrappedKey])));
        decipher.setAuthTag(tag); tentative = decipher.update(ciphertext); tail = decipher.final();
        const plaintext = new Uint8Array(tentative.byteLength + tail.byteLength);
        plaintext.set(tentative); plaintext.set(tail, tentative.byteLength); return plaintext;
      } catch { throw new SecretReadError(); }
      finally {
        tentative?.fill(0); tail?.fill(0); if (dataKey instanceof Uint8Array) dataKey.fill(0);
        try { await file?.close(); } catch { throw new SecretReadError(); } finally { active--; }
      }
    } };
  } catch { throw new SecretReadError(); }
}
