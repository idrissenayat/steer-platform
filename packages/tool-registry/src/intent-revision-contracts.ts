import { z } from 'zod';

// Browser/server portable. Reject lone surrogates instead of silently replacing
// them with U+FFFD while hashing; never trim or normalize accepted document bytes.
const exactText = (max: number) => z.string().max(max).refine(value => !/[\uD800-\uDFFF]/u.test(value), 'Invalid Unicode');
const identifier = exactText(200).refine(value => value.trim().length > 0, 'Missing identifier');
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const head = z.string().regex(/^[a-f0-9]{40}$/);
export const intentDocumentDraftsSchema = z.strictObject({
  brief: exactText(30000), spec: exactText(30000), exam: exactText(30000),
});
export type IntentDocumentDrafts = z.infer<typeof intentDocumentDraftsSchema>;

/** This is an input binding, not permission to retain or disclose its contents. */
export const intentScopeInputSchema = z.strictObject({
  organizationId: identifier, productId: identifier, repository: identifier,
  draftId: z.uuid(), sourceRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  originalText: exactText(10000),
  clarificationTurns: z.array(exactText(3000)).max(32),
  documents: z.strictObject({ brief: exactText(30000), spec: exactText(30000) }).nullable(),
});

async function sha256(value: string): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Hashes exact UTF-8 content with an unambiguous, versioned scope envelope. */
export async function fingerprintIntentScope(value: unknown) {
  const input = intentScopeInputSchema.parse(value);
  const [briefDigest, specDigest] = input.documents
    ? await Promise.all([sha256(input.documents.brief), sha256(input.documents.spec)])
    : [null, null];
  const scopeInputDigest = await sha256(JSON.stringify([
    'steer-intent-scope-input/v1', input.organizationId, input.productId, input.repository,
    input.draftId, input.sourceRevision, input.originalText, input.clarificationTurns,
    briefDigest, specDigest,
  ]));
  return Object.freeze({ scopeInputDigest, briefDigest, specDigest });
}

export type IntentRevisionChange = 'source' | 'brief' | 'spec' | 'exam'
  | 'source-snapshot' | 'permissions' | 'retrieval-configuration'
  | 'architect-configuration' | 'exam-configuration';
export type IntentReviewDependency = 'scope-assessment' | 'human-direction'
  | 'spec-conformance' | 'exam-review' | 'save-consent';
const dependencies: readonly IntentReviewDependency[] = [
  'scope-assessment', 'human-direction', 'spec-conformance', 'exam-review', 'save-consent',
];
const invalidation: Record<IntentRevisionChange, readonly IntentReviewDependency[]> = {
  source: dependencies,
  brief: dependencies,
  spec: dependencies,
  exam: ['exam-review', 'save-consent'],
  'source-snapshot': ['scope-assessment', 'human-direction', 'save-consent'],
  permissions: ['scope-assessment', 'human-direction', 'save-consent'],
  'retrieval-configuration': ['scope-assessment', 'human-direction', 'save-consent'],
  'architect-configuration': dependencies,
  'exam-configuration': ['exam-review', 'save-consent'],
};

export function intentDocumentChanges(before: IntentDocumentDrafts, after: IntentDocumentDrafts): IntentRevisionChange[] {
  return (['brief', 'spec', 'exam'] as const).filter(name => before[name] !== after[name]);
}

/** Union with prior invalidations: undoing an edit cannot resurrect old consent. */
export function invalidateIntentReviews(
  changes: readonly IntentRevisionChange[], prior: readonly IntentReviewDependency[] = [],
): IntentReviewDependency[] {
  const invalid = new Set([...prior, ...changes.flatMap(change => invalidation[change])]);
  return dependencies.filter(dependency => invalid.has(dependency));
}

// A shared comparison contract, deliberately NOT a callable tool or an authority
// token. The future save service must derive current values from authorized reads,
// validate assessment/confirmation provenance, enforce policy and reauthorize.
export const intentSaveBindingSchema = z.strictObject({
  kind: z.literal('steer-intent-save-binding/v1'),
  organizationId: identifier, productId: identifier, subject: identifier,
  draftId: z.uuid(), draftRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  scopeInputDigest: digest, sourceSnapshotDigest: digest, assessmentDigest: digest,
  dispositionDigest: digest, bundleManifestDigest: digest,
  repository: identifier, branch: identifier,
  item: z.string().regex(/^items\/[0-9]{4}-[a-z0-9]+(?:-[a-z0-9]+)*$/),
  expectedHead: head,
});
export type IntentSaveBinding = z.infer<typeof intentSaveBindingSchema>;

/** Reject stale or extra-field bindings; equality never supplies save authority. */
export function assertIntentSaveBindingCurrent(confirmed: unknown, serverCurrent: unknown): void {
  const prior = intentSaveBindingSchema.parse(confirmed), current = intentSaveBindingSchema.parse(serverCurrent);
  if (Object.keys(current).some(key => prior[key as keyof IntentSaveBinding] !== current[key as keyof IntentSaveBinding])) {
    throw new Error('Intent save binding changed; review and confirmation are required.');
  }
}

/** Keep the acknowledged older snapshot separate from any newer unsaved edits. */
export function intentSaveCompletionState(recorded: unknown, currentlyEdited: unknown) {
  const previous = intentSaveBindingSchema.parse(recorded), current = intentSaveBindingSchema.parse(currentlyEdited);
  if (previous.organizationId !== current.organizationId || previous.subject !== current.subject
    || previous.productId !== current.productId || previous.repository !== current.repository
    || previous.branch !== current.branch || previous.item !== current.item || previous.draftId !== current.draftId) {
    return 'different-workspace' as const;
  }
  try { assertIntentSaveBindingCurrent(previous, current); return 'current-revision-recorded' as const; }
  catch { return 'previous-revision-recorded' as const; }
}
