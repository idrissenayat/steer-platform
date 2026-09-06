import { z } from 'zod';
import { draftBrief } from '@steer/domain/brief-author';
import { readBriefDocument } from '@steer/domain/brief-document';
import { briefPreviewInputSchema } from './brief-preview.ts';
import type { Principal } from './index.ts';
import { briefSaveScopeSchema, briefSaveInputSchema, briefSaveStatusInputSchema, briefSaveReferenceSchema,
  briefSaveObservationSchema, briefWriteAuthoritySchema, type BriefSaveReference, type BriefSaveObservation,
  type BriefSaveOutput, type BriefCreateRequest, type BriefWriteAuthority } from './brief-save-contracts.ts';
export * from './brief-save-contracts.ts';

const configurationSchema = briefSaveScopeSchema.omit({ path: true }).extend({
  paths: z.array(briefSaveScopeSchema.shape.path).min(1).max(100).refine((paths) => new Set(paths).size === paths.length),
  platformRevision: z.string().length(40).regex(/^[a-f0-9]{40}$/), gate2DecisionDigest: z.string().length(64).regex(/^[a-f0-9]{64}$/),
});
/** Trusted adapter seam, not request input or normalized policy-as-proof.
 * No runtime implementation/configuration is installed by this module.
 * Implementations must verify actual source/provider evidence, not these fields alone. */
export interface BriefWriter {
  readonly configuration: z.infer<typeof configurationSchema>;
  /** Authoritative code-host operation-marker read. Unavailable is never absence. */
  inspect(reference: BriefSaveReference, principal: Principal): Promise<unknown>;
  /** Full verified current membership and Gate 2 evidence for this exact request.
   * Grant authority is co-located at expectedHead in this first constrained profile. */
  verifyWriteAuthority(request: BriefCreateRequest, principal: Principal): Promise<unknown>;
  /** Atomically create the absent Brief AND immutable operation marker at expectedHead.
   * Return committed only after exact source readback. Enforce CAS/idempotency across
   * processes; never overwrite either path, project first, retry blindly or use force. */
  compareAndCreate(request: BriefCreateRequest, authority: BriefWriteAuthority): Promise<unknown>;
}
/** Per-invocation instance; constructor is synchronous and must clean up if it
 * throws. close prevents further use; it does not imply rollback of dispatched work. */
export interface ManagedBriefWriter extends BriefWriter { close(): void | Promise<void> }
export class BriefSaveError extends Error {
  readonly code: 'INVALID_INPUT' | 'FORBIDDEN' | 'UNAVAILABLE' | 'UNAUTHENTICATED';
  constructor(code: BriefSaveError['code']) { super('Brief save request rejected.'); this.code = code; }
}
const hash = async (value: string, algorithm = 'SHA-256') => [...new Uint8Array(await crypto.subtle.digest(algorithm, new TextEncoder().encode(value)))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
const sameReference = (value: BriefSaveReference, expected: BriefSaveReference) =>
  (Object.keys(expected) as (keyof BriefSaveReference)[]).every((key) => value[key] === expected[key]);
const observe = (raw: unknown, reference: BriefSaveReference): BriefSaveObservation => {
  const parsed = briefSaveObservationSchema.safeParse(raw);
  return parsed.success && sameReference(parsed.data, reference) &&
    (parsed.data.outcome !== 'committed' || parsed.data.revision !== parsed.data.expectedHead) ? parsed.data : { ...reference, outcome: 'unknown' };
};
const output = (result: BriefSaveObservation): BriefSaveOutput => ({ result, gateSigned: false });

/** Core orchestration with a mandatory current-identity callback from the shared
 * authenticated registry. Callers cannot provide services or gate facts over HTTP.
 * The absent writer fails closed; the real writer is a separate unfinished adapter. */
export async function runBriefSave(mode: 'save' | 'status', raw: unknown, initial: Principal,
  writer: BriefWriter | undefined, refresh: () => Promise<Principal>, clock: () => Date): Promise<BriefSaveOutput> {
  const parsed = (mode === 'save' ? briefSaveInputSchema : briefSaveStatusInputSchema).safeParse(raw);
  if (!parsed.success) throw new BriefSaveError('INVALID_INPUT');
  const input = parsed.data;
  const configuration = configurationSchema.safeParse(writer?.configuration);
  if (!writer || !configuration.success || !['inspect', 'verifyWriteAuthority', 'compareAndCreate'].every((name) => typeof writer[name as keyof BriefWriter] === 'function')) throw new BriefSaveError('UNAVAILABLE');
  const bound = configuration.data;
  if (input.organizationId !== bound.organizationId || input.repository !== bound.repository || input.branch !== bound.branch || !bound.paths.includes(input.path)) throw new BriefSaveError('FORBIDDEN');
  const reference = briefSaveReferenceSchema.parse({ organizationId: input.organizationId, repository: input.repository,
    branch: input.branch, path: input.path, idempotencyKey: input.idempotencyKey, subject: initial.subject });
  const unknown = () => output({ ...reference, outcome: 'unknown' });
  let request: BriefCreateRequest | undefined;
  if (mode === 'save') {
    const accepted = briefSaveInputSchema.parse(raw);
    if (!briefPreviewInputSchema.safeParse({ organizationId: accepted.organizationId, draft: accepted.draft }).success) throw new BriefSaveError('INVALID_INPUT');
    const draft = draftBrief({ ...accepted.draft, author: `Authenticated subject ${encodeURIComponent(initial.subject)}` });
    try { if (!accepted.draft.title.trim() || !draft.validation.valid || readBriefDocument(draft.markdown).issues.length) throw new Error(); }
    catch { throw new BriefSaveError('INVALID_INPUT'); }
    const contentDigest = await hash(draft.markdown);
    if (contentDigest !== accepted.confirmation.contentDigest) throw new BriefSaveError('INVALID_INPUT');
    // Zod fixes input key order; the operation digest binds target, expected head,
    // identity, all original facts and the explicit rendered-content confirmation.
    const requestDigest = await hash(JSON.stringify({ version: 'steer-brief-create/v1', subject: initial.subject, input: accepted, contentDigest }));
    request = { ...reference, requestDigest, expectedHead: accepted.expectedHead, expectedBlob: null,
      content: draft.markdown, contentDigest, contentBlobSha: await hash(`blob ${new TextEncoder().encode(draft.markdown).byteLength}\0${draft.markdown}`, 'SHA-1'),
      operationPath: `.steer/authoring/operations/${reference.idempotencyKey}.json` };
  }
  const beforeRead = await refresh();
  let observed: BriefSaveObservation;
  try { observed = observe(await writer.inspect({ ...reference }, beforeRead), reference); } catch { observed = { ...reference, outcome: 'unknown' }; }
  await refresh(); // Even operation absence or a historical receipt needs current access.
  if (!request) return output(observed);
  if (observed.outcome === 'committed' || observed.outcome === 'pending') {
    if (observed.requestDigest !== request.requestDigest) return output({ ...reference, outcome: 'conflict' });
    if (observed.outcome === 'committed' && (observed.expectedHead !== request.expectedHead || observed.contentDigest !== request.contentDigest || observed.blobSha !== request.contentBlobSha)) return unknown();
    return output(observed);
  }
  if (observed.outcome !== 'not-found') return output(observed);
  const current = await refresh();
  let rawAuthority: unknown;
  try { rawAuthority = await writer.verifyWriteAuthority({ ...request }, current); } catch { throw new BriefSaveError('UNAVAILABLE'); }
  const authority = briefWriteAuthoritySchema.safeParse(rawAuthority);
  if (!authority.success) throw new BriefSaveError('FORBIDDEN');
  const fresh = await refresh(); const now = clock().getTime(); const proof = authority.data;
  const evaluated = Date.parse(proof.evaluatedAt), expiry = Date.parse(proof.validThrough);
  if (!sameReference(proof, reference) || proof.requestDigest !== request.requestDigest || proof.expectedHead !== request.expectedHead ||
    proof.authorizationRevision !== request.expectedHead || proof.platformRevision !== bound.platformRevision || proof.gate2DecisionDigest !== bound.gate2DecisionDigest ||
    !Number.isFinite(now) || !Number.isFinite(evaluated) || !Number.isFinite(expiry) || evaluated > now || now - evaluated > 5000 || expiry <= now || expiry <= evaluated || expiry - evaluated > 30000 ||
    expiry > Date.parse(fresh.expiresAt) || expiry > Date.parse(initial.expiresAt)) throw new BriefSaveError('FORBIDDEN');
  // Last verified identity and authority checks precede the single dispatch.
  // CAS at the adapter fences grant changes after this observation; no cache claim.
  let result: BriefSaveObservation;
  try { result = observe(await writer.compareAndCreate({ ...request }, { ...proof }), reference); }
  catch { return unknown(); }
  // A post-dispatch failure is uncertainty, not rollback or permission to resubmit.
  try { await refresh(); } catch { return unknown(); }
  if (result.outcome === 'not-found' || (result.outcome === 'committed' &&
    (result.requestDigest !== request.requestDigest || result.expectedHead !== request.expectedHead || result.contentDigest !== request.contentDigest || result.blobSha !== request.contentBlobSha)) ||
    (result.outcome === 'pending' && result.requestDigest !== request.requestDigest)) return unknown();
  return output(result);
}
