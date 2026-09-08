import { z } from 'zod';
import { intentDocumentDraftsSchema } from './intent-revision-contracts.ts';

const id = z.string().min(1).max(200).refine(value => value.trim().length > 0 && !/[\uD800-\uDFFF]/u.test(value));
const digest = z.string().regex(/^[a-f0-9]{64}$/), head = z.string().regex(/^[a-f0-9]{40}$/);
const itemId = z.string().regex(/^[0-9]{4}-[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160);
const uuid = z.uuid().refine(value => value === value.toLowerCase(), 'Path UUIDs must be lowercase.');
const target = z.strictObject({ itemId, revision: head });
const reviewState = z.enum(['unreviewed', 'stale']);
const inputSchema = z.strictObject({
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
export async function planCandidateBundle(value: unknown) {
  const input = inputSchema.parse(value);
  const root = `items/${input.itemId}`, directory = `candidates/${input.bundleId}`;
  const documentRefs = {
    brief: { path: `${directory}/BRIEF.md`, contentDigest: await sha256(input.documents.brief) },
    spec: { path: `${directory}/SPEC.md`, contentDigest: await sha256(input.documents.spec) },
    exam: { path: `${directory}/EXAM.md`, contentDigest: await sha256(input.documents.exam) },
  };
  const manifest = {
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
  };
  const manifestContent = json(manifest), manifestDigest = await sha256(manifestContent);
  const pointer = {
    kind: 'steer-candidate-pointer/v1', itemId: input.itemId, bundleId: input.bundleId,
    manifestPath: `${directory}/MANIFEST.json`, manifestDigest,
    proposalTarget: input.amendment?.target ?? null,
    parentProposalDigest: input.amendment?.parentProposalDigest ?? null,
  };
  const pointerPath = input.amendment ? `${root}/proposals/${input.amendment.proposalId}.json` : `${root}/CANDIDATE.json`;
  const pointerContent = json(pointer), pointerDigest = await sha256(pointerContent);
  const inputDigest = await sha256(json(['steer-candidate-save-input/v1', input.organizationId,
    input.productId, input.repository, input.branch, input.operationId, input.expectedHead,
    manifestDigest, pointerPath, pointerDigest]));
  const receiptPath = `.steer/authoring/bundle-operations/${input.operationId}.json`;
  const receipt = { kind: 'steer-candidate-operation/v1', operationId: input.operationId, inputDigest,
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
    inputDigest, manifestDigest, pointerDigest, expectedHead: input.expectedHead,
    requiredPreviousBundleDigest: input.previousBundleDigest,
    requiredParentProposalDigest: input.amendment?.parentProposalDigest ?? null,
    requiredLifecycle: input.purpose === 'new-candidate' ? 'absent-item' as const
      : input.purpose === 'candidate-revision' ? 'candidate-not-pulled' as const : 'existing-target-proposal-only' as const,
    files, saved: false as const, gateSigned: false as const, executionAuthorized: false as const });
}
