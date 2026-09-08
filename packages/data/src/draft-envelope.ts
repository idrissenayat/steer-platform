import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { z } from 'zod';

const encoded = z.string().regex(/^[A-Za-z0-9_-]+(?![\s\S])/);
export const draftEnvelopeSchema = z.strictObject({ version: z.literal(1), keyId: z.string().regex(/^[A-Za-z0-9_-]{1,100}(?![\s\S])/),
  iv: encoded.length(16), tag: encoded.length(22), ciphertext: encoded.max(1048576) });
export type DraftKey = { keyId: string; bytes: Uint8Array };
export class DraftStorageError extends Error { constructor() { super('Draft storage is unavailable.'); } }
const decode = (value: string) => { const bytes = Buffer.from(value, 'base64url'); if (bytes.toString('base64url') !== value) throw new DraftStorageError(); return bytes; };
function keyBytes(key: DraftKey) {
  draftEnvelopeSchema.shape.keyId.parse(key.keyId);
  if (!(key.bytes instanceof Uint8Array) || key.bytes.byteLength !== 32) throw new DraftStorageError();
  return Buffer.from(key.bytes);
}
/** One per-draft key lease from the trusted secret seam. No keyring or persistence here. */
export function sealDraft(value: unknown, aad: string, lease: DraftKey) {
  let key: Buffer | undefined, plaintext: Buffer | undefined;
  try {
    key = keyBytes(lease); plaintext = Buffer.from(JSON.stringify(value));
    if (!plaintext.length || plaintext.length > 786432 || Buffer.byteLength(aad) > 16384) throw new DraftStorageError();
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
    cipher.setAAD(Buffer.from(JSON.stringify(['steer-draft-envelope/v1', lease.keyId, aad])));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return draftEnvelopeSchema.parse({ version: 1, keyId: lease.keyId, iv: iv.toString('base64url'), tag: cipher.getAuthTag().toString('base64url'), ciphertext: ciphertext.toString('base64url') });
  } catch { throw new DraftStorageError(); }
  finally { key?.fill(0); plaintext?.fill(0); }
}
export function openDraft(raw: unknown, aad: string, lease: DraftKey): unknown {
  let key: Buffer | undefined, plaintext: Buffer | undefined, partial: Buffer | undefined;
  try {
    const envelope = draftEnvelopeSchema.parse(raw); key = keyBytes(lease);
    if (envelope.keyId !== lease.keyId || Buffer.byteLength(aad) > 16384) throw new DraftStorageError();
    const cipher = createDecipheriv('aes-256-gcm', key, decode(envelope.iv), { authTagLength: 16 });
    cipher.setAAD(Buffer.from(JSON.stringify(['steer-draft-envelope/v1', lease.keyId, aad]))); cipher.setAuthTag(decode(envelope.tag));
    partial = cipher.update(decode(envelope.ciphertext));
    plaintext = Buffer.concat([partial, cipher.final()]);
    if (plaintext.length > 786432) throw new DraftStorageError();
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
  } catch { throw new DraftStorageError(); }
  finally { key?.fill(0); plaintext?.fill(0); partial?.fill(0); }
}
