import { z } from 'zod';
import { assertIntentSaveBindingCurrent, intentDocumentDraftsSchema, intentSaveBindingSchema } from './intent-revision-contracts.ts';

const id = z.string().min(1).max(200).refine(value => value.trim().length > 0 && !/[\uD800-\uDFFF]/u.test(value));
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/), head = z.string().regex(/^[a-f0-9]{40}(?![\s\S])/);
const itemId = z.string().regex(/^[0-9]{4}-[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/).max(160);
const uuid = z.uuid().length(36).refine(value => value === value.toLowerCase(), 'Path UUIDs must be lowercase.');
const target = z.strictObject({ itemId, revision: head });
const reviewState = z.enum(['unreviewed', 'stale']);
const documentRef = z.strictObject({ path: z.string().min(1).max(200), contentDigest: digest });
export const candidateBundleReferenceSchema = z.strictObject({
  organizationId: id, productId: id, repository: id, branch: id, itemId, bundleId: uuid,
  revision: head, manifestDigest: digest,
});
export type CandidateBundleReference = z.infer<typeof candidateBundleReferenceSchema>;
export const candidatePointerReferenceSchema = candidateBundleReferenceSchema.omit({ bundleId: true, manifestDigest: true }).extend({ proposalId: uuid.nullable() });
export const candidateBundleManifestSchema = z.strictObject({
  kind: z.literal('steer-candidate-bundle/v1'), organizationId: id, productId: id, repository: id, itemId, bundleId: uuid,
  purpose: z.enum(['new-candidate', 'candidate-revision', 'amendment']), previousBundleDigest: digest.nullable(),
  target: target.nullable(), relationship: target.nullable(),
  documents: z.strictObject({ brief: documentRef, spec: documentRef, exam: documentRef }),
  review: z.strictObject({ scopeInputDigest: digest, sourceSnapshotDigest: digest, assessmentDigest: digest, dispositionDigest: digest }),
  lineage: z.strictObject({ originatorSubject: id, serviceCommitter: id, architectConfigurationRevision: id,
    examConfigurationRevision: id, editedDocuments: z.array(z.enum(['brief', 'spec', 'exam'])).max(3) }),
  specConformance: z.strictObject({ state: reviewState }), examReview: z.strictObject({ state: reviewState }),
}).superRefine((value, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  for (const name of ['brief', 'spec', 'exam'] as const) {
    if (value.documents[name].path !== `candidates/${value.bundleId}/${name.toUpperCase()}.md`) fail('Unexpected candidate document path.');
  }
  if ((value.purpose === 'amendment') !== Boolean(value.target)
    || (value.target && (value.target.itemId !== value.itemId || value.relationship))) fail('Invalid amendment target.');
  if (value.purpose === 'new-candidate' && value.previousBundleDigest) fail('Unexpected prior bundle.');
  if (value.purpose === 'candidate-revision' && !value.previousBundleDigest) fail('Missing prior bundle.');
  if (value.relationship?.itemId === value.itemId) fail('Self-linked item.');
  const edits = value.lineage.editedDocuments;
  if (new Set(edits).size !== edits.length) fail('Duplicate edit lineage.');
  if (edits.some(name => name === 'brief' || name === 'spec') && value.specConformance.state !== 'stale') fail('Obsolete Spec review.');
  if (edits.length && value.examReview.state !== 'stale') fail('Obsolete Exam review.');
});
export const candidateBundlePointerSchema = z.strictObject({
  kind: z.literal('steer-candidate-pointer/v1'), itemId, bundleId: uuid,
  manifestPath: z.string().min(1).max(200), manifestDigest: digest,
  proposalTarget: target.nullable(), parentProposalDigest: digest.nullable(),
}).superRefine((value, ctx) => {
  if (value.manifestPath !== `candidates/${value.bundleId}/MANIFEST.json`
    || (value.proposalTarget && value.proposalTarget.itemId !== value.itemId)
    || (!value.proposalTarget && value.parentProposalDigest)) ctx.addIssue({ code: 'custom', message: 'Invalid candidate pointer.' });
});
export const candidateBundleInputSchema = z.strictObject({
  organizationId: id, productId: id, repository: id, branch: id, itemId,
  bundleId: uuid, operationId: uuid,
  purpose: z.enum(['new-candidate', 'candidate-revision', 'amendment']),
  previousBundleDigest: digest.nullable(),
  amendment: z.strictObject({ proposalId: uuid, target, parentProposalDigest: digest.nullable() }).nullable(),
  relationship: target.nullable(),
  originatorSubject: id, serviceCommitter: id,
  architectConfigurationRevision: id, examConfigurationRevision: id,
  editedDocuments: z.array(z.enum(['brief', 'spec', 'exam'])).max(3),
  scopeInputDigest: digest, sourceSnapshotDigest: digest, assessmentDigest: digest, dispositionDigest: digest,
  specConformance: reviewState, examReview: reviewState,
  expectedHead: head, documents: intentDocumentDraftsSchema,
}).superRefine((value, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (value.purpose === 'new-candidate' && (value.previousBundleDigest || value.amendment)) fail('A new candidate has no previous bundle or amendment.');
  if (value.purpose === 'candidate-revision' && (!value.previousBundleDigest || value.amendment)) fail('A candidate revision requires its previous bundle and no amendment.');
  if (value.purpose === 'amendment') {
    if (!value.amendment || value.relationship || value.amendment.target.itemId !== value.itemId) fail('An amendment must bind the same item target, not a new-item relationship.');
    if (Boolean(value.previousBundleDigest) !== Boolean(value.amendment?.parentProposalDigest)) fail('Amendment corrections require both prior bundle and proposal references.');
  }
  if (value.relationship?.itemId === value.itemId) fail('A relationship cannot link an item to itself.');
  if (new Set(value.editedDocuments).size !== value.editedDocuments.length) fail('Duplicate edit lineage.');
  if (Object.values(value.documents).some(content => !content.trim())) fail('All three candidate documents must be nonempty.');
  if (value.editedDocuments.some(name => name === 'brief' || name === 'spec') && value.specConformance !== 'stale') fail('Brief/Spec edits invalidate Spec conformance.');
  if (value.editedDocuments.length && value.examReview !== 'stale') fail('Document edits invalidate Exam applicability.');
});

async function sha256(content: string) {
  const result = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('');
}
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}

/**
 * Creates an inert write plan, never a Git call, save receipt or authority grant.
 * An adapter must enforce current grants, exact final-scope/consent bindings,
 * lifecycle and previous-pointer checks, path/symlink protection, provider CAS
 * and full readback. No canonical SPEC/EXAM or gate path can be generated here.
 */
export async function planCandidateBundle(value: unknown, confirmedBinding?: unknown) {
  const input = candidateBundleInputSchema.parse(value);
  const root = `items/${input.itemId}`, directory = `candidates/${input.bundleId}`;
  const documentRefs = {
    brief: { path: `${directory}/BRIEF.md`, contentDigest: await sha256(input.documents.brief) },
    spec: { path: `${directory}/SPEC.md`, contentDigest: await sha256(input.documents.spec) },
    exam: { path: `${directory}/EXAM.md`, contentDigest: await sha256(input.documents.exam) },
  };
  const manifest = candidateBundleManifestSchema.parse({
    kind: 'steer-candidate-bundle/v1', organizationId: input.organizationId, productId: input.productId,
    repository: input.repository, itemId: input.itemId, bundleId: input.bundleId,
    purpose: input.purpose, previousBundleDigest: input.previousBundleDigest,
    target: input.amendment?.target ?? null, relationship: input.relationship,
    documents: documentRefs,
    review: { scopeInputDigest: input.scopeInputDigest, sourceSnapshotDigest: input.sourceSnapshotDigest,
      assessmentDigest: input.assessmentDigest, dispositionDigest: input.dispositionDigest },
    lineage: { originatorSubject: input.originatorSubject, serviceCommitter: input.serviceCommitter,
      architectConfigurationRevision: input.architectConfigurationRevision, examConfigurationRevision: input.examConfigurationRevision,
      editedDocuments: [...input.editedDocuments].sort() },
    specConformance: { state: input.specConformance }, examReview: { state: input.examReview },
  });
  const manifestContent = json(manifest), manifestDigest = await sha256(manifestContent);
  const pointer = candidateBundlePointerSchema.parse({
    kind: 'steer-candidate-pointer/v1', itemId: input.itemId, bundleId: input.bundleId,
    manifestPath: `${directory}/MANIFEST.json`, manifestDigest,
    proposalTarget: input.amendment?.target ?? null,
    parentProposalDigest: input.amendment?.parentProposalDigest ?? null,
  });
  const pointerPath = input.amendment ? `${root}/proposals/${input.amendment.proposalId}.json` : `${root}/CANDIDATE.json`;
  const pointerContent = json(pointer), pointerDigest = await sha256(pointerContent);
  // Preview plans may precede confirmation. A writer must require a bound plan:
  // the receipt then identifies the exact draft revision and consent snapshot,
  // not merely another save with the same document bytes. Equality is not authority.
  const confirmation = confirmedBinding === undefined ? null : intentSaveBindingSchema.parse(confirmedBinding);
  if (confirmation) assertIntentSaveBindingCurrent(confirmation, { ...confirmation,
    organizationId: input.organizationId, productId: input.productId, subject: input.originatorSubject,
    repository: input.repository, branch: input.branch, item: root, expectedHead: input.expectedHead,
    bundleManifestDigest: manifestDigest, scopeInputDigest: input.scopeInputDigest,
    sourceSnapshotDigest: input.sourceSnapshotDigest, assessmentDigest: input.assessmentDigest, dispositionDigest: input.dispositionDigest });
  const confirmationDigest = confirmation ? await sha256(json(confirmation)) : null;
  const inputDigest = await sha256(json(['steer-candidate-save-input/v2', input.organizationId,
    input.productId, input.repository, input.branch, input.operationId, input.expectedHead,
    manifestDigest, pointerPath, pointerDigest, confirmationDigest]));
  const receiptPath = `.steer/authoring/bundle-operations/${input.operationId}.json`;
  const receipt = { kind: 'steer-candidate-operation/v1', operationId: input.operationId, inputDigest, confirmationDigest,
    expectedHead: input.expectedHead, pointerPath, pointerDigest, manifestPath: `${root}/${pointer.manifestPath}`, manifestDigest };
  const files: Array<{ path: string; content: string; mode: 'create' | 'compare-and-swap'; contentDigest: string }> = [];
  async function add(path: string, content: string, mode: 'create' | 'compare-and-swap' = 'create') {
    files.push({ path, content, mode, contentDigest: await sha256(content) });
  }
  for (const name of ['brief', 'spec', 'exam'] as const) await add(`${root}/${documentRefs[name].path}`, input.documents[name]);
  await add(`${root}/${pointer.manifestPath}`, manifestContent);
  await add(pointerPath, pointerContent, input.previousBundleDigest ? 'compare-and-swap' : 'create');
  if (input.purpose !== 'amendment') await add(`${root}/BRIEF.md`, input.documents.brief, input.purpose === 'candidate-revision' ? 'compare-and-swap' : 'create');
  await add(receiptPath, json(receipt));
  return freeze({ kind: 'steer-candidate-write-plan/v1' as const, destination: { organizationId: input.organizationId,
    productId: input.productId, repository: input.repository, branch: input.branch },
    inputDigest, confirmationDigest, manifestDigest, pointerDigest, expectedHead: input.expectedHead,
    requiredPreviousBundleDigest: input.previousBundleDigest,
    requiredParentProposalDigest: input.amendment?.parentProposalDigest ?? null,
    requiredLifecycle: input.purpose === 'new-candidate' ? 'absent-item' as const
      : input.purpose === 'candidate-revision' ? 'candidate-not-pulled' as const : 'existing-target-proposal-only' as const,
    files, saved: false as const, gateSigned: false as const, executionAuthorized: false as const });
}
