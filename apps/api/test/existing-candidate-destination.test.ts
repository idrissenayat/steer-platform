import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { createGitHubReader, type CorpusRepositoryReader } from '@steer/adapters/github';
import type { ExistingCandidateDestinationAuthority } from '@steer/adapters/existing-candidate-destination';
import type { NewCandidateDestinationAuthority } from '@steer/adapters/new-candidate-destination';
import { candidateSaveReviewOutputSchema } from '@steer/tool-registry/candidate-save-review-contracts';
import { describeCandidateSavePreview } from '@steer/tool-registry/candidate-save-preview-contracts';
import { planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import { createVerifiedExistingCandidateDestination, createVerifiedCandidateSaveDestination } from '../src/runtime.ts';
import { candidateInput } from '../../../packages/tool-registry/test/candidate-read-fixture.ts';
import { candidateSavePreviewFixture } from '../../../packages/tool-registry/test/candidate-save-preview.fixture.ts';
import { fixture, binding, now } from '../../../packages/adapters/test/github-brief-fixture.ts';

const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
async function setup(t: { after(run: () => void): void }, lifecycle: 'candidate-not-pulled' | 'existing-target-proposal-only' = 'candidate-not-pulled', linked = false) {
  const f = await candidateSavePreviewFixture(), git = fixture(t), itemId = f.previewInput.itemId, root = `items/${itemId}`;
  const relationship = linked ? { itemId: '0002-related', revision: git.head() } : null;
  const prior = await planCandidateBundle({ ...candidateInput, itemId, expectedHead: git.head(), relationship });
  if (lifecycle === 'candidate-not-pulled') git.add(prior.files.map(({ path, content }) => ({ path, content })));
  else git.add([{ path: `${root}/BRIEF.md`, content: candidateInput.documents.brief }, { path: `${root}/SPEC.md`, content: 'Canonical Spec: keep unchanged' },
    { path: `${root}/EXAM.md`, content: 'Canonical Exam: keep unchanged' }]);
  const bind = (patch: Record<string, unknown> = {}) => {
    const choice = { action: 'extend-existing', reason: 'Deliberate correction of existing scope.', target: { path: `${root}/BRIEF.md`, revision: git.head(),
      contentDigest: createHash('sha256').update(candidateInput.documents.brief).digest('hex') } };
    const { reviewDigest: _, ...body } = candidateSaveReviewOutputSchema.parse({ ...f.output, branch: binding.branch, expectedHead: git.head(), choice, ...patch });
    const review = candidateSaveReviewOutputSchema.parse({ ...body, reviewDigest: hash(['steer-final-save-review/v1', body]) });
    return { review, input: { ...f.previewInput, choice: review.choice, reviewDigest: review.reviewDigest } };
  };
  const { review, input } = bind(), config = { ...f.scope, branch: binding.branch, itemIds: [itemId, '0002-related', '0999-new'] };
  const native = createGitHubReader(binding, { appJwt: async () => 'synthetic-app-jwt', fetch: git.transport, now: () => now });
  const state = { proofs: 0, sources: [] as string[], grants: 0 };
  const authority: ExistingCandidateDestinationAuthority = {
    authorize: async selected => { state.grants++; assert.equal(selected.itemId, itemId); },
    authorizeSource: async ref => { state.sources.push(ref.path); assert.equal(ref.subject, config.subject); assert.ok(ref.path.startsWith(`${root}/`)); },
    verify: async context => { state.proofs++; return { ...context, kind: 'steer-existing-candidate-destination-authority/v1', lifecycle, relationship,
      permissionsRevision: 'synthetic-current-grants', evidenceDigest: 'e'.repeat(64), evaluatedAt: new Date().toISOString(), validThrough: new Date(Date.now()+60000).toISOString() }; },
  };
  const make = (reader: CorpusRepositoryReader = native, overrides: Partial<ExistingCandidateDestinationAuthority> = {}) => createVerifiedExistingCandidateDestination(reader, config, { ...authority, ...overrides });
  return { f, git, input, review, bind, config, native, authority, state, make, prior, root, relationship };
}
test('native Git pre-pull destination verifies pointer, manifest, all documents and Brief mirror before reproducible candidate revision', async t => {
  const f = await setup(t), port = f.make(), before = f.git.head();
  try {
    const first = await port.resolve(f.input, f.review, async () => {}), second = await port.resolve(f.input, f.review, async () => {});
    assert.deepEqual(first, second); assert.equal(first.purpose, 'candidate-revision'); assert.equal(first.lifecycle, 'candidate-not-pulled');
    assert.equal(first.previousBundleDigest, f.prior.manifestDigest); assert.equal(first.amendment, null); assert.equal(first.relationship, null);
    assert.equal(new Set(f.state.sources).size, 6); assert.equal(f.state.proofs, 4);
    const planned = await describeCandidateSavePreview(f.input, f.review, f.f.content.documents, f.f.lineage, first, 'app:synthetic');
    assert.equal(planned.output.pointerPath, `${f.root}/CANDIDATE.json`); assert.equal(planned.output.manifest.previousBundleDigest, f.prior.manifestDigest);
    assert.equal(planned.output.saveConfirmed, false); assert.equal(planned.output.savedToGit, false); assert.equal(planned.output.gateSigned, false);
    assert.equal(f.git.head(), before); assert.equal(f.git.mutations(), 0); assert.equal(f.git.approvals(), 0);
    assert.ok(f.git.calls.every(c => c.method === 'GET' || c.path === '/app/installations/1/access_tokens'));
    assert.doesNotMatch(JSON.stringify(first), /documents|instructions|synthetic-current-grants/);
  } finally { port.close(); }
});
test('candidate revision preserves only the exact prior relationship approved by current policy', async t => {
  const f = await setup(t, 'candidate-not-pulled', true), port = f.make();
  try {
    const result = await port.resolve(f.input, f.review, async () => {}); assert.deepEqual(result.relationship, f.relationship);
    const planned = await describeCandidateSavePreview(f.input, f.review, f.f.content.documents, f.f.lineage, result, 'app:synthetic');
    assert.deepEqual(planned.output.manifest.relationship, f.relationship);
  } finally { port.close(); }
  const wrong = f.make(f.native, { verify: async (...args) => ({ ...await f.authority.verify(...args) as object, relationship: null }) });
  try { await assert.rejects(wrong.resolve(f.input, f.review, async () => {})); } finally { wrong.close(); }
});
test('native Git canonical item gets a reproducible FIRST amendment with exact target and no canonical replacement', async t => {
  const f = await setup(t, 'existing-target-proposal-only'), port = f.make();
  try {
    const result = await port.resolve(f.input, f.review, async () => {});
    assert.deepEqual(await port.resolve(f.input, f.review, async () => {}), result);
    assert.equal(result.purpose, 'amendment'); assert.equal(result.previousBundleDigest, null); assert.equal(result.relationship, null);
    assert.deepEqual(result.amendment?.target, { itemId: f.input.itemId, revision: f.git.head() }); assert.equal(result.amendment?.parentProposalDigest, null);
    assert.match(result.amendment!.proposalId, /^[a-f0-9]{8}-[a-f0-9]{4}-8[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/);
    const planned = await describeCandidateSavePreview(f.input, f.review, f.f.content.documents, f.f.lineage, result, 'app:synthetic');
    assert.equal(planned.output.pointerPath, `${f.root}/proposals/${result.amendment!.proposalId}.json`);
    const writePlan = await planCandidateBundle({ ...planned.submission.bundle, operationId: randomUUID() });
    assert.equal(writePlan.files.length, 6);
    assert.ok(writePlan.files.every(v => ![`${f.root}/BRIEF.md`, `${f.root}/SPEC.md`, `${f.root}/EXAM.md`, `${f.root}/CANDIDATE.json`].includes(v.path)));
    assert.equal(new Set(f.state.sources).size, 1); assert.equal(f.git.mutations(), 0);
  } finally { port.close(); }
});
test('lifecycle is independently supplied, never guessed from pointer presence or canonical filenames', async t => {
  const canonical = await setup(t, 'existing-target-proposal-only');
  const falselyCandidate = canonical.make(canonical.native, { verify: async (...args) => ({ ...await canonical.authority.verify(...args) as object, lifecycle: 'candidate-not-pulled' }) });
  try { await assert.rejects(falselyCandidate.resolve(canonical.input, canonical.review, async () => {})); } finally { falselyCandidate.close(); }
  // A retained old candidate pointer can remain after pull. Trusted lifecycle, not
  // its presence, selects proposal-only; canonical files must not be read/rewritten.
  canonical.git.add(canonical.prior.files.map(({ path, content }) => ({ path, content }))); const selected = canonical.bind();
  const port = canonical.make(); try {
    const result = await port.resolve(selected.input, selected.review, async () => {});
    assert.equal(result.purpose, 'amendment'); assert.ok(canonical.state.sources.every(p => p.endsWith('/BRIEF.md')));
  } finally { port.close(); }
});
test('selected proposal, wrong action, legacy/foreign item and configuration mismatches fail before Git I/O', async t => {
  const f = await setup(t), port = f.make();
  try {
    for (const patch of [{ proposalId: randomUUID() }, { itemId: '0999-foreign' }, { configurationRevision: 'stale' },
      { organizationId: 'foreign' }, { choice: { action: 'new-distinct', reason: 'Do not fall back.' } },
      { choice: { ...f.review.choice, target: { path: 'intent/0001/BRIEF.md', revision: f.git.head(), contentDigest: 'f'.repeat(64) } } }])
      await assert.rejects(port.resolve({ ...f.input, ...patch } as typeof f.input, f.review, async () => {}));
    assert.equal(f.git.calls.length, 0); assert.equal(f.state.proofs, 0);
  } finally { port.close(); }
});
test('real older-target amendment demonstrates current-review incompatibility without silent rebase or replacement', async t => {
  const f = await setup(t, 'existing-target-proposal-only'), targetRevision = f.git.head(), proposalId = randomUUID();
  const plan = await planCandidateBundle({ ...candidateInput, itemId: f.input.itemId, expectedHead: targetRevision,
    purpose: 'amendment', amendment: { proposalId, target: { itemId: f.input.itemId, revision: targetRevision }, parentProposalDigest: null } });
  f.git.add(plan.files.map(({ path, content }) => ({ path, content }))); const selected = f.bind(), port = f.make();
  try {
    assert.notEqual(targetRevision, f.git.head());
    await assert.rejects(port.resolve({ ...selected.input, proposalId }, selected.review, async () => {}));
    assert.equal(f.git.calls.length, 0); assert.equal(f.git.mutations(), 0);
  } finally { port.close(); }
});
test('candidate pointer and bundle failures never degrade into first amendments or new candidates', async t => {
  for (const corrupted of ['pointer', 'manifest', 'brief-mirror', 'spec']) {
    const f = await setup(t);
    const path = corrupted === 'pointer' ? `${f.root}/CANDIDATE.json` : corrupted === 'manifest' ? `${f.root}/candidates/${candidateInput.bundleId}/MANIFEST.json`
      : corrupted === 'brief-mirror' ? `${f.root}/candidates/${candidateInput.bundleId}/BRIEF.md` : `${f.root}/candidates/${candidateInput.bundleId}/SPEC.md`;
    f.git.add([{ path, content: 'Corrupted prior bytes' }]); const selected = f.bind(), port = f.make();
    try { await assert.rejects(port.resolve(selected.input, selected.review, async () => {})); assert.equal(f.git.mutations(), 0); } finally { port.close(); }
  }
});
test('existing destination rejects invalid topology/modes, forged blobs, wrong target bytes and stale reviewed head', async t => {
  const f = await setup(t), inventory = await f.native.readScopeInventory(f.git.head());
  const patches = [{ repositoryId: 99 }, { entries: [...inventory.entries, inventory.entries[0]] }, { entries: inventory.entries.filter(e => e.path !== f.root) },
    ...['120000', '100755'].map(mode => ({ entries: inventory.entries.map(e => e.path === `${f.root}/CANDIDATE.json` ? { ...e, mode } : e) }))];
  for (const patch of patches) {
    const port = f.make({ ...f.native, readScopeInventory: async () => ({ ...inventory, ...patch }) } as CorpusRepositoryReader);
    try { await assert.rejects(port.resolve(f.input, f.review, async () => {})); } finally { port.close(); }
  }
  const corrupt = f.make({ ...f.native, readArtifact: async (...args) => ({ ...await f.native.readArtifact(...args), content: 'forged' }) });
  try { await assert.rejects(corrupt.resolve(f.input, f.review, async () => {})); } finally { corrupt.close(); }
  for (const patch of [{ revision: 'f'.repeat(40) }, { contentDigest: 'f'.repeat(64) }]) {
    const selected = f.bind({ choice: { ...f.review.choice, target: { ...(f.review.choice as { target: object }).target, ...patch } } }), port = f.make();
    try { await assert.rejects(port.resolve(selected.input, selected.review, async () => {})); } finally { port.close(); }
  }
});
test('candidate root Brief must mirror the verified bundle even when the final review matches the changed root', async t => {
  const f = await setup(t), content = '# Out-of-band root correction\n';
  f.git.add([{ path: `${f.root}/BRIEF.md`, content }]);
  const selected = f.bind({ choice: { ...f.review.choice, target: { path: `${f.root}/BRIEF.md`, revision: f.git.head(),
    contentDigest: createHash('sha256').update(content).digest('hex') } } }), port = f.make();
  try { await assert.rejects(port.resolve(selected.input, selected.review, async () => {})); assert.equal(f.git.mutations(), 0); } finally { port.close(); }
});
test('current identity grant and immutable configured binding are required independently of valid Git objects', async t => {
  const f = await setup(t), denied = f.make(f.native, { authorize: async () => { throw new Error('PRIVATE grant'); } });
  try { await assert.rejects(denied.resolve(f.input, f.review, async () => {}), /unavailable/); assert.equal(f.git.calls.length, 0); } finally { denied.close(); }
  assert.throws(() => createVerifiedExistingCandidateDestination(f.native, f.config, { ...f.authority, verify: undefined } as unknown as ExistingCandidateDestinationAuthority));
  const mutable = { ...f.native, binding: { ...f.native.binding } }, port = f.make(mutable);
  try { mutable.binding.repositoryId = 999; await assert.rejects(port.resolve(f.input, f.review, async () => {})); assert.equal(f.git.calls.length, 0); } finally { port.close(); }
});
test('existing destination requires current independent policy with exact scope and valid stable lifetime', async t => {
  const f = await setup(t);
  for (const patch of [{ itemId: '9999-foreign' }, { rootTreeSha: 'a'.repeat(40) }, { requestDigest: 'a'.repeat(64) }, { lifecycle: 'absent-item' },
    { evaluatedAt: new Date(Date.now()+300000).toISOString() }, { validThrough: new Date(0).toISOString() },
    { validThrough: new Date(Date.now()+600000).toISOString() }, { savedToGit: true }]) {
    const port = f.make(f.native, { verify: async (...args) => ({ ...await f.authority.verify(...args) as object, ...patch }) });
    try { await assert.rejects(port.resolve(f.input, f.review, async () => {})); } finally { port.close(); }
  }
  let calls = 0;
  const changed = f.make(f.native, { verify: async (...args) => ({ ...await f.authority.verify(...args) as object, evidenceDigest: (++calls === 1 ? 'a' : 'b').repeat(64) }) });
  try { await assert.rejects(changed.resolve(f.input, f.review, async () => {})); assert.equal(calls, 2); } finally { changed.close(); }
  const missing = f.make(f.native, { verify: async () => null });
  try { await assert.rejects(missing.resolve(f.input, f.review, async () => {})); } finally { missing.close(); }
});
test('late source denial, principal loss, moved branch and expired evidence withhold existing destinations', async t => {
  for (const failure of ['source', 'identity', 'branch-first', 'branch-final', 'expiry']) {
    const f = await setup(t, 'existing-target-proposal-only'); let proofs = 0, reads = 0, sources = 0, revoked = false;
    const port = f.make({ ...f.native, readHead: async () => { if (++reads === 3 && failure === 'expiry') await new Promise(r => setTimeout(r, 2100)); return f.native.readHead(); } }, {
      authorizeSource: async () => { if (++sources === 4 && failure === 'source') throw new Error('PRIVATE source denial'); },
      verify: async (...args) => { proofs++; if ((proofs === 1 && failure === 'branch-first') || (proofs === 2 && failure === 'branch-final')) f.git.add([{ path: 'unrelated.md', content: failure }]);
        if (proofs === 2 && failure === 'identity') revoked = true;
        return { ...await f.authority.verify(...args) as object, validThrough: new Date(Date.now()+(failure === 'expiry' ? 2000 : 60000)).toISOString() }; },
    });
    try { await assert.rejects(port.resolve(f.input, f.review, async () => { if (revoked) throw new Error('PRIVATE identity'); }), error => { assert.doesNotMatch(String(error), /PRIVATE/); return true; }); }
    finally { port.close(); }
  }
});
test('existing destination bounds pending requests and close suppresses all late inventory outcomes', async t => {
  const f = await setup(t); let reads = 0, release!: () => void;
  const pending = new Promise<void>(r => { release = r; }), port = f.make({ ...f.native, readScopeInventory: async (...args) => { reads++; await pending; return f.native.readScopeInventory(...args); } });
  const jobs = Array.from({ length: 4 }, () => assert.rejects(port.resolve(f.input, f.review, async () => {})));
  for (let i = 0; i < 100 && reads < 4; i++) await new Promise(r => setImmediate(r));
  assert.equal(reads, 4); await assert.rejects(port.resolve(f.input, f.review, async () => {}));
  port.close(); await Promise.all(jobs); release(); await new Promise(r => setImmediate(r));
  assert.equal(reads, 4); await assert.rejects(port.resolve(f.input, f.review, async () => {}));
});
test('composed destination dispatches only the human direction and never falls back after failure', async t => {
  const f = await setup(t); let newProofs = 0;
  const newItem: NewCandidateDestinationAuthority = { authorize: async () => {}, authorizeSource: async () => {}, verify: async context => {
    newProofs++; return { ...context, kind: 'steer-new-candidate-destination-authority/v1', lifecycle: 'absent-item', permissionsRevision: 'synthetic',
      evidenceDigest: 'e'.repeat(64), evaluatedAt: new Date().toISOString(), validThrough: new Date(Date.now()+60000).toISOString() }; } };
  const port = createVerifiedCandidateSaveDestination(f.native, f.config, { newItem, existingItem: f.authority });
  try {
    const existing = await port.resolve(f.input, f.review, async () => {}); assert.equal(existing.purpose, 'candidate-revision'); assert.equal(newProofs, 0);
    await assert.rejects(port.resolve({ ...f.input, proposalId: randomUUID() }, f.review, async () => {})); assert.equal(newProofs, 0);
    const selected = f.bind({ choice: { action: 'new-distinct', reason: 'Explicit different work' } });
    const created = await port.resolve({ ...selected.input, itemId: '0999-new' }, selected.review, async () => {});
    assert.equal(created.purpose, 'new-candidate'); assert.equal(newProofs, 2); assert.equal(f.state.proofs, 2);
  } finally { port.close(); }
  await assert.rejects(port.resolve(f.input, f.review, async () => {}));
});
