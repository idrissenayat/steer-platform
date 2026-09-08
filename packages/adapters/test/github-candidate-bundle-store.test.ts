import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { candidateBundleInputSchema, planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import { createGitHubCandidateBundleStore, type CandidateBundleSaveRequest } from '../src/code-host/github-candidate-bundle-store.ts';
import { createCandidateBundleReader } from '../src/code-host/candidate-bundle-reader.ts';
import { createGitHubReader } from '../src/code-host/github.ts';
import { fixture, binding, now, type Override } from './github-brief-fixture.ts';

const settings = { organizationId: 'org', productId: 'product', repository: 'github:52', branch: binding.branch,
  itemIds: ['0007-booking', '0008-related'], serviceCommitter: 'app:123', platformRevision: 'b'.repeat(40), gate2DecisionDigest: 'c'.repeat(64) };
const documents = { brief: '\ufeff# Brief\r\nفارسی 🌸\n', spec: '# Spec\nAC-01\n', exam: '# Exam\nNOT RUN\n' };
function setup(t: { after(run: () => void): void }) {
  const git = fixture(t, 'candidate-bundle');
  const consumed = new Set<string>(); // Synthetic dispatch port, NOT a durable production implementation.
  async function request(changes: Partial<CandidateBundleSaveRequest['bundle']> = {}): Promise<CandidateBundleSaveRequest> {
    const bundle = candidateBundleInputSchema.parse({
      organizationId: settings.organizationId, productId: settings.productId, repository: settings.repository, branch: settings.branch,
      itemId: settings.itemIds[0], serviceCommitter: settings.serviceCommitter, bundleId: randomUUID(), operationId: randomUUID(),
      purpose: 'new-candidate', previousBundleDigest: null, amendment: null, relationship: null,
      originatorSubject: 'synthetic-human', architectConfigurationRevision: 'architect-r1', examConfigurationRevision: 'exam-r1',
      editedDocuments: [], scopeInputDigest: 'a'.repeat(64), sourceSnapshotDigest: 'b'.repeat(64),
      assessmentDigest: 'c'.repeat(64), dispositionDigest: 'd'.repeat(64), specConformance: 'unreviewed', examReview: 'unreviewed',
      expectedHead: git.head(), documents, ...changes,
    });
    const plan = await planCandidateBundle(bundle);
    return { bundle, confirmation: { kind: 'steer-intent-save-binding/v1', organizationId: bundle.organizationId,
      productId: bundle.productId, subject: bundle.originatorSubject, draftId: randomUUID(), draftRevision: 1,
      scopeInputDigest: bundle.scopeInputDigest, sourceSnapshotDigest: bundle.sourceSnapshotDigest,
      assessmentDigest: bundle.assessmentDigest, dispositionDigest: bundle.dispositionDigest, bundleManifestDigest: plan.manifestDigest,
      repository: bundle.repository, branch: bundle.branch, item: `items/${bundle.itemId}`, expectedHead: bundle.expectedHead } };
  }
  const make = (options: { proof?: (proof: Record<string, unknown>) => unknown; authorizeRead?: () => Promise<void>;
    claim?: () => Promise<void>; fetch?: typeof globalThis.fetch; appJwt?: () => Promise<string> } = {}) =>
    createGitHubCandidateBundleStore(binding, settings, { fetch: options.fetch ?? git.transport,
      appJwt: options.appJwt ?? (async () => 'synthetic-app-jwt'), now: () => now,
      authorizeRead: options.authorizeRead ?? (async () => {}), authorizeAndClaimDispatch: async p => {
        assert.ok(Object.isFrozen(p.request.bundle.documents)); assert.ok(Object.isFrozen(p.plan.files));
        if (consumed.has(p.request.bundle.operationId)) throw new Error('Synthetic dispatch permit already consumed');
        consumed.add(p.request.bundle.operationId);
        await options.claim?.();
        git.recordSyntheticApproval();
        const proof = { kind: 'steer-candidate-bundle-dispatch-proof/v1', operationId: p.request.bundle.operationId,
          inputDigest: p.plan.inputDigest, currentBinding: p.request.confirmation,
          authorizationRevision: p.plan.expectedHead, sourceReviewRevision: p.plan.expectedHead, lifecycleRevision: p.plan.expectedHead,
          lifecycle: p.plan.requiredLifecycle, platformRevision: settings.platformRevision, gate2DecisionDigest: settings.gate2DecisionDigest,
          evaluatedAt: now.toISOString(), validThrough: new Date(now.getTime() + 5000).toISOString() };
        return options.proof ? options.proof(proof) : proof;
      } });
  return { git, request, make, consumed };
}

test('new candidate atomically records seven exact files and reopens through the existing reader', async t => {
  const f = setup(t), request = await f.request(), plan = await planCandidateBundle(request.bundle, request.confirmation);
  assert.equal((await f.make().inspect(request)).outcome, 'not-found');
  const result = await f.make().compareAndWrite(request);
  assert.equal(result.outcome, 'committed');
  if (result.outcome !== 'committed') return;
  assert.equal(result.revision, f.git.head()); assert.equal(result.manifestDigest, plan.manifestDigest);
  assert.equal(result.gateSigned, false); assert.equal(result.executionAuthorized, false); assert.equal(result.retryAuthorized, false);
  assert.deepEqual(f.git.git(['diff-tree', '--no-commit-id', '--name-only', '-r', result.revision]).split('\n'), plan.files.map(v => v.path).sort());
  const reader = createGitHubReader(binding, { fetch: f.git.transport, appJwt: async () => 'synthetic-app-jwt', now: () => now });
  const bundleReader = createCandidateBundleReader(reader, { organizationId: settings.organizationId, productId: settings.productId,
    repository: settings.repository, branch: settings.branch, itemIds: settings.itemIds }, async () => {});
  const saved = await bundleReader.readPointer({ organizationId: settings.organizationId, productId: settings.productId,
    repository: settings.repository, branch: settings.branch, itemId: request.bundle.itemId, proposalId: null, revision: result.revision });
  assert.deepEqual(saved.documents, documents);
  assert.deepEqual(await f.make().inspect(request), result);
  assert.deepEqual(await f.make().compareAndWrite(request), result);
  assert.equal(f.git.mutations(), 1); assert.equal(f.consumed.size, 1);
});

test('pre-pull revision moves only root Brief and candidate pointer with an immutable new bundle', async t => {
  const f = setup(t), original = await f.request(), plan = await planCandidateBundle(original.bundle, original.confirmation);
  const first = await f.make().compareAndWrite(original); assert.equal(first.outcome, 'committed');
  const next = await f.request({ purpose: 'candidate-revision', previousBundleDigest: plan.manifestDigest,
    editedDocuments: ['brief'], specConformance: 'stale', examReview: 'stale', documents: { ...documents, brief: '# Edited Brief\n' } });
  const result = await f.make().compareAndWrite(next); assert.equal(result.outcome, 'committed');
  assert.equal(f.git.git(['show', `${f.git.head()}:items/0007-booking/BRIEF.md`]), '# Edited Brief');
  assert.equal(f.git.git(['show', `${f.git.head()}:items/0007-booking/candidates/${original.bundle.bundleId}/BRIEF.md`]), documents.brief.trimEnd());
  assert.deepEqual(await f.make().inspect(original), first);
  assert.equal(f.git.mutations(), 2);
});

test('amendments and proposal corrections each write six files and preserve every canonical artifact', async t => {
  const f = setup(t);
  const canonical = ['BRIEF', 'SPEC', 'EXAM'].map(name => ({ path: `items/0007-booking/${name}.md`, content: `Canonical ${name}\n` }));
  const targetRevision = f.git.add(canonical), proposalId = randomUUID();
  const original = await f.request({ purpose: 'amendment', amendment: { proposalId,
    target: { itemId: '0007-booking', revision: targetRevision }, parentProposalDigest: null } });
  const plan = await planCandidateBundle(original.bundle, original.confirmation);
  assert.equal((await f.make().compareAndWrite(original)).outcome, 'committed');
  const next = await f.request({ purpose: 'amendment', previousBundleDigest: plan.manifestDigest,
    amendment: { ...original.bundle.amendment!, parentProposalDigest: plan.pointerDigest },
    documents: { ...documents, exam: '# Corrected candidate Exam\n' }, editedDocuments: ['exam'], examReview: 'stale' });
  assert.equal((await f.make().compareAndWrite(next)).outcome, 'committed');
  for (const file of canonical) assert.equal(f.git.git(['show', `${f.git.head()}:${file.path}`]), file.content.trimEnd());
  assert.equal(f.git.git(['diff-tree', '--no-commit-id', '--name-only', '-r', f.git.head()]).split('\n').length, 6);
  assert.equal((await f.make().inspect(original)).outcome, 'committed');
});

test('lost response recovers only the original receipt, with no second mutation or dispatch claim', async t => {
  const f = setup(t), request = await f.request(), store = f.make(); f.git.loseAck();
  assert.equal((await store.compareAndWrite(request)).outcome, 'unknown');
  const result = await f.make().inspect(request); assert.equal(result.outcome, 'committed');
  assert.deepEqual(await store.compareAndWrite(request), result);
  assert.deepEqual(await f.make().compareAndWrite(request), result); assert.equal(f.git.mutations(), 1); assert.equal(f.consumed.size, 1);
});

test('separate candidates at one source head race through native CAS; only one participating save commits', async t => {
  const f = setup(t), first = await f.request(), second = await f.request({ itemId: '0008-related' });
  const result = await Promise.all([f.make().compareAndWrite(first), f.make().compareAndWrite(second)]);
  assert.equal(result.filter(r => r.outcome === 'committed').length, 1);
  assert.ok(result.every(r => ['committed', 'unknown', 'conflict'].includes(r.outcome)));
  assert.equal(f.git.git(['rev-list', '--count', `${first.bundle.expectedHead}..${f.git.head()}`]), '1');
});

test('head race, provider rejection and uncertain dispatch permit cannot cause a blind retry', async t => {
  for (const mode of ['race', 'deny', 'claim'] as const) {
    const f = setup(t), request = await f.request();
    if (mode === 'race') f.git.race(); else if (mode === 'deny') f.git.deny();
    const store = f.make(mode === 'claim' ? { claim: async () => { throw new Error('lost permit acknowledgement'); } } : {});
    assert.equal((await store.compareAndWrite(request)).outcome, 'unknown');
    const writes = f.git.mutations();
    const status = await store.compareAndWrite(request); assert.equal(status.outcome, 'unknown'); assert.equal(status.retryAuthorized, false);
    await f.make().compareAndWrite(request); // Synthetic shared claim ledger refuses a second dispatch after restart.
    assert.equal(f.git.mutations(), writes); assert.equal(f.consumed.size, 1);
  }
});

test('operation ID reuse with different content, source head or bundle conflicts', async t => {
  const f = setup(t), original = await f.request(); assert.equal((await f.make().compareAndWrite(original)).outcome, 'committed');
  for (const patch of [{ documents: { ...documents, brief: '# Different\n' } }, { expectedHead: f.git.head() }, { bundleId: randomUUID() }]) {
    const changed = await f.request({ ...original.bundle, ...patch });
    assert.equal((await f.make().compareAndWrite(changed)).outcome, 'conflict');
  }
  assert.equal(f.git.mutations(), 1);
  for (const patch of [{ draftId: randomUUID() }, { draftRevision: 2 }]) {
    const changed = { ...original, confirmation: { ...original.confirmation, ...patch } };
    assert.equal((await f.make().inspect(changed)).outcome, 'conflict');
    assert.equal((await f.make().compareAndWrite(changed)).outcome, 'conflict');
  }
  assert.equal(f.git.mutations(), 1);
});

test('stale consent and caller-controlled paths, scope or authority reject before provider calls', async t => {
  const f = setup(t), request = await f.request();
  for (const patch of [{ bundleManifestDigest: '0'.repeat(64) }, { subject: 'someone-else' }, { assessmentDigest: '0'.repeat(64) },
    { dispositionDigest: '0'.repeat(64) }, { scopeInputDigest: '0'.repeat(64) }, { expectedHead: '0'.repeat(40) }, { authorized: true }])
    await assert.rejects(f.make().compareAndWrite({ ...request, confirmation: { ...request.confirmation, ...patch } }));
  for (const patch of [{ itemId: '../EXAM.md' }, { itemId: '0007-booking\n' }, { bundleId: '../../intent/0001' },
    { operationId: request.bundle.operationId + '\n' }, { branch: 'other' }, { productId: 'other' }, { repository: 'github:99' },
    { serviceCommitter: 'human' }, { expectedHead: request.bundle.expectedHead + '\n' }, { files: [{ path: 'intent/0001/EXAM.md' }] },
    { documents: { ...documents, brief: '\ud800' } }, { examReview: 'approved' }])
    await assert.rejects(f.make().compareAndWrite({ ...request, bundle: { ...request.bundle, ...patch } }));
  assert.equal(f.git.calls.length, 0);
});

test('current identity, scope, lifecycle, source revision, draft revision and gate proof are required at dispatch', async t => {
  for (const patch of [{ sourceReviewRevision: '0'.repeat(40) }, { lifecycleRevision: '0'.repeat(40) }, { lifecycle: 'candidate-not-pulled' },
    { authorizationRevision: '0'.repeat(40) }, { platformRevision: '0'.repeat(40) }, { gate2DecisionDigest: '0'.repeat(64) },
    { inputDigest: '0'.repeat(64) }, { operationId: randomUUID() }, { evaluatedAt: new Date(now.getTime() - 6000).toISOString() },
    { evaluatedAt: new Date(now.getTime() + 1).toISOString() }, { validThrough: now.toISOString() },
    { validThrough: new Date(now.getTime() + 31000).toISOString() }]) {
    const f = setup(t), request = await f.request();
    assert.equal((await f.make({ proof: proof => ({ ...proof, ...patch }) }).compareAndWrite(request)).outcome, 'unknown');
    assert.equal(f.git.mutations(), 0);
  }
  for (const patch of [{ subject: 'other' }, { draftRevision: 2 }, { sourceSnapshotDigest: '0'.repeat(64) }, { dispositionDigest: '0'.repeat(64) }]) {
    const f = setup(t), request = await f.request();
    assert.equal((await f.make({ proof: proof => ({ ...proof, currentBinding: { ...request.confirmation, ...patch } }) }).compareAndWrite(request)).outcome, 'unknown');
    assert.equal(f.git.mutations(), 0);
  }
});

test('existing namespaces, symlink ancestors and stale predecessor pointers never overwrite existing scope', async t => {
  for (const entry of [{ path: 'items/0007-booking/EXAM.md', content: 'canonical' },
    { path: 'items', content: 'target', mode: '120000' }, { path: '.steer/authoring', content: 'target', mode: '120000' }]) {
    const f = setup(t); f.git.add([entry]); const request = await f.request();
    // A non-directory receipt ancestor prevents even authoritative absence.
    assert.equal((await f.make().compareAndWrite(request)).outcome, entry.path.startsWith('.steer') ? 'unknown' : 'conflict');
    assert.equal(f.git.mutations(), 0);
  }
  const f = setup(t), original = await f.request(); await f.make().compareAndWrite(original);
  const stale = await f.request({ purpose: 'candidate-revision', previousBundleDigest: '0'.repeat(64) });
  assert.equal((await f.make().compareAndWrite(stale)).outcome, 'conflict'); assert.equal(f.git.mutations(), 1);
});

test('bad provider tokens, missing/truncated/contradictory tree data and moving heads never authorize a write', async t => {
  for (const override of [
    ((url, _init, value) => url.pathname.endsWith('access_tokens') ? { ...(value as object), permissions: { contents: 'write', administration: 'write' } } : value),
    ((url, _init, value) => url.pathname.endsWith('access_tokens') ? { ...(value as object), repositories: [{ id: 99, full_name: 'foreign/repo' }] } : value),
    ((url, _init, value) => url.pathname.includes('/git/trees/') ? { ...(value as object), truncated: true } : value),
    ((url, _init, value) => url.pathname.includes('/git/ref/') ? new Response('{}', { status: 404 }) : value),
  ] satisfies Override[]) {
    const f = setup(t), request = await f.request(); f.git.override(override);
    assert.equal((await f.make().compareAndWrite(request)).outcome, 'unknown'); assert.equal(f.git.mutations(), 0);
  }
  const f = setup(t), request = await f.request(); f.git.add([{ path: 'unrelated', content: 'changed' }]);
  assert.equal((await f.make().compareAndWrite(request)).outcome, 'conflict'); assert.equal(f.git.mutations(), 0);
});

test('readback verifies every changed file, exact ancestry, complete response and returned commit', async t => {
  for (const override of [
    ((url, _init, value) => url.pathname.includes('/git/blobs/') ? { ...(value as object), content: Buffer.from('corrupt').toString('base64') } : value),
    ((url, _init, value) => url.pathname === '/graphql' ? { ...(value as object), errors: [{ message: 'partial failure' }] } : value),
    ((url, _init, value) => url.pathname === '/graphql' ? { data: { createCommitOnBranch: { commit: { oid: '0'.repeat(40) }, ref: { name: binding.branch } } } } : value),
    ((url, _init, value) => url.pathname.includes('/compare/') ? { ...(value as object), total_commits: 101 } : value),
    ((url, _init, value) => {
      if (!url.pathname.includes('/git/trees/')) return value;
      const result = value as { tree: { path: string }[] };
      return result.tree.some(e => e.path.endsWith('/CANDIDATE.json')) ? { ...result,
        tree: [...result.tree, { path: 'unexpected', type: 'blob', mode: '100644', sha: 'e'.repeat(40) }] } : value;
    }),
  ] satisfies Override[]) {
    const f = setup(t), request = await f.request(); f.git.override(override);
    assert.equal((await f.make().compareAndWrite(request)).outcome, 'unknown'); assert.equal(f.git.mutations(), 1);
  }
});

test('original receipt survives unrelated commits but marker deletion, change or recreation is not success', async t => {
  const f = setup(t), request = await f.request(), plan = await planCandidateBundle(request.bundle, request.confirmation), receipt = plan.files.at(-1)!;
  const original = await f.make().compareAndWrite(request); assert.equal(original.outcome, 'committed');
  f.git.add([{ path: 'later', content: 'unrelated' }]); assert.deepEqual(await f.make().inspect(request), original);
  f.git.add([{ path: receipt.path, content: 'tampered' }]); assert.equal((await f.make().inspect(request)).outcome, 'conflict');
  f.git.add([{ path: receipt.path, content: null }]); assert.equal((await f.make().inspect(request)).outcome, 'unknown');
  f.git.add([{ path: receipt.path, content: receipt.content }]); assert.equal((await f.make().inspect(request)).outcome, 'unknown');
});

test('authorization loss before reading or after committing withholds successful status', async t => {
  const f = setup(t), request = await f.request();
  const denied = f.make({ authorizeRead: async () => { throw new Error('PRIVATE_DENIAL'); } });
  assert.equal((await denied.inspect(request)).outcome, 'unknown'); assert.equal(f.git.calls.length, 0);
  let count = 0;
  const result = await f.make({ authorizeRead: async () => { if (++count === 3) throw new Error('revoked'); } }).compareAndWrite(request);
  assert.equal(result.outcome, 'unknown'); assert.equal(f.git.mutations(), 1);
  assert.equal((await denied.inspect(request)).outcome, 'unknown');
  assert.equal((await f.make().inspect(request)).outcome, 'committed');
});

test('single-flight admission and close suppress stalled signer work and all later dispatches', async t => {
  const f = setup(t), request = await f.request(); let entered!: () => void, release!: () => void;
  const reached = new Promise<void>(resolve => { entered = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  const store = f.make({ appJwt: async () => { calls++; entered(); await held; return 'synthetic-app-jwt'; } });
  const first = store.compareAndWrite(request); await reached;
  assert.equal((await store.inspect(request)).outcome, 'unknown'); assert.equal(calls, 1);
  store.close(); assert.equal((await first).outcome, 'unknown');
  release(); await Promise.resolve();
  assert.equal((await store.compareAndWrite(request)).outcome, 'unknown'); assert.equal(f.git.mutations(), 0); assert.equal(f.git.calls.length, 0);
});

test('maximum Unicode documents round trip without the old Brief-only byte ceiling', async t => {
  const f = setup(t), request = await f.request({ documents: { brief: '漢'.repeat(30000), spec: '語'.repeat(30000), exam: '字'.repeat(30000) } });
  assert.equal((await f.make().compareAndWrite(request)).outcome, 'committed');
  assert.equal((await f.make().inspect(request)).outcome, 'committed');
});

test('every planned artifact and ancestor must match verified readback, not just the receipt or mutation response', async t => {
  for (let index = 0; index < 7; index++) {
    const f = setup(t), request = await f.request(), plan = await planCandidateBundle(request.bundle, request.confirmation), path = plan.files[index]!.path;
    f.git.override((url, _init, value) => {
      if (!url.pathname.includes('/git/trees/')) return value;
      const result = value as { tree: { path: string; sha: string }[] };
      return { ...result, tree: result.tree.map(entry => entry.path === path ? { ...entry, sha: 'e'.repeat(40) } : entry) };
    });
    assert.equal((await f.make().compareAndWrite(request)).outcome, 'unknown'); assert.equal(f.git.mutations(), 1);
  }
  const f = setup(t), request = await f.request();
  f.git.override((url, _init, value) => {
    if (!url.pathname.includes('/git/trees/')) return value;
    return { ...(value as object), tree: [{ path: 'items/0007-booking/hidden', type: 'blob', mode: '100644', sha: 'e'.repeat(40) }] };
  });
  assert.equal((await f.make().compareAndWrite(request)).outcome, 'unknown'); assert.equal(f.git.mutations(), 0);
});

test('candidate root drift, corrupt prior bundle and non-regular pointer block correction', async t => {
  for (const target of ['brief', 'exam', 'pointer'] as const) {
    const f = setup(t), original = await f.request(), plan = await planCandidateBundle(original.bundle, original.confirmation);
    await f.make().compareAndWrite(original);
    f.git.add([{ path: target === 'brief' ? 'items/0007-booking/BRIEF.md' : target === 'pointer' ? 'items/0007-booking/CANDIDATE.json'
      : `items/0007-booking/candidates/${original.bundle.bundleId}/EXAM.md`, content: 'out of band', ...(target === 'pointer' ? { mode: '120000' } : {}) }]);
    const request = await f.request({ purpose: 'candidate-revision', previousBundleDigest: plan.manifestDigest });
    assert.ok(['unknown', 'conflict'].includes((await f.make().compareAndWrite(request)).outcome)); assert.equal(f.git.mutations(), 1);
  }
});

test('proposal correction requires both the previous pointer bytes and the original target revision', async t => {
  const f = setup(t), target = { itemId: '0007-booking', revision: f.git.add([{ path: 'items/0007-booking/BRIEF.md', content: 'Canonical\n' }]) };
  const original = await f.request({ purpose: 'amendment', amendment: { proposalId: randomUUID(), target, parentProposalDigest: null } });
  const plan = await planCandidateBundle(original.bundle, original.confirmation); await f.make().compareAndWrite(original);
  for (const amendment of [{ ...original.bundle.amendment!, parentProposalDigest: '0'.repeat(64) },
    { ...original.bundle.amendment!, parentProposalDigest: plan.pointerDigest, target: { ...target, revision: f.git.head() } }]) {
    const request = await f.request({ purpose: 'amendment', previousBundleDigest: plan.manifestDigest, amendment });
    assert.equal((await f.make().compareAndWrite(request)).outcome, 'conflict');
  }
  assert.equal(f.git.mutations(), 1);
});

test('closing an already-dispatched request cannot erase its commit or cause a replacement write', async t => {
  const f = setup(t), request = await f.request(); let entered!: () => void, release!: () => void;
  const reached = new Promise<void>(resolve => { entered = resolve; }), held = new Promise<void>(resolve => { release = resolve; });
  const store = f.make({ fetch: async (input, init) => {
    const response = await f.git.transport(input, init);
    if (String(input).endsWith('/graphql')) { entered(); await held; }
    return response;
  } });
  const task = store.compareAndWrite(request); await reached; store.close();
  assert.equal((await task).outcome, 'unknown'); release();
  assert.equal((await f.make().inspect(request)).outcome, 'committed');
  assert.equal(f.git.mutations(), 1); assert.equal(f.consumed.size, 1);
});

test('a real header timeout retains admission until the ignored-abort provider request actually drains', async t => {
  const f = setup(t), request = await f.request(); let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  const store = f.make({ fetch: async (input, init) => {
    if (++calls === 1) await held;
    return f.git.transport(input, init);
  } });
  // AbortSignal.timeout is unref'ed; keep the isolated test alive to observe it.
  const keepAlive = setInterval(() => {}, 1000); t.after(() => clearInterval(keepAlive));
  assert.equal((await store.inspect(request)).outcome, 'unknown');
  assert.equal((await store.inspect(request)).outcome, 'unknown'); assert.equal(calls, 1);
  release(); await new Promise(resolve => setImmediate(resolve));
  assert.equal((await store.inspect(request)).outcome, 'not-found'); assert.equal(f.git.mutations(), 0);
});
