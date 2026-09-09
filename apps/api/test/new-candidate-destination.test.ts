import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { createGitHubReader, type CorpusRepositoryReader } from '@steer/adapters/github';
import type { NewCandidateDestinationAuthority } from '@steer/adapters/new-candidate-destination';
import { candidateSaveReviewOutputSchema } from '@steer/tool-registry/candidate-save-review-contracts';
import { describeCandidateSavePreview } from '@steer/tool-registry/candidate-save-preview-contracts';
import { createVerifiedNewCandidateDestination } from '../src/runtime.ts';
import { candidateSavePreviewFixture } from '../../../packages/tool-registry/test/candidate-save-preview.fixture.ts';
import { fixture, binding, now } from '../../../packages/adapters/test/github-brief-fixture.ts';

const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const targetPath = 'items/0002-related/BRIEF.md', targetText = '# Related source\n\nExact café 🌸 and فارسی.\n';
async function setup(t: { after(run: () => void): void }, linked = false) {
  const f = await candidateSavePreviewFixture(), git = fixture(t);
  if (linked) git.add([{ path: targetPath, content: targetText }]);
  const target = { path: targetPath, revision: git.head(), contentDigest: createHash('sha256').update(targetText).digest('hex') };
  const choice = linked ? { action: 'new-linked', reason: 'Separate work with an explicit relationship.', target } : f.previewInput.choice;
  const bindReview = (patch: Record<string, unknown> = {}) => {
    const { reviewDigest: _, ...body } = candidateSaveReviewOutputSchema.parse({ ...f.output, branch: binding.branch, expectedHead: git.head(), choice, ...patch });
    return candidateSaveReviewOutputSchema.parse({ ...body, reviewDigest: hash(['steer-final-save-review/v1', body]) });
  };
  const review = bindReview(), input = { ...f.previewInput, choice: review.choice, reviewDigest: review.reviewDigest };
  const config = { ...f.scope, branch: binding.branch, itemIds: [input.itemId, '0002-related'] };
  const native = createGitHubReader(binding, { appJwt: async () => 'synthetic-app-jwt', fetch: git.transport, now: () => now });
  const state = { proofs: 0, sources: [] as string[], grants: 0 };
  const authority: NewCandidateDestinationAuthority = {
    authorize: async selected => { state.grants++; assert.equal(selected.itemId, input.itemId); },
    authorizeSource: async ref => { state.sources.push(ref.path); assert.equal(ref.subject, config.subject); assert.equal(ref.revision, review.expectedHead); },
    verify: async context => { state.proofs++; return { ...context, kind: 'steer-new-candidate-destination-authority/v1', lifecycle: 'absent-item',
      permissionsRevision: 'synthetic-current-grants', evidenceDigest: 'e'.repeat(64), evaluatedAt: new Date().toISOString(), validThrough: new Date(Date.now()+60000).toISOString() }; },
  };
  const make = (reader: CorpusRepositoryReader = native, overrides: Partial<NewCandidateDestinationAuthority> = {}) => createVerifiedNewCandidateDestination(reader, config, { ...authority, ...overrides });
  return { f, git, target, input, review, bindReview, config, native, authority, state, make };
}
test('native Git new-candidate destination composes reproducibly with exact package preview without writes or implicit authority', async t => {
  const f = await setup(t), port = f.make();
  try {
    const first = await port.resolve(f.input, f.review, async () => {}), second = await port.resolve(f.input, f.review, async () => {});
    assert.deepEqual(first, second); assert.equal(first.purpose, 'new-candidate'); assert.equal(first.lifecycle, 'absent-item');
    assert.equal(first.expectedHead, f.git.head()); assert.equal(first.relationship, null); assert.equal(first.previousBundleDigest, null); assert.equal(first.amendment, null);
    assert.equal(f.state.proofs, 4); assert.deepEqual(f.state.sources, []);
    const planned = await describeCandidateSavePreview(f.input, f.review, f.f.content.documents, f.f.lineage, first, 'app:synthetic');
    assert.equal(planned.output.saveConfirmed, false); assert.equal(planned.output.savedToGit, false); assert.equal(planned.output.gateSigned, false);
    assert.equal(planned.output.destination.authorityDigest, first.authorityDigest); assert.equal(f.git.mutations(), 0); assert.equal(f.git.approvals(), 0);
    assert.ok(f.git.calls.every(c => c.method === 'GET' || c.path === '/app/installations/1/access_tokens'));
    assert.doesNotMatch(JSON.stringify(first), /originalText|documents|instructions|synthetic-current-grants/);
  } finally { port.close(); }
});
test('native Git linked destination verifies the exact current Brief and preserves only its reviewed relationship', async t => {
  const f = await setup(t, true), port = f.make();
  try {
    const result = await port.resolve(f.input, f.review, async () => {}); assert.deepEqual(result.relationship, { itemId: '0002-related', revision: f.git.head() });
    assert.equal(f.state.sources.length, 4); assert.ok(f.state.sources.every(p => p === targetPath));
    const planned = await describeCandidateSavePreview(f.input, f.review, f.f.content.documents, f.f.lineage, result, 'app:synthetic');
    assert.deepEqual(planned.output.manifest.relationship, result.relationship); assert.equal(f.git.mutations(), 0);
    const changed = f.bindReview({ choice: { ...f.review.choice, target: { ...f.target, contentDigest: 'f'.repeat(64) } } });
    await assert.rejects(port.resolve({ ...f.input, choice: changed.choice, reviewDigest: changed.reviewDigest }, changed, async () => {}));
  } finally { port.close(); }
});
test('a discovered linked source outside the governed item allowlist cannot authorize a new destination', async t => {
  const f = await setup(t, true);
  const port = createVerifiedNewCandidateDestination(f.native, { ...f.config, itemIds: [f.input.itemId] }, f.authority);
  try {
    await assert.rejects(port.resolve(f.input, f.review, async () => {}), /unavailable/);
    assert.deepEqual(f.state.sources, []); assert.equal(f.state.proofs, 0);
    assert.equal(f.git.mutations(), 0); assert.equal(f.git.approvals(), 0);
  } finally { port.close(); }
});
test('new destination rejects existing-item and amendment requests rather than inferring a lifecycle from filenames', async t => {
  const f = await setup(t, true), port = f.make();
  try {
    for (const input of [{ ...f.input, proposalId: randomUUID() }, { ...f.input, itemId: '0002-related' },
      { ...f.input, choice: { action: 'extend-existing', reason: 'A correction.', target: f.target } }])
      await assert.rejects(port.resolve(input as typeof f.input, f.review, async () => {}));
    assert.equal(f.state.proofs, 0);
    f.git.add([{ path: `items/${f.input.itemId}/README.md`, content: 'Existing item content' }]);
    const review = f.bindReview({ choice: { action: 'new-distinct', reason: 'Separate proposal' } });
    await assert.rejects(port.resolve({ ...f.input, choice: review.choice, reviewDigest: review.reviewDigest }, review, async () => {}));
    assert.equal(f.state.proofs, 0); assert.equal(f.git.mutations(), 0);
  } finally { port.close(); }
});
test('new destination requires current grants, configured scope and independent evidence before releasing a destination', async t => {
  const f = await setup(t), denied = f.make(f.native, { authorize: async () => { throw new Error('PRIVATE grant'); } });
  try { await assert.rejects(denied.resolve(f.input, f.review, async () => {}), /unavailable/); assert.equal(f.git.calls.length, 0); }
  finally { denied.close(); }
  const port = f.make(); try {
    for (const patch of [{ subject: 'caller' }, { itemId: '9999-foreign' }, { configurationRevision: 'caller' }, { organizationId: 'foreign' }])
      await assert.rejects(port.resolve({ ...f.input, ...patch }, f.review, async () => {}));
    assert.equal(f.git.calls.length, 0);
    await assert.rejects(port.resolve(f.input, { ...f.review, subject: 'foreign' }, async () => {}));
    const missing = f.make(f.native, { verify: async () => null }); try { await assert.rejects(missing.resolve(f.input, f.review, async () => {})); } finally { missing.close(); }
    assert.throws(() => createVerifiedNewCandidateDestination(f.native, f.config, { ...f.authority, verify: undefined } as unknown as NewCandidateDestinationAuthority));
  } finally { port.close(); }
});
test('new destination rejects malformed inventory, symlink or executable targets, forged bytes and stale target revisions', async t => {
  const f = await setup(t, true), inventory = await f.native.readScopeInventory(f.git.head());
  const patches = [{ repositoryId: 99 }, { entries: [...inventory.entries, inventory.entries[0]] },
    { entries: inventory.entries.filter(e => e.path !== 'items') },
    ...['120000', '100755'].map(mode => ({ entries: inventory.entries.map(e => e.path === targetPath ? { ...e, mode } : e) }))];
  for (const patch of patches) {
    const port = f.make({ ...f.native, readScopeInventory: async () => ({ ...inventory, ...patch }) } as CorpusRepositoryReader);
    try { await assert.rejects(port.resolve(f.input, f.review, async () => {})); } finally { port.close(); }
  }
  const port = f.make({ ...f.native, readArtifact: async (...args) => ({ ...await f.native.readArtifact(...args), content: 'forged' }) });
  try { await assert.rejects(port.resolve(f.input, f.review, async () => {})); } finally { port.close(); }
  const stale = f.bindReview({ choice: { ...f.review.choice, target: { ...f.target, revision: 'f'.repeat(40) } } });
  const normal = f.make(); try { await assert.rejects(normal.resolve({ ...f.input, choice: stale.choice, reviewDigest: stale.reviewDigest }, stale, async () => {})); } finally { normal.close(); }
});
test('new destination evidence rejects wrong context, expired or overlong windows, changed proof and late source denial', async t => {
  const f = await setup(t, true);
  for (const patch of [{ itemId: '9999-foreign' }, { requestDigest: 'a'.repeat(64) }, { relationship: null }, { lifecycle: 'candidate-not-pulled' },
    { evaluatedAt: new Date(Date.now()+300000).toISOString() }, { validThrough: new Date(0).toISOString() },
    { validThrough: new Date(Date.now()+600000).toISOString() }, { executionAuthorized: true }]) {
    const port = f.make(f.native, { verify: async (...args) => ({ ...await f.authority.verify(...args) as object, ...patch }) });
    try { await assert.rejects(port.resolve(f.input, f.review, async () => {})); } finally { port.close(); }
  }
  let calls = 0;
  const changing = f.make(f.native, { verify: async (...args) => ({ ...await f.authority.verify(...args) as object, evidenceDigest: (++calls === 1 ? 'a' : 'b').repeat(64) }) });
  try { await assert.rejects(changing.resolve(f.input, f.review, async () => {})); assert.equal(calls, 2); } finally { changing.close(); }
  for (const denial of [3, 4]) {
    let sources = 0; const port = f.make(f.native, { authorizeSource: async () => { if (++sources === denial) throw new Error('PRIVATE source'); } });
    try { await assert.rejects(port.resolve(f.input, f.review, async () => {}), e => { assert.doesNotMatch(String(e), /PRIVATE/); return true; }); } finally { port.close(); }
  }
});
test('new destination withholds a moved branch before or during final lifecycle verification', async t => {
  for (const move of ['before', 'first-proof', 'final-proof']) {
    const f = await setup(t); let calls = 0;
    const port = f.make(f.native, { verify: async (...args) => { calls++; if ((move === 'first-proof' && calls === 1) || (move === 'final-proof' && calls === 2)) f.git.add([{ path: 'unrelated.md', content: move }]); return f.authority.verify(...args); } });
    try { if (move === 'before') f.git.add([{ path: 'unrelated.md', content: move }]);
      await assert.rejects(port.resolve(f.input, f.review, async () => {})); assert.equal(f.git.mutations(), 0);
    } finally { port.close(); }
  }
});
test('new destination refuses expired evidence after late head I/O and final identity loss', async t => {
  const f = await setup(t); let heads = 0;
  const slow = f.make({ ...f.native, readHead: async () => { if (++heads === 3) await new Promise(r => setTimeout(r, 2100)); return f.native.readHead(); } },
    { verify: async (...args) => ({ ...await f.authority.verify(...args) as object, validThrough: new Date(Date.now()+2000).toISOString() }) });
  try { await assert.rejects(slow.resolve(f.input, f.review, async () => {})); assert.equal(heads, 3); } finally { slow.close(); }
  let revoked = false, checks = 0;
  const port = f.make(f.native, { verify: async (...args) => { if (++checks === 2) revoked = true; return f.authority.verify(...args); } });
  try { await assert.rejects(port.resolve(f.input, f.review, async () => { if (revoked) throw new Error('PRIVATE identity'); })); assert.equal(checks, 2); }
  finally { port.close(); }
});
test('new destination close keeps pending inventory admission bounded and never releases late results', async t => {
  const f = await setup(t); let reads = 0, release!: () => void;
  const pending = new Promise<void>(r => { release = r; }), port = f.make({ ...f.native, readScopeInventory: async (...args) => { reads++; await pending; return f.native.readScopeInventory(...args); } });
  const jobs = Array.from({ length: 4 }, () => assert.rejects(port.resolve(f.input, f.review, async () => {})));
  for (let i = 0; i < 100 && reads < 4; i++) await new Promise(r => setImmediate(r));
  assert.equal(reads, 4); await assert.rejects(port.resolve(f.input, f.review, async () => {}));
  port.close(); await Promise.all(jobs); release(); await new Promise(r => setImmediate(r));
  assert.equal(reads, 4); await assert.rejects(port.resolve(f.input, f.review, async () => {}));
});
