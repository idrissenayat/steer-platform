import type { IntentScopeReader } from '@steer/tool-registry/intent-scope-read-contracts';
import { bindRecordedIntentScope, verifyBoundIntentScope, intentScopeSelectionSchema, intentScopeSelectionFor,
  type IntentScopeSelection, type IntentScopeBinding, type ScopeSelectionSource } from '@steer/tool-registry/intent-scope-selection';
import type { DevelopmentOriginal } from './development-original-contracts.ts';

/** No cached authority: the same pinned read port is required again when a bound
 * original is restored for start, worker requests or result consumption. */
export async function resolveDevelopmentScopeReview(selection: IntentScopeSelection, evidence: unknown, source: ScopeSelectionSource,
  reader: IntentScopeReader | undefined, current: () => Promise<void>): Promise<IntentScopeBinding> {
  const selected = intentScopeSelectionSchema.parse(selection);
  await current();
  if (selected.kind === 'empty-corpus') { const bound = await verifyBoundIntentScope(selected, evidence); await current(); return bound; }
  if (!reader || reader.scope.subject !== source.subject || (['organizationId', 'productId', 'repository'] as const).some(k => reader.scope[k] !== source[k]))
    throw new Error('Recorded scope assessment is unavailable.');
  const result = await reader.read({ organizationId: source.organizationId, productId: source.productId, repository: source.repository,
    reviewId: selected.reviewId, preparationDigest: selected.preparationDigest }, current);
  await current(); const binding = await bindRecordedIntentScope(selected, result, evidence, source); await current(); return binding;
}
export async function revalidateDevelopmentScopeReview(original: DevelopmentOriginal, reader: IntentScopeReader | undefined, current: () => Promise<void>) {
  const bound = original.direction.scopeReview; if (!bound) return;
  const c = original.configuration, s = original.source;
  const verified = await resolveDevelopmentScopeReview(intentScopeSelectionFor(bound), original.evidence, {
    organizationId: c.organizationId, subject: c.subject, productId: c.productId, repository: c.repository,
    draftId: s.draftId, revision: s.revision, revisionDigest: s.revisionDigest, scopeInputDigest: s.scopeInputDigest,
  }, reader, current);
  if (JSON.stringify(verified) !== JSON.stringify(bound)) throw new Error('Recorded scope assessment changed.');
}
