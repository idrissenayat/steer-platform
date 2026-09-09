import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createIntentCorpusEvidence, type CorpusSelectionContext } from '../src/code-host/intent-corpus-evidence.ts';
import { createGitHubReader } from '../src/code-host/github.ts';
import { verifyScopeInventory } from '../src/code-host/scope-inventory.ts';
import { planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import { fixture, binding, now } from './github-brief-fixture.ts';
import { createCandidateScopeCatalog } from '../src/code-host/candidate-scope-catalog.ts';

const scope = { organizationId: 'org', productId: 'product', repository: 'github:52', branch: binding.branch };
const input = { ...scope, scopeInputDigest: 'a'.repeat(64) };
const config = { ...scope, retrievalConfigurationRevision: 'corpus-r1' };
const authorityDigest = 'd'.repeat(64);
async function setup(t: { after(run: () => void): void }) {
  const git = fixture(t), selections = new Map<string, string>(), denied = new Set<string>(); let permissionsRevision = 'p1';
  git.add([{ path: 'intent/0001/BRIEF.md', content: '# Legacy booking\nPatients book appointments.\n' },
    { path: 'intent/0001/SPEC.md', content: '# Scope\nOut of scope: billing.\n' },
    { path: 'intent/0001/EXAM.md', content: 'DO_NOT_READ_LEGACY_EXAM' },
    { path: 'items/0002-canonical/BRIEF.md', content: '# Billing\nHuman billing operations.\n' },
    { path: 'items/0002-canonical/SPEC.md', content: '# Scope\nOut of scope: booking.\n' }]);
  const reader = createGitHubReader(binding, { appJwt: async () => 'synthetic-app-jwt', fetch: git.transport, now: () => now });
  const authority = { authorize: async () => ({ permissionsRevision }),
    select: async (c: CorpusSelectionContext) => ({ ...c, selection: selections.get(c.root) ?? 'canonical', authorityDigest }),
    authorizeSource: async ({ path }: { path: string }) => { if (denied.has(path)) throw new Error('PRIVATE'); } };
  const service = createIntentCorpusEvidence(reader, config, authority); t.after(() => service.close());
  return { git, reader, authority, selections, denied, service, permissions: (v: string) => { permissionsRevision = v; } };
}
async function candidate(f: Awaited<ReturnType<typeof setup>>, purpose: 'new-candidate' | 'amendment', itemId = '0003-candidate') {
  const plan = await planCandidateBundle({ ...scope, itemId, bundleId: '57762718-d38a-4926-b96d-7a1c40fdd6f7', operationId: '51f1f1c9-a4d6-435e-9d6e-9b773b8260bb',
    purpose, previousBundleDigest: null, amendment: purpose === 'amendment' ? { proposalId: '3b3f0b5d-1697-4622-9f62-40a2aa31d7d9', target: { itemId, revision: f.git.head() }, parentProposalDigest: null } : null,
    relationship: null, originatorSubject: 'human', serviceCommitter: 'app:123', architectConfigurationRevision: 'a1', examConfigurationRevision: 't1', editedDocuments: [],
    scopeInputDigest: input.scopeInputDigest, sourceSnapshotDigest: 'b'.repeat(64), assessmentDigest: 'c'.repeat(64), dispositionDigest: 'd'.repeat(64),
    specConformance: 'unreviewed', examReview: 'unreviewed', expectedHead: f.git.head(),
    documents: { brief: '# Candidate\nNotification scope\n', spec: '# Scope\nEmail only. No SMS.\n', exam: '# Candidate Exam\nNOT RUN\n' } });
  f.git.add(plan.files.map(x => ({ path: x.path, content: x.content }))); return plan;
}
test('explicit pointer-free canonical items match full catalog bytes and retain every source grant', async t => {
  const f = await setup(t), grants: string[] = [], authorize = f.authority.authorizeSource;
  f.git.add([{ path: 'items/0002-canonical/EXAM.md', content: 'DO_NOT_READ_CANONICAL_EXAM' },
    { path: 'items/0002-canonical/notes/context.md', content: 'Not a scope artifact' }]);
  f.authority.authorizeSource = async ref => { grants.push(ref.path); await authorize(ref); };
  const result = await f.service.collect(input, async () => {});
  const catalog = createCandidateScopeCatalog(f.reader, { ...scope, itemIds: ['0002-canonical'] }, async () => {});
  try {
    const full = await catalog.collect({ ...scope, revision: result.evidence.head });
    assert.deepEqual(result.evidence.inventory.filter(x => x.targetId === 'items/0002-canonical').map(x => ({ path: x.path, digest: x.contentDigest })),
      full.documents.map(x => ({ path: x.path, digest: x.contentDigest })));
    for (const source of full.documents) assert.ok(grants.filter(path => path === source.path).length >= 3);
    assert.equal(result.evidence.inventoryComplete, true);
    assert.ok(result.evidence.inventory.filter(x => x.targetId === 'items/0002-canonical').every(x => x.status === 'canonical'));
    assert.doesNotMatch(JSON.stringify(result), /DO_NOT_READ_CANONICAL_EXAM|Not a scope artifact/);
  } finally { catalog.close(); }
});
test('plain canonical missing or nonregular documents stay incomplete with one per-root source gap', async t => {
  for (const mode of ['missing-both', 'nonregular'] as const) {
    const f = await setup(t);
    f.git.add(mode === 'missing-both' ? [
      { path: 'items/0002-canonical/BRIEF.md', content: null }, { path: 'items/0002-canonical/SPEC.md', content: null },
      { path: 'items/0002-canonical/notes.md', content: 'Preserve the item root' },
    ] : [{ path: 'items/0002-canonical/BRIEF.md', content: 'target', mode: '120000' }]);
    const result = await f.service.collect(input, async () => {});
    assert.equal(result.evidence.inventoryComplete, false); assert.equal(result.coverage.sourceGapCount, 1);
    assert.equal(result.evidence.inventory.filter(x => x.targetId === 'items/0002-canonical').length, mode === 'missing-both' ? 0 : 1);
    assert.equal(result.envelope.coverage.complete, false);
  }
});
test('candidate and malformed proposal markers cannot enter the plain canonical path', async t => {
  for (const path of ['CANDIDATE.json', 'proposals/not-a-proposal.json']) {
    const f = await setup(t); f.git.add([{ path: `items/0002-canonical/${path}`, content: '{malformed' }]);
    const result = await f.service.collect(input, async () => {});
    assert.equal(result.evidence.inventoryComplete, false); assert.ok(result.coverage.sourceGapCount > 0);
    assert.equal(result.envelope.coverage.complete, false);
  }
});
test('caller revocation during metadata selection prevents all following source IO', async t => {
  const f = await setup(t), select = f.authority.select; let allowed = true;
  f.authority.select = async context => { allowed = false; return select(context); };
  await assert.rejects(f.service.collect(input, async () => { if (!allowed) throw new Error('PRIVATE revoked caller'); }));
  assert.ok(f.git.calls.every(call => !call.path.includes('/git/blobs/')));
});
test('repository-wide inventory discovers both namespaces at one commit, not just configured items, without reading bodies', async t => {
  const f = await setup(t), inventory = verifyScopeInventory(await f.reader.readScopeInventory(f.git.head()));
  assert.deepEqual(inventory.roots.map(r => r.path), ['intent/0001', 'items/0002-canonical']);
  assert.equal(inventory.unsupportedRootCount, 0); assert.ok(f.git.calls.every(c => !c.path.includes('/git/blobs/')));
  assert.equal(f.git.mutations(), 0);
});
test('native Git corpus produces exact full-context legacy/canonical evidence and newly added candidate/amendment sources', async t => {
  const f = await setup(t); await candidate(f, 'new-candidate'); f.selections.set('items/0003-candidate', 'pre-pull-candidate');
  await candidate(f, 'amendment', '0002-canonical');
  const result = await f.service.collect(input, async () => {});
  assert.equal(result.evidence.head, f.git.head()); assert.equal(result.envelope.coverage.complete, true);
  assert.equal(result.coverage.enumeratedRootCount, 3); assert.equal(result.evidence.inventory.length, 8);
  assert.deepEqual(result.evidence.inventory.map(s => s.status).sort(), ['amendment', 'amendment', 'candidate', 'candidate', 'canonical', 'canonical', 'canonical', 'canonical']);
  assert.match(JSON.stringify(result), /Out of scope: billing|No SMS/); assert.doesNotMatch(JSON.stringify(result), /DO_NOT_READ_LEGACY_EXAM|Candidate Exam/);
  assert.equal(result.authoritativeClearance, false); assert.equal(result.semanticReviewComplete, false); assert.equal(f.git.mutations(), 0);
  assert.ok(Object.isFrozen(result.evidence.inventory[0]));
});
test('restricted and out-of-product roots are classified before source access; only aggregate gaps escape', async t => {
  const f = await setup(t);
  f.git.add([{ path: 'items/0008-private/BRIEF.md', content: 'PRIVATE-CONTENT' }, { path: 'items/0009-other/BRIEF.md', content: 'OTHER-PRODUCT' }]);
  f.selections.set('items/0008-private', 'inaccessible'); f.selections.set('items/0009-other', 'out-of-product');
  const source = f.reader.readArtifact, paths: string[] = [];
  f.reader.readArtifact = async (path, revision) => { paths.push(path); return source(path, revision); };
  const result = await f.service.collect(input, async () => {});
  assert.equal(result.evidence.accessGapCount, 1); assert.equal(result.coverage.excludedCount, 1); assert.equal(result.envelope.coverage.complete, false);
  assert.ok(paths.every(p => !p.includes('0008-private') && !p.includes('0009-other')));
  assert.doesNotMatch(JSON.stringify(result), /0008-private|0009-other|PRIVATE-CONTENT|OTHER-PRODUCT/);
});
test('missing Specs, unsupported roots, unverified lifecycle and source denial remain incomplete, never fallback newness', async t => {
  for (const mode of ['missing', 'unsupported', 'unresolved', 'denied', 'wrong-selection', 'pointer-conflict'] as const) {
    const f = await setup(t);
    if (mode === 'missing') f.git.add([{ path: 'intent/0001/SPEC.md', content: null }]);
    if (mode === 'unsupported') f.git.add([{ path: 'intent/unrecognized/BRIEF.md', content: '# Unknown' }]);
    if (mode === 'unresolved') f.selections.set('intent/0001', 'unresolved');
    if (mode === 'denied') f.denied.add('intent/0001/SPEC.md');
    if (mode === 'wrong-selection') f.authority.select = async c => ({ ...c, root: 'intent/9999', selection: 'canonical', authorityDigest });
    if (mode === 'pointer-conflict') await candidate(f, 'new-candidate'); // Claimed canonical while pre-pull pointer remains.
    const result = await f.service.collect(input, async () => {}); assert.equal(result.envelope.coverage.complete, false, mode);
    assert.equal(result.authoritativeClearance, false); assert.doesNotMatch(JSON.stringify(result), /PRIVATE|unrecognized/);
  }
});
test('changed head, selection, permission revision or late source access suppress the whole result', async t => {
  for (const mode of ['head', 'selection', 'permission', 'source'] as const) {
    const f = await setup(t), select = f.authority.select; let count = 0;
    f.authority.select = async c => {
      const selected = await select(c); count++;
      if (count === 3) {
        if (mode === 'head') f.git.add([{ path: 'unrelated.md', content: 'Head advanced' }]);
        if (mode === 'selection') return { ...selected, authorityDigest: 'e'.repeat(64) };
        if (mode === 'permission') f.permissions('p2');
        if (mode === 'source') f.denied.add('intent/0001/BRIEF.md');
      }
      return selected;
    };
    await assert.rejects(f.service.collect(input, async () => {}), /could not be verified/);
  }
});
test('corrupt/truncated trees and mismatched blobs cannot become complete corpus evidence', async t => {
  for (const mode of ['truncated', 'duplicate', 'ancestor', 'body'] as const) {
    const f = await setup(t);
    if (mode === 'body') {
      const read = f.reader.readArtifact; f.reader.readArtifact = async (p, r) => ({ ...await read(p, r), content: 'Substituted source' });
      assert.equal((await f.service.collect(input, async () => {})).envelope.coverage.complete, false); continue;
    }
    f.git.override((url, _init, value) => {
      if (!url.pathname.includes('/git/trees/')) return value;
      const tree = value as { tree: Array<{ path: string }> };
      return { ...tree, ...(mode === 'truncated' ? { truncated: true } : { tree: mode === 'duplicate' ? [...tree.tree, tree.tree[0]] : tree.tree.filter(e => e.path !== 'intent') }) };
    });
    await assert.rejects(f.service.collect(input, async () => {}));
  }
});
test('empty authorized namespaces remain a bounded declared corpus, not semantic uniqueness', async t => {
  const git = fixture(t), reader = createGitHubReader(binding, { appJwt: async () => 'synthetic-app-jwt', fetch: git.transport, now: () => now });
  const service = createIntentCorpusEvidence(reader, config, { authorize: async () => ({ permissionsRevision: 'p1' }), select: async () => assert.fail('No roots'), authorizeSource: async () => assert.fail('No files') });
  const result = await service.collect(input, async () => {}); assert.equal(result.envelope.coverage.complete, true); assert.equal(result.evidence.inventory.length, 0); assert.equal(result.semanticReviewComplete, false); service.close();
});
test('scope substitution and missing authority reject before I/O; close keeps a hung dependency from releasing or admitting another collection', async t => {
  const f = await setup(t); await assert.rejects(f.service.collect({ ...input, productId: 'other' }, async () => {})); assert.equal(f.git.calls.length, 0);
  let release!: () => void, entered!: () => void; const begun = new Promise<void>(r => { entered = r; });
  f.authority.authorize = async () => { entered(); await new Promise<void>(r => { release = r; }); return { permissionsRevision: 'p1' }; };
  const pending = assert.rejects(f.service.collect(input, async () => {})); await begun;
  await assert.rejects(f.service.collect(input, async () => {})); f.service.close(); await pending;
  release(); await Promise.resolve(); assert.equal(f.git.calls.length, 0);
});
test('bounded corpus exhaustion reports unresolved and unassessed coverage while preserving room for final head validation', async t => {
  const f = await setup(t), content = '# Existing scope\nOut of scope: billing\n';
  const contentDigest = createHash('sha256').update(content).digest('hex'), objectSha = createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex');
  const roots = Array.from({ length: 60 }, (_, i) => `intent/${String(i + 1).padStart(4, '0')}`);
  let bodyReads = 0, headReads = 0;
  const reader = { ...f.reader, readHead: async () => { headReads++; return f.git.head(); },
    readScopeInventory: async (revision: string) => ({ organizationId: 'org', repositoryId: 52, revision, treeSha: 'b'.repeat(40),
      entries: [{ path: 'intent', objectSha: 'c'.repeat(40), mode: '040000', type: 'tree' }, ...roots.flatMap(root => [
        { path: root, objectSha: 'd'.repeat(40), mode: '040000', type: 'tree' },
        ...['BRIEF', 'SPEC'].map(name => ({ path: `${root}/${name}.md`, objectSha, mode: '100644', type: 'blob' }))])] }),
    readArtifact: async (path: string, revision: string) => { bodyReads++; return { organizationId: 'org', repositoryId: 52, revision, path, content, contentDigest, blobSha: objectSha }; } };
  const service = createIntentCorpusEvidence(reader, config, f.authority);
  try {
    const result = await service.collect(input, async () => {});
    assert.equal(headReads, 2); assert.equal(bodyReads, 96); assert.equal(result.coverage.readLimitReached, true);
    assert.equal(result.coverage.enumeratedRootCount, 60); assert.equal(result.coverage.unresolvedCount, 12);
    assert.equal(result.envelope.coverage.complete, false); assert.equal(result.evidence.inventory.length, 96);
    assert.equal(result.envelope.coverage.includedCount, 32); assert.equal(result.envelope.coverage.gaps.length, 64);
  } finally { service.close(); }
});
test('a changed reader binding or foreign tree cannot relabel another repository as the authorized corpus', async t => {
  const f = await setup(t), reader = { ...f.reader, binding: { ...f.reader.binding } };
  const service = createIntentCorpusEvidence(reader, config, f.authority);
  reader.binding.repositoryId = 99;
  await assert.rejects(service.collect(input, async () => {})); assert.equal(f.git.calls.length, 0); service.close();
  const original = f.reader.readScopeInventory;
  f.reader.readScopeInventory = async revision => ({ ...await original(revision), repositoryId: 99 });
  await assert.rejects(f.service.collect(input, async () => {}));
});
test('elapsed monotonic deadline blocks I/O even before a delayed timer callback can run', async t => {
  const f = await setup(t); let clock = 0; t.mock.method(performance, 'now', () => clock);
  f.authority.authorize = async () => { clock = 30001; return { permissionsRevision: 'p1' }; };
  await assert.rejects(f.service.collect(input, async () => {})); assert.equal(f.git.calls.length, 0);
});
test('a private corpus session reads immutable bodies once, rechecks every consumed path and cannot be reused by another request', async t => {
  const f = await setup(t); await candidate(f, 'new-candidate'); f.selections.set('items/0003-candidate', 'pre-pull-candidate');
  const source = f.reader.readArtifact, authorize = f.authority.authorizeSource;
  const consumed = new Set<string>(), checked = new Set<string>(); let bodyReads = 0, later = false, headReads = 0;
  const head = f.reader.readHead;
  f.reader.readHead = async () => { headReads++; return head(); };
  f.reader.readArtifact = async (path, revision) => { bodyReads++; consumed.add(path); return source(path, revision); };
  f.authority.authorizeSource = async ref => { if (later) checked.add(ref.path); await authorize(ref); };
  let escaped!: () => Promise<unknown>;
  await assert.rejects(f.service.withReadSession({ ...input, proof: { evidence: 'forged' } }, async () => {}, async read => read()));
  const result = await f.service.withReadSession(input, async () => {}, async read => {
    escaped = read; const first = await read(), before = bodyReads; later = true;
    assert.strictEqual(await read(), first); assert.equal(bodyReads, before);
    assert.ok(Object.isFrozen(first.evidence.documents)); return first;
  });
  assert.equal(result.envelope.coverage.complete, true); assert.equal(headReads, 6);
  assert.deepEqual(checked, consumed); assert.ok([...consumed].some(path => path.endsWith('/EXAM.md')));
  assert.ok(consumed.size > result.evidence.inventory.length); assert.equal(f.git.mutations(), 0);
  await assert.rejects(escaped()); const before = bodyReads;
  await f.service.withReadSession(input, async () => {}, async read => read());
  assert.equal(bodyReads, before * 2); // A fresh invocation has no captured bytes.
});
test('session revalidation denies changed heads, permissions, bindings, ports, selection and grants including non-emitted Exam', async t => {
  for (const mode of ['head', 'permission', 'grant', 'exam', 'selection', 'excluded', 'port', 'caller', 'nonvoid'] as const) {
    const f = await setup(t); const plan = await candidate(f, 'new-candidate'); f.selections.set('items/0003-candidate', 'pre-pull-candidate');
    f.git.add([{ path: 'items/0009-other/BRIEF.md', content: 'Excluded product' }]); f.selections.set('items/0009-other', 'out-of-product');
    let valid = true, badVoid = false;
    const current = async () => { if (!valid) throw new Error('PRIVATE'); return badVoid ? false as unknown as void : undefined; };
    await assert.rejects(f.service.withReadSession(input, current, async read => {
      await read();
      if (mode === 'head') f.git.add([{ path: 'unrelated.md', content: 'New head' }]);
      if (mode === 'permission') f.permissions('p2');
      if (mode === 'grant') f.denied.add('intent/0001/BRIEF.md');
      if (mode === 'exam') f.denied.add(plan.files.find(file => file.path.endsWith('/EXAM.md'))!.path);
      if (mode === 'selection') f.selections.set('intent/0001', 'inaccessible');
      if (mode === 'excluded') f.selections.set('items/0009-other', 'canonical');
      if (mode === 'port') { const head = f.reader.readHead; f.reader.readHead = () => head(); }
      if (mode === 'caller') valid = false;
      if (mode === 'nonvoid') badVoid = true;
      return read();
    }), error => { assert.doesNotMatch(String(error), /PRIVATE/); return true; });
  }
  const f = await setup(t), reader = { ...f.reader, binding: { ...f.reader.binding } };
  const service = createIntentCorpusEvidence(reader, config, f.authority);
  await assert.rejects(service.withReadSession(input, async () => {}, async read => { await read(); reader.binding.repositoryId = 99; return read(); })); service.close();
});
test('final session checks withhold output for late source revocation or changed lifecycle after the last explicit read', async t => {
  for (const mode of ['grant', 'selection', 'head', 'permission'] as const) {
    const f = await setup(t);
    await assert.rejects(f.service.withReadSession(input, async () => {}, async read => {
      const result = await read(); await read();
      if (mode === 'grant') f.denied.add('items/0002-canonical/SPEC.md');
      if (mode === 'selection') f.selections.set('intent/0001', 'out-of-product');
      if (mode === 'head') f.git.add([{ path: 'another.md', content: 'Later head' }]);
      if (mode === 'permission') f.permissions('p2');
      return result;
    }));
  }
});
test('a complete collection checks consumed pointer Exam grants again before the first result escapes', async t => {
  const f = await setup(t), plan = await candidate(f, 'new-candidate'); f.selections.set('items/0003-candidate', 'pre-pull-candidate');
  const exam = plan.files.find(file => file.path.endsWith('/EXAM.md'))!.path, select = f.authority.select; let count = 0;
  f.authority.select = async context => { if (++count > 3) f.denied.add(exam); return select(context); };
  await assert.rejects(f.service.collect(input, async () => {}));
});
test('incomplete and corrupt collections are recollected in full and cannot silently become complete', async t => {
  for (const mode of ['missing', 'inaccessible', 'corrupt'] as const) {
    const f = await setup(t), source = f.reader.readArtifact; let reads = 0, repair = false;
    f.reader.readArtifact = async (path, revision) => { reads++; const value = await source(path, revision); return mode === 'corrupt' && !repair ? { ...value, content: 'Corrupt bytes' } : value; };
    if (mode === 'missing') f.git.add([{ path: 'intent/0001/SPEC.md', content: null }]);
    if (mode === 'inaccessible') f.selections.set('intent/0001', 'inaccessible');
    await f.service.withReadSession(input, async () => {}, async read => {
      const first = await read(), before = reads; assert.equal(first.envelope.coverage.complete, false);
      assert.deepEqual(await read(), first); assert.ok(reads > before); return first;
    });
    await assert.rejects(f.service.withReadSession(input, async () => {}, async read => {
      await read(); repair = true;
      if (mode === 'missing') f.git.add([{ path: 'intent/0001/SPEC.md', content: '# Repaired' }]);
      if (mode === 'inaccessible') f.selections.set('intent/0001', 'canonical');
      return read();
    }));
  }
});
test('sessions reject absent reads, parallel reads, swallowed read failures and callbacks that return nonvoid', async t => {
  const f = await setup(t);
  await assert.rejects(f.service.withReadSession(input, async () => {}, async () => 'unverified'));
  await assert.rejects(f.service.withReadSession(input, async () => {}, async read => { await Promise.allSettled([read(), read()]); return 'ignored failures'; }));
  await assert.rejects(f.service.withReadSession(input, async () => {}, async read => {
    await read(); f.permissions('p2'); await assert.rejects(read()); return 'ignored revoked grant';
  }));
  const auth = f.authority.authorizeSource;
  f.authority.authorizeSource = async ref => { await auth(ref); return false as unknown as void; };
  const partial = await f.service.withReadSession(input, async () => {}, async read => read());
  assert.equal(partial.envelope.coverage.complete, false); // Denied source cannot enter a proof.
});
test('session deadline retains four occupied slots until timed-out callbacks drain', async t => {
  const f = await setup(t), releases: Array<() => void> = [], pending: Array<Promise<void>> = [];
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (let i = 0; i < 4; i++) {
    let entered!: () => void; const begun = new Promise<void>(resolve => { entered = resolve; });
    const operation = f.service.withReadSession(input, async () => {}, async read => {
      await read(); entered(); await new Promise<void>(resolve => releases.push(resolve)); return 'late';
    });
    pending.push(assert.rejects(operation)); await begun;
  }
  t.mock.timers.tick(30001); await Promise.all(pending);
  await assert.rejects(f.service.withReadSession(input, async () => {}, async read => read()));
  releases.forEach(release => release()); await new Promise<void>(resolve => setImmediate(resolve));
  const result = await f.service.withReadSession(input, async () => {}, async read => read());
  assert.equal(result.envelope.coverage.complete, true);
});
test('closure rejects a pending fresh check immediately and suppresses its late read', async t => {
  const f = await setup(t); let hold = false, entered!: () => void, release!: () => void;
  const begun = new Promise<void>(resolve => { entered = resolve; });
  const authorize = f.authority.authorize;
  f.authority.authorize = async () => { if (hold) { entered(); await new Promise<void>(resolve => { release = resolve; }); } return authorize(); };
  const pending = assert.rejects(f.service.withReadSession(input, async () => {}, async read => { await read(); hold = true; return read(); }));
  await begun; const requests = f.git.calls.length; f.service.close(); await pending;
  release(); await new Promise<void>(resolve => setImmediate(resolve)); assert.equal(f.git.calls.length, requests);
});
test('verified sources beyond one semantic batch retain their exact gaps without another body traversal', async t => {
  const f = await setup(t);
  f.git.add(Array.from({ length: 15 }, (_, index) => ['BRIEF', 'SPEC'].map(name => ({
    path: `intent/${String(index + 2).padStart(4, '0')}/${name}.md`, content: `# ${name}\nDistinct context ${index}\n`,
  }))).flat());
  let bodies = 0; const readSource = f.reader.readArtifact;
  f.reader.readArtifact = async (...args) => { bodies++; return readSource(...args); };
  await f.service.withReadSession(input, async () => {}, async read => {
    const first = await read(); assert.equal(first.evidence.inventory.length, 34);
    assert.equal(first.evidence.documents.length, 34); assert.equal(first.envelope.coverage.complete, false);
    assert.equal(first.envelope.coverage.gaps.length, 2); const before = bodies;
    assert.strictEqual(await read(), first); assert.equal(bodies, before); return first;
  });
  assert.equal(bodies, 34);
});
test('fresh callbacks cannot return nonvoid, revoke the caller or run after the monotonic deadline', async t => {
  for (const mode of ['nonvoid', 'caller', 'deadline'] as const) {
    const f = await setup(t); let later = false, valid = true, clock = 0;
    const source = f.authority.authorizeSource; t.mock.method(performance, 'now', () => clock);
    f.authority.authorizeSource = async ref => {
      await source(ref);
      if (later && mode === 'nonvoid') return false as unknown as void;
      if (later && mode === 'caller') valid = false;
    };
    await assert.rejects(f.service.withReadSession(input, async () => { if (!valid) throw new Error('PRIVATE'); }, async read => {
      await read(); later = true; if (mode === 'deadline') clock = 30001; return read();
    })); t.mock.restoreAll();
  }
});

test('retained evidence uses a bounded policy sweep without skipping any selection, source grant or repository head barrier', async t => {
  const f = await setup(t); let later = false, permissions = 0, heads = 0, bodies = 0;
  const selections: string[] = [], grants: string[] = [], headBarriers: number[] = [], authorize = f.authority.authorize,
    select = f.authority.select, source = f.authority.authorizeSource, head = f.reader.readHead, artifact = f.reader.readArtifact;
  f.authority.authorize = async () => { if (later) permissions++; return authorize(); };
  f.authority.select = async context => { if (later) selections.push(context.root); return select(context); };
  f.authority.authorizeSource = async ref => { if (later) grants.push(ref.path); return source(ref); };
  f.reader.readHead = async () => { if (later) { heads++; headBarriers.push(permissions); } return head(); };
  f.reader.readArtifact = async (...args) => { if (later) bodies++; return artifact(...args); };
  await f.service.withReadSession(input, async () => {}, async read => {
    const first = await read(); later = true; assert.strictEqual(await read(), first);
    assert.equal(permissions, 4); assert.deepEqual(headBarriers, [1, 3]); assert.equal(heads, 2); assert.equal(bodies, 0);
    assert.deepEqual(selections, ['intent/0001', 'items/0002-canonical']);
    assert.deepEqual(grants.sort(), first.evidence.inventory.map(source => source.path).sort());
    later = false; return first;
  });
});

test('a policy sweep rejects mid-sweep identity/all-grants changes before another repository read or retained result', async t => {
  for (const mode of ['caller', 'permission', 'head', 'port', 'source', 'selection'] as const) {
    const f = await setup(t); let later = false, valid = true, heads = 0, grants = 0;
    const source = f.authority.authorizeSource, head = f.reader.readHead;
    f.reader.readHead = async () => { if (later) heads++; return head(); };
    f.authority.authorizeSource = async ref => {
      await source(ref); if (!later || ++grants !== 2) return;
      if (mode === 'caller') valid = false;
      if (mode === 'permission') f.permissions('p2');
      if (mode === 'head') f.git.add([{ path: 'other.md', content: 'Changed during sweep' }]);
      if (mode === 'port') f.authority.select = async c => ({ ...c, selection: 'inaccessible', authorityDigest });
      if (mode === 'source') f.denied.add('items/0002-canonical/SPEC.md');
      if (mode === 'selection') { f.selections.set('intent/0001', 'inaccessible'); f.permissions('p2'); }
    };
    await assert.rejects(f.service.withReadSession(input, async () => { if (!valid) throw new Error('PRIVATE caller'); }, async read => {
      await read(); later = true; return read();
    }));
    assert.equal(heads, mode === 'head' ? 2 : 1, mode); assert.equal(f.git.mutations(), 0);
  }
});
