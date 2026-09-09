import type { IntentScopeReader } from '@steer/tool-registry/intent-scope-read-contracts';
import { verifyIntentScopeHistoryOutput, type IntentScopeHistoryReader } from '@steer/tool-registry/intent-scope-history-contracts';
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

/** Verify the captured assessment as historical input lineage, not current
 * admission or new duplicate clearance. The current-only function above remains
 * mandatory for ordinary reads, starts, worker rendering and result consumption.
 * Returns no current binding, checkpoint, execution grant or replacement input. */
export async function verifyHistoricalDevelopmentScopeReview(original: DevelopmentOriginal,
  reader: IntentScopeHistoryReader | undefined, current: () => Promise<void>): Promise<void> {
  const unavailable = () => new Error('Historical generation scope is unavailable.');
  const present = async () => { if (await current() !== undefined) throw unavailable(); };
  await present();
  const bound = original.direction.scopeReview;
  if (!bound) return; // Legacy originals have no assessment; never invent one.
  await verifyBoundIntentScope(bound, original.evidence); await present();
  if (bound.kind === 'empty-corpus') return;
  const c = original.configuration, s = original.source;
  const checkScope = () => {
    if (!reader || reader.scope.subject !== c.subject
      || (['organizationId', 'productId', 'repository'] as const).some(k => reader.scope[k] !== c[k])) throw unavailable();
  };
  checkScope();
  const history = await verifyIntentScopeHistoryOutput(await reader!.read({ organizationId: c.organizationId,
    productId: c.productId, repository: c.repository, reviewId: bound.reviewId, preparationDigest: bound.preparationDigest }, present));
  await present(); checkScope();
  if (history.subject !== c.subject || (['organizationId', 'productId', 'repository'] as const).some(k => history[k] !== c[k])
    || history.reviewId !== bound.reviewId || history.preparationDigest !== bound.preparationDigest
    || (['draftId', 'revision', 'revisionDigest', 'scopeInputDigest'] as const).some(k => history.source[k] !== s[k])
    || history.head !== original.evidence.head || history.sourceSnapshotDigest !== original.direction.sourceSnapshotDigest
    || JSON.stringify(history.inventory) !== JSON.stringify(original.evidence.inventory)
    || JSON.stringify(history.review) !== JSON.stringify(bound.results)) throw unavailable();
  // latestRevision and execution expiry may have changed; the exact assessed
  // source and captured result cannot. This proves lineage only, not freshness.
  await present();
}
