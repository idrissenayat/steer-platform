import { createHash } from 'node:crypto';
import { z } from 'zod';
import { intentDraftContentSchema } from '@steer/tool-registry/intent-draft-content';
import { fingerprintIntentScope } from '@steer/tool-registry/intent-revision-contracts';
import { intentDispositionChoiceSchema } from '@steer/tool-registry/intent-overlap-contracts';
import { buildIntentEvidenceEnvelope, intentEvidenceInputSchema } from '@steer/tool-registry/intent-evidence-contracts';
import { intentOperationConfigurationSchema } from './intent-operations.ts';

const text = (max: number) => z.string().min(1).max(max).refine(v => v.trim().length > 0 && !/[\uD800-\uDFFF]/u.test(v));
const id = text(200).refine(v => !/[\u0000-\u001f\u007f]/u.test(v));
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const revision = z.number().int().min(1).max(1000);
const profile = z.strictObject({ configurationRevision: id, runtimeRevision: id, modelRoute: id,
  maxOutputTokens: z.number().int().min(256).max(8000), instructions: text(30000) });
export const developmentOriginalSchema = z.strictObject({
  kind: z.literal('steer-development-original/v1'), configuration: intentOperationConfigurationSchema,
  source: z.strictObject({ draftId: z.uuid().length(36).refine(v => v === v.toLowerCase()), revision, sourceRevision: revision,
    revisionDigest: digest, scopeInputDigest: digest, content: intentDraftContentSchema }),
  evidence: intentEvidenceInputSchema,
  direction: z.strictObject({ choice: intentDispositionChoiceSchema, scopeInputDigest: digest, sourceSnapshotDigest: digest }),
  profiles: z.strictObject({ architect: profile, testAgent: profile }),
});
export type DevelopmentOriginal = z.infer<typeof developmentOriginalSchema>;
export const developmentOriginalHash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function freezeOriginal<T>(v: T): T { if (v && typeof v === 'object') { Object.values(v).forEach(freezeOriginal); Object.freeze(v); } return v; }

/** Exact private input record, not a semantic verdict, verified human decision,
 * runnable profile, token/cost bound or provider receipt. No I/O or model call.
 * Preserve original strings; credentials and arbitrary model settings have no field.
 */
export async function describeDevelopmentOriginal(raw: unknown) {
  const original = developmentOriginalSchema.parse(raw), c = original.configuration, s = original.source;
  if (c.action !== 'develop' || s.sourceRevision > s.revision || Buffer.byteLength(JSON.stringify(original)) > 786432) throw new Error('Original input unavailable.');
  const fingerprint = await fingerprintIntentScope({ organizationId:c.organizationId,productId:c.productId,repository:c.repository,
    draftId:s.draftId,sourceRevision:s.sourceRevision,originalText:s.content.originalText,clarificationTurns:s.content.clarificationTurns,
    documents:s.content.documents ? { brief:s.content.documents.brief,spec:s.content.documents.spec } : null });
  const evidence = await buildIntentEvidenceEnvelope(original.evidence);
  if (fingerprint.scopeInputDigest !== s.scopeInputDigest || evidence.scopeInputDigest !== s.scopeInputDigest
    || original.direction.scopeInputDigest !== s.scopeInputDigest || original.direction.sourceSnapshotDigest !== evidence.sourceSnapshotDigest
    || (['organizationId','productId','repository','branch'] as const).some(k => evidence.snapshot[k] !== c[k])) throw new Error('Original input unavailable.');
  const choice = original.direction.choice;
  if ('target' in choice && (choice.target.revision !== evidence.snapshot.head || !evidence.evidence.some(ref =>
    ref.path === choice.target.path && ref.contentDigest === choice.target.contentDigest))) throw new Error('Original input unavailable.');
  // Domain separation pins the full source, original expiry/budget binding,
  // inspected bytes/omissions, declared direction, and both exact prompt profiles.
  const inputDigest = developmentOriginalHash(['steer-development-submission/v1',original]);
  return freezeOriginal({ original,inputDigest,evidence,authoritativeClearance:false as const,executionAuthorized:false as const });
}
