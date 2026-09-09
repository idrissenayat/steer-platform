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
import { createApi } from '../src/app.ts';
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
test('wrong action, legacy/foreign item and configuration mismatches fail before Git I/O', async t => {
  const f = await setup(t), port = f.make();
  try {
    for (const patch of [{ itemId: '0999-foreign' }, { configurationRevision: 'stale' },
      { organizationId: 'foreign' }, { choice: { action: 'new-distinct', reason: 'Do not fall back.' } },
      { choice: { ...f.review.choice, target: { path: 'intent/0001/BRIEF.md', revision: f.git.head(), contentDigest: 'f'.repeat(64) } } }])
      await assert.rejects(port.resolve({ ...f.input, ...patch } as typeof f.input, f.review, async () => {}));
    assert.equal(f.git.calls.length, 0); assert.equal(f.state.proofs, 0);
  } finally { port.close(); }
});
test('older-target amendment remains denied without independent continuation eligibility despite matching item surface', async t => {
  const f = await setup(t, 'existing-target-proposal-only'), targetRevision = f.git.head(), proposalId = randomUUID();
  const plan = await planCandidateBundle({ ...candidateInput, itemId: f.input.itemId, expectedHead: targetRevision,
    purpose: 'amendment', amendment: { proposalId, target: { itemId: f.input.itemId, revision: targetRevision }, parentProposalDigest: null } });
  f.git.add(plan.files.map(({ path, content }) => ({ path, content }))); const selected = f.bind(), port = f.make();
  try {
    assert.notEqual(targetRevision, f.git.head());
    await assert.rejects(port.resolve({ ...selected.input, proposalId }, selected.review, async () => {}));
    assert.ok(f.git.calls.length > 0); assert.equal(f.git.mutations(), 0);
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

async function amendmentFixture(t: { after(run: () => void): void }) {
  const f = await setup(t, 'existing-target-proposal-only'), targetRevision = f.git.head(), proposalId = randomUUID();
  const parent = await planCandidateBundle({ ...candidateInput, itemId: f.input.itemId, expectedHead: targetRevision,
    purpose: 'amendment', amendment: { proposalId, target: { itemId: f.input.itemId, revision: targetRevision }, parentProposalDigest: null } });
  f.git.add(parent.files.map(({ path, content }) => ({ path, content })));
  const bind = () => { const selected = f.bind(); return { review: selected.review, input: { ...selected.input, proposalId } }; };
  const verify: ExistingCandidateDestinationAuthority['verify'] = async (...args) => ({ ...await f.authority.verify(...args) as object,
    ...(args[0].proposalContinuity ? { proposalContinuation: 'eligible-unchanged-target' } : {}) });
  return { ...f, targetRevision, proposalId, parent, selected: bind(), select: bind, verify,
    continue: (reader: CorpusRepositoryReader = f.native, overrides: Partial<ExistingCandidateDestinationAuthority> = {}) => f.make(reader, { verify, ...overrides }) };
}
test('native Git amendment continuation keeps original A, reviews current B and advances only the selected parent through C', async t => {
  const f = await amendmentFixture(t), port = f.continue(), currentHead = f.git.head();
  try {
    const result = await port.resolve(f.selected.input, f.selected.review, async () => {});
    assert.deepEqual(await port.resolve(f.selected.input, f.selected.review, async () => {}), result);
    assert.equal(result.expectedHead, currentHead); assert.notEqual(currentHead, f.targetRevision);
    assert.equal(result.amendment!.target.revision, f.targetRevision); assert.equal(result.amendment!.proposalId, f.proposalId);
    assert.equal(result.previousBundleDigest, f.parent.manifestDigest); assert.equal(result.amendment!.parentProposalDigest, f.parent.pointerDigest);
    assert.equal(result.proposalContinuity!.targetSurfaceDigest, result.proposalContinuity!.reviewedSurfaceDigest);
    assert.notEqual(result.proposalContinuity!.targetRootTreeSha, result.proposalContinuity!.reviewedRootTreeSha);
    const preview = await describeCandidateSavePreview(f.selected.input, f.selected.review, f.f.content.documents, f.f.lineage, result, 'app:synthetic');
    const plan = await planCandidateBundle({ ...preview.submission.bundle, operationId: randomUUID() }, preview.submission.confirmation);
    assert.equal(plan.files.length, 6); assert.equal(preview.output.manifest.target!.revision, f.targetRevision);
    assert.ok(plan.files.every(v => ![`${f.root}/BRIEF.md`, `${f.root}/SPEC.md`, `${f.root}/EXAM.md`].includes(v.path)));
    // Direct owned native fixture commit, not provider write authorization.
    f.git.add(plan.files.map(({ path, content }) => ({ path, content })));
    const next = f.select(), again = await port.resolve(next.input, next.review, async () => {});
    assert.equal(again.amendment!.target.revision, f.targetRevision); assert.equal(again.previousBundleDigest, plan.manifestDigest);
    assert.equal(again.amendment!.parentProposalDigest, plan.pointerDigest); assert.notEqual(again.expectedHead, currentHead);
    assert.equal(f.git.git(['show', `${f.git.head()}:${f.root}/SPEC.md`]), 'Canonical Spec: keep unchanged');
    assert.equal(f.git.mutations(), 0); assert.equal(f.git.approvals(), 0);
  } finally { port.close(); }
});
test('native amendment continuation rejects changed Spec, Exam, gates and hidden item content even when Brief is identical', async t => {
  for (const path of ['SPEC.md', 'EXAM.md', 'gates/GATE-1.md', '.policy']) {
    const f = await amendmentFixture(t);
    f.git.add([{ path: `${f.root}/${path}`, content: 'Changed target state' }]); const selected = f.select(), port = f.continue();
    try { await assert.rejects(port.resolve(selected.input, selected.review, async () => {})); assert.equal(f.state.proofs, 0); assert.equal(f.git.mutations(), 0); }
    finally { port.close(); }
  }
});
test('proposal continuation denies nonregular and oversized comparison surfaces and missing historical inventory', async t => {
  for (const mode of ['120000', '100755']) {
    const f = await amendmentFixture(t); f.git.add([{ path: `${f.root}/policy.txt`, content: 'unsupported', mode }]);
    const selected = f.select(), port = f.continue(); try { await assert.rejects(port.resolve(selected.input, selected.review, async () => {})); } finally { port.close(); }
  }
  const f = await amendmentFixture(t), unavailable = f.continue({ ...f.native, readScopeInventory: async revision => {
    if (revision === f.targetRevision) throw new Error('PRIVATE historical inventory'); return f.native.readScopeInventory(revision);
  } });
  try { await assert.rejects(unavailable.resolve(f.selected.input, f.selected.review, async () => {}), error => { assert.doesNotMatch(String(error), /PRIVATE/); return true; }); } finally { unavailable.close(); }
  f.git.add(Array.from({ length: 129 }, (_, i) => ({ path: `${f.root}/files/${i}.md`, content: 'bounded' })));
  const selected = f.select(), huge = f.continue(); try { await assert.rejects(huge.resolve(selected.input, selected.review, async () => {})); } finally { huge.close(); }
});
test('original and current canonical source permissions are mandatory without reading their bodies into the preview', async t => {
  const f = await amendmentFixture(t);
  for (const revision of [f.targetRevision, f.git.head()]) {
    const port = f.continue(f.native, { authorizeSource: async reference => {
      if (reference.revision === revision && reference.path === `${f.root}/SPEC.md`) throw new Error('PRIVATE canonical scope denial');
    } });
    try { await assert.rejects(port.resolve(f.selected.input, f.selected.review, async () => {})); } finally { port.close(); }
  }
  const port = f.continue(); try {
    const result = await port.resolve(f.selected.input, f.selected.review, async () => {});
    assert.doesNotMatch(JSON.stringify(result), /Canonical Spec|Canonical Exam|Candidate Exam/);
  } finally { port.close(); }
});
test('continuation needs its own current eligibility and exact continuity context in both policy samples', async t => {
  const f = await amendmentFixture(t);
  for (const patch of [{ lifecycle: 'candidate-not-pulled' }, { proposalContinuation: undefined }, { proposalContinuity: undefined },
    { relationship: { itemId: '0002-related', revision: f.targetRevision } }]) {
    const port = f.continue(f.native, { verify: async (...args) => ({ ...await f.verify(...args) as object, ...patch }) });
    try { await assert.rejects(port.resolve(f.selected.input, f.selected.review, async () => {})); } finally { port.close(); }
  }
  let calls = 0;
  const late = f.continue(f.native, { verify: async (...args) => ({ ...await f.verify(...args) as object,
    ...(++calls === 2 ? { proposalContinuation: undefined } : {}) }) });
  try { await assert.rejects(late.resolve(f.selected.input, f.selected.review, async () => {})); assert.equal(calls, 2); } finally { late.close(); }
});
test('current review and selected proposal remain bound while unrelated repository changes require a fresh review and policy', async t => {
  const f = await amendmentFixture(t), port = f.continue();
  try {
    f.git.add([{ path: 'unrelated.md', content: 'Requires a new current scope review' }]);
    await assert.rejects(port.resolve(f.selected.input, f.selected.review, async () => {}));
    const selected = f.select(), result = await port.resolve(selected.input, selected.review, async () => {});
    assert.equal(result.expectedHead, f.git.head()); assert.equal(result.amendment!.target.revision, f.targetRevision);
    const denied = f.continue(f.native, { verify: async () => { throw new Error('Changed external policy invalidates target eligibility'); } });
    try { await assert.rejects(denied.resolve(selected.input, selected.review, async () => {})); } finally { denied.close(); }
  } finally { port.close(); }
});
test('human-only HTTP package preview composes native proposal continuity with a synthetic final review and lineage', async t => {
  const f = await amendmentFixture(t), port = f.continue();
  const principal = { organizationId: f.config.organizationId, subject: f.config.subject, type: 'human', hats: [],
    toolGrants: ['intent.candidate.save.preview'], expiresAt: new Date(Date.now()+60000).toISOString() };
  const app = createApi({ authenticate: async () => principal, services: { candidateSavePreviewer: { scope: port.scope,
    preview: async (input, current) => (await describeCandidateSavePreview(input, f.selected.review, f.f.content.documents, f.f.lineage,
      await port.resolve(input, f.selected.review, current), 'app:synthetic')).output } } });
  const post = () => app.request('/v1/tools/intent.candidate.save.preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f.selected.input) });
  try {
    const response = await post(); assert.equal(response.status, 200, await response.clone().text()); assert.equal(response.headers.get('cache-control'), 'no-store');
    const result = await response.json(); assert.equal(result.destination.proposalContinuity.targetRevision, f.targetRevision);
    assert.equal(result.review.expectedHead, f.git.head()); assert.equal(result.savedToGit, false); assert.equal(result.gateSigned, false);
    principal.type = 'agent'; assert.equal((await post()).status, 403);
    principal.type = 'human'; principal.toolGrants = []; assert.equal((await post()).status, 403);
    assert.equal(f.git.mutations(), 0);
  } finally { port.close(); }
});
