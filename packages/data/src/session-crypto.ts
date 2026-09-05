import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { z } from 'zod';

const keyId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const encoded = z.string().regex(/^[A-Za-z0-9_-]+$/);
const envelope = z.strictObject({ version: z.literal(1), keyId,
  iv: encoded.length(16), tag: encoded.length(22), ciphertext: encoded.max(40000),
});
export class SessionStorageError extends Error {
  constructor() { super('Session storage is unavailable or invalid.'); }
}
export interface SessionKeyring { currentKeyId: string; keys: Record<string, Uint8Array> }

/** Keys are explicitly supplied by the server's secret provider, never persisted here. */
export function createSessionCipher(config: SessionKeyring) {
  const keys = new Map<string, Buffer>();
  try {
    keyId.parse(config.currentKeyId);
    const entries = Object.entries(config.keys);
    if (!entries.length || entries.length > 4) throw new SessionStorageError();
    for (const [id, bytes] of entries) {
      keyId.parse(id);
      if (!(bytes instanceof Uint8Array) || bytes.byteLength !== 32) throw new SessionStorageError();
      keys.set(id, Buffer.from(bytes));
    }
    if (!keys.has(config.currentKeyId)) throw new SessionStorageError();
  } catch { throw new SessionStorageError(); }
  const currentKeyId = config.currentKeyId;
  return {
    encrypt(value: unknown, associatedData: string) {
      try {
        const plaintext = Buffer.from(JSON.stringify(value));
        if (!plaintext.length || plaintext.length > 30000 || associatedData.length > 2000) throw new SessionStorageError();
        const iv = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', keys.get(currentKeyId)!, iv, { authTagLength: 16 });
        cipher.setAAD(Buffer.from(JSON.stringify([1, currentKeyId, associatedData])));
        const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        return { version: 1 as const, keyId: currentKeyId, iv: iv.toString('base64url'),
          tag: cipher.getAuthTag().toString('base64url'), ciphertext: ciphertext.toString('base64url') };
      } catch { throw new SessionStorageError(); }
    },
    decrypt(raw: unknown, associatedData: string): unknown {
      try {
        const value = envelope.parse(raw); const key = keys.get(value.keyId);
        if (!key || associatedData.length > 2000) throw new SessionStorageError();
        const decode = (input: string) => {
          const bytes = Buffer.from(input, 'base64url');
          if (bytes.toString('base64url') !== input) throw new SessionStorageError();
          return bytes;
        };
        const decipher = createDecipheriv('aes-256-gcm', key, decode(value.iv), { authTagLength: 16 });
        decipher.setAAD(Buffer.from(JSON.stringify([1, value.keyId, associatedData]))); decipher.setAuthTag(decode(value.tag));
        const plaintext = Buffer.concat([decipher.update(decode(value.ciphertext)), decipher.final()]);
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
      } catch { throw new SessionStorageError(); }
    },
  };
}
