import { createHash } from 'node:crypto';
import { planCandidateBundle, candidateBundleInputSchema } from '../src/candidate-bundle-contracts.ts';

export const candidateInput = candidateBundleInputSchema.parse({
  organizationId: 'org', productId: 'product', repository: 'github:52', branch: 'codex/fixture', itemId: '0007-booking',
  bundleId: '57762718-d38a-4926-b96d-7a1c40fdd6f7', operationId: '51f1f1c9-a4d6-435e-9d6e-9b773b8260bb',
  purpose: 'new-candidate', previousBundleDigest: null, amendment: null, relationship: null,
  originatorSubject: 'human', serviceCommitter: 'app:123', architectConfigurationRevision: 'architect-r1', examConfigurationRevision: 'exam-r1',
  editedDocuments: [], scopeInputDigest: 'a'.repeat(64), sourceSnapshotDigest: 'b'.repeat(64),
  assessmentDigest: 'c'.repeat(64), dispositionDigest: 'd'.repeat(64), specConformance: 'unreviewed', examReview: 'unreviewed',
  expectedHead: 'e'.repeat(40), documents: { brief: '\ufeff# Saved Brief\r\nفارسی\n', spec: '# Saved Spec\nAC-01\n',
    exam: '# Candidate Exam\nNOT RUN\n<script>unsafe()</script>\n![image](https://outside.invalid/img)\n[link](https://outside.invalid)' },
});
export async function candidateReadFixture() {
  const plan = await planCandidateBundle(candidateInput);
  const { organizationId, productId, repository, branch, itemId, bundleId } = candidateInput;
  const reference = { organizationId, productId, repository, branch, itemId, bundleId, revision: 'f'.repeat(40), manifestDigest: plan.manifestDigest };
  const file = (suffix: string) => plan.files.find(file => file.path.endsWith(suffix))!;
  const source = (suffix: string) => {
    const f = file(suffix); return { path: f.path, contentDigest: f.contentDigest,
      blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(f.content)}\0`).update(f.content).digest('hex') };
  };
  const manifestContent = file('/MANIFEST.json').content;
  const output = { kind: 'steer-candidate-bundle-content/v1', reference, manifest: JSON.parse(manifestContent), manifestContent,
    documents: { ...candidateInput.documents }, verification: 'exact-commit-bytes', executionAuthorized: false,
    sources: { manifest: source('/MANIFEST.json'), documents: { brief: source(`/candidates/${bundleId}/BRIEF.md`),
      spec: source('/SPEC.md'), exam: source('/EXAM.md') } } };
  return { plan, reference, output };
}
