import { createHash } from 'node:crypto';
import { z } from 'zod';
import { intentScopeInputSchema } from '@steer/tool-registry/intent-revision-contracts';
import { intentEvidenceInputSchema } from '@steer/tool-registry/intent-evidence-contracts';
import { scopeReviewProfileSchema } from '@steer/tool-registry/intent-scope-review';
import { scopeReviewConfigurationSchema, prepareScopeReviewManifest } from './scope-review-operations.ts';
import { scopeOriginalMaxBytes } from './scope-original-envelope.ts';

export const scopeOriginalSchema = z.strictObject({ kind:z.literal('steer-scope-original/v1'), configuration:scopeReviewConfigurationSchema,
  source:z.strictObject({ revision:z.number().int().min(1).max(1000), revisionDigest:z.string().regex(/^[a-f0-9]{64}(?![\s\S])/), scope:intentScopeInputSchema }),
  evidence:intentEvidenceInputSchema, profile:scopeReviewProfileSchema });
export type ScopeOriginal = z.infer<typeof scopeOriginalSchema>;
export const scopeOriginalHash = (v:unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function freezeScopeOriginal<T>(v:T):T { if(v&&typeof v==='object'){Object.values(v).forEach(freezeScopeOriginal);Object.freeze(v);}return v; }
/** Exact historical scope inputs only. Exam and inherited agent conversations
 * have no field. Structural preparation does not verify real source authority. */
export async function describeScopeOriginal(raw:unknown) {
  const original=scopeOriginalSchema.parse(raw),c=original.configuration,s=original.source;
  if(Buffer.byteLength(JSON.stringify(original))>scopeOriginalMaxBytes)throw new Error('Scope original unavailable.');
  const manifest=await prepareScopeReviewManifest(s.scope,original.evidence,original.profile,s.revision);
  if((['organizationId','productId','repository'] as const).some(k=>c[k]!==manifest[k])
    || original.evidence.branch!==c.branch || c.scopeTerms.profileDigest!==manifest.profileDigest)throw new Error('Scope original unavailable.');
  return freezeScopeOriginal({original,manifest,payloadDigest:scopeOriginalHash(['steer-scope-original/v1',original]),
    executionAuthorized:false as const,authoritativeClearance:false as const});
}
