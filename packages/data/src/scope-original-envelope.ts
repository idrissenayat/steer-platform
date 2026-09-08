import { z } from 'zod';
import { draftEnvelopeSchema, openDraft, sealDraft, DraftStorageError, type DraftKey } from './draft-envelope.ts';

const chunkBytes = 262144;
export const scopeOriginalMaxBytes = chunkBytes * 8;
export const scopeOriginalEnvelopeSchema = z.strictObject({ version: z.literal(1),
  chunks: z.array(draftEnvelopeSchema).min(1).max(8) });
const partSchema = z.strictObject({ bytes: z.string().min(1).max(349526).regex(/^[A-Za-z0-9_-]+(?![\s\S])/) });
const aad = (binding: string, index: number, count: number) => JSON.stringify(['steer-scope-original-part/v1',binding,index,count]);

/** Scope corpora can exceed the single-document envelope bound. Each indexed
 * part keeps that existing bound and authenticates its order and total count.
 * The caller's AAD must include the exact whole-payload digest and owner binding. */
export function sealScopeOriginal(value: unknown, binding: string, key: DraftKey) {
  const bytes = Buffer.from(JSON.stringify(value));
  try {
    if (!bytes.length || bytes.length > scopeOriginalMaxBytes) throw new DraftStorageError();
    const count = Math.ceil(bytes.length / chunkBytes), chunks = [];
    for (let i=0; i<count; i++) chunks.push(sealDraft({ bytes: bytes.subarray(i*chunkBytes,(i+1)*chunkBytes).toString('base64url') }, aad(binding,i,count),key));
    return scopeOriginalEnvelopeSchema.parse({ version:1,chunks });
  } finally { bytes.fill(0); }
}
export function openScopeOriginal(raw: unknown, binding: string, key: DraftKey): unknown {
  const envelope = scopeOriginalEnvelopeSchema.parse(raw), chunks: Buffer[] = [];
  let combined: Buffer | undefined;
  try {
    for (let i=0; i<envelope.chunks.length; i++) {
      const part = partSchema.parse(openDraft(envelope.chunks[i],aad(binding,i,envelope.chunks.length),key));
      const bytes = Buffer.from(part.bytes,'base64url'); chunks.push(bytes);
      if (bytes.toString('base64url') !== part.bytes || !bytes.length || bytes.length > chunkBytes
        || (i<envelope.chunks.length-1 && bytes.length !== chunkBytes)) throw new DraftStorageError();
    }
    combined = Buffer.concat(chunks);
    if (combined.length > scopeOriginalMaxBytes) throw new DraftStorageError();
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(combined));
  } catch { throw new DraftStorageError(); }
  finally { combined?.fill(0); for (const chunk of chunks) chunk.fill(0); }
}
