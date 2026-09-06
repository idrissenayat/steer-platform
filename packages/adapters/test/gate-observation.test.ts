import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { RepositoryReader } from '../src/code-host/github.ts';
import { createGitHubReader } from '../src/code-host/github.ts';
import { createGitGateObserver } from '../src/code-host/gate-observation.ts';
import { briefWriteAuthoritySchema } from '@steer/tool-registry';

const revision = 'a'.repeat(40), head = 'b'.repeat(40);
const scope = { organizationId: 'synthetic', repository: 'github:1', itemId: 'intent/0042' };
const config = { scope, gate: 2, artifactRevision: revision, artifactPaths: ['BRIEF.md'], recordPath: 'gates/record.json', recordItem: 'synthetic-item' };
const principal = { subject: 'synthetic-observer', organizationId: scope.organizationId, type: 'agent', hats: [], toolGrants: ['gate.observe'], expiresAt: new Date(Date.now() + 600000).toISOString() };
const record = { version: 'steer-gate-signature/v1', organization: scope.organizationId, productHome: 'https://github.com/synthetic/synthetic', item: config.recordItem,
  gate: 2, artifactRevision: revision, decision: 'send-back', artifacts: [{ path: 'BRIEF.md', revision }],
  signatures: [{ subject: 'synthetic-human-not-a-real-signature', hat: 'tech-lead', sequence: 1, signedAt: new Date().toISOString() }] };
function fixture() {
  let recordText: string | null = JSON.stringify(record), changed = false, reads = 0, headCalls = 0;
  let fault: 'none' | 'digest' | 'head' | 'missing' = 'none';
  const blob = (content: string) => createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex');
  const reader: RepositoryReader = { binding: { organizationId: scope.organizationId, repositoryId: 1, installationId: 1, owner: 'synthetic', repository: 'synthetic', branch: 'synthetic' },
    readHead: async () => (++headCalls > 1 && fault === 'head') ? 'c'.repeat(40) : head,
    readArtifact: async (path, at) => {
      reads++; if (fault === 'missing') throw new Error('private missing file');
      const content = path === config.recordPath ? recordText! : changed && at === head ? 'changed' : 'original';
      return { organizationId: scope.organizationId, repositoryId: 1, path, revision: at, content, blobSha: blob(content),
        contentDigest: fault === 'digest' ? '0'.repeat(64) : createHash('sha256').update(content).digest('hex') };
    },
    readInventory: async (_selection, at) => ({ organizationId: scope.organizationId, repositoryId: 1, revision: at, treeSha: 'd'.repeat(40),
      entries: recordText === null ? [] : [{ path: config.recordPath, blobSha: blob(recordText) }] }),
  };
  return { reader, reads: () => reads, setRecord: (value: unknown) => { recordText = value === null ? null : JSON.stringify(value); },
    change: () => { changed = true; }, fault: (value: typeof fault) => { fault = value; } };
}
test('Git gate observer reports matching record provenance, absence, stale revision and changed artifact without approving decisions', async () => {
  const fixtureData = fixture(); const observer = createGitGateObserver(fixtureData.reader, config, async () => principal);
  const result = await observer.observe(); assert.equal(result.artifactRevision, revision); assert.equal(result.sourceRevision, head);
  assert.equal(result.decisionDigest, createHash('sha256').update(JSON.stringify(record)).digest('hex')); assert.ok(!JSON.stringify(result).includes('send-back'));
  fixtureData.setRecord(null); assert.equal((await observer.observe()).decisionDigest, null);
  fixtureData.setRecord({ ...record, artifactRevision: 'c'.repeat(40) }); assert.equal((await observer.observe()).decisionDigest, null);
  fixtureData.setRecord(record); fixtureData.change(); assert.deepEqual(await observer.observe(), { sourceRevision: head, artifactRevision: head, decisionDigest: null });
  await observer.shutdown(); await assert.rejects(observer.observe(), /not accepting/);
});
test('wrong grants, tenant or human hats deny before source access and post-read revocation discards output', async () => {
  for (const identity of [null, { ...principal, toolGrants: [] }, { ...principal, organizationId: 'foreign' }, { ...principal, type: 'human' }, { ...principal, hats: ['tech-lead'] }]) {
    const f = fixture(); await assert.rejects(createGitGateObserver(f.reader, config, async () => identity).observe(), /could not be verified/); assert.equal(f.reads(), 0);
  }
  for (const identity of [null, { ...principal, subject: 'changed' }, { ...principal, expiresAt: new Date(0).toISOString() }]) {
    const f = fixture(); let calls = 0; const observer = createGitGateObserver(f.reader, config, async () => ++calls === 1 ? principal : identity);
    await assert.rejects(observer.observe(), /could not be verified/); assert.ok(f.reads() > 0);
  }
});
test('source corruption, moving head, missing governed artifact and mismatched record scope/set fail closed', async () => {
  for (const fault of ['digest', 'head', 'missing'] as const) { const f = fixture(); f.fault(fault); await assert.rejects(createGitGateObserver(f.reader, config, async () => principal).observe(), /^Error: Gate source observation could not be verified\.$/); }
  for (const change of [{ organization: 'foreign' }, { productHome: 'https://github.com/foreign/repo' }, { item: 'other' }, { gate: 1 },
    { artifacts: [] }, { artifacts: [{ path: 'OTHER.md', revision }] }, { signatures: [] }]) {
    const f = fixture(); f.setRecord({ ...record, ...change }); await assert.rejects(createGitGateObserver(f.reader, config, async () => principal).observe());
  }
});
test('invalid configuration denies and shutdown waits for the actual pending source read', async () => {
  const f = fixture();
  for (const change of [{ artifactPaths: [] }, { artifactPaths: ['BRIEF.md', 'BRIEF.md'] }, { recordPath: '../private' }, { recordPath: 'BRIEF.md' }, { scope: { ...scope, repository: 'github:2' } }]) assert.throws(() => createGitGateObserver(f.reader, { ...config, ...change }, async () => principal));
  let release!: () => void; const blocked = new Promise<void>((resolve) => { release = resolve; });
  const readHead = f.reader.readHead; f.reader.readHead = async () => { await blocked; return readHead(); };
  const observer = createGitGateObserver(f.reader, config, async () => principal); const pending = observer.observe();
  await assert.rejects(observer.observe(), /not accepting/); let closed = false;
  const stop = observer.shutdown().then(() => { closed = true; }); await Promise.resolve(); assert.equal(closed, false);
  release(); await pending; await stop; assert.equal(closed, true); await assert.rejects(observer.observe());
});

const expected = () => ({ sourceRevision: head, decisionDigest: createHash('sha256').update(JSON.stringify(record)).digest('hex') });
test('exact-source collection retains immutable original bytes without creating gate or write authority', async () => {
  const f = fixture(); const observer = createGitGateObserver(f.reader, config, async () => principal);
  const bundle = await observer.collect(expected());
  assert.equal(bundle.sourceRevision, head); assert.equal(bundle.artifactRevision, revision);
  assert.equal(bundle.organizationId, scope.organizationId); assert.equal(bundle.repository, scope.repository);
  assert.equal(bundle.branch, f.reader.binding.branch); assert.equal(bundle.itemId, scope.itemId);
  assert.equal(bundle.recordItem, config.recordItem); assert.equal(bundle.gate, 2);
  assert.equal(bundle.record.path, config.recordPath); assert.equal(bundle.record.revision, head);
  assert.equal(bundle.record.content, JSON.stringify(record));
  assert.equal(JSON.parse(bundle.record.content).decision, 'send-back');
  assert.equal(bundle.artifacts.length, 1); assert.equal(bundle.artifacts[0]!.path, 'BRIEF.md');
  assert.equal(bundle.artifacts[0]!.revision, revision); assert.equal(bundle.artifacts[0]!.content, 'original');
  assert.equal(bundle.providerVerificationRequired, true); assert.equal(bundle.gateVerified, false); assert.equal(bundle.writeAuthorized, false);
  assert.equal(briefWriteAuthoritySchema.safeParse(bundle).success, false);
  for (const value of [bundle, bundle.record, bundle.artifacts, ...bundle.artifacts]) assert.ok(Object.isFrozen(value));
  assert.throws(() => { (bundle.record as { content: string }).content = 'approved'; }, TypeError);
  assert.deepEqual(Object.keys(await observer.observe()).sort(), ['artifactRevision', 'decisionDigest', 'sourceRevision']);
  await observer.shutdown(); await assert.rejects(observer.collect(expected()), /not accepting/);
});
test('collection requires exact head and digest and never substitutes absent, stale or changed sources', async () => {
  for (const input of [null, {}, { ...expected(), sourceRevision: `${head}\n` }, { ...expected(), sourceRevision: 'c'.repeat(40) },
    { ...expected(), decisionDigest: '0'.repeat(64) }, { ...expected(), trusted: true }]) {
    const f = fixture(); await assert.rejects(createGitGateObserver(f.reader, config, async () => principal).collect(input));
    if (input === null || !('decisionDigest' in input) || 'trusted' in input || !('sourceRevision' in input) || input.sourceRevision !== head) assert.equal(f.reads(), 0);
  }
  for (const source of ['absent', 'stale', 'changed', 'moving', 'corrupt'] as const) {
    const f = fixture();
    if (source === 'absent') f.setRecord(null);
    if (source === 'stale') f.setRecord({ ...record, artifactRevision: 'c'.repeat(40) });
    if (source === 'changed') f.change();
    if (source === 'moving') f.fault('head');
    if (source === 'corrupt') f.fault('digest');
    await assert.rejects(createGitGateObserver(f.reader, config, async () => principal).collect(expected()), /^Error: Gate source observation could not be verified\.$/);
  }
});
test('collection shares authorization, single-flight and shutdown with the legacy observation', async () => {
  for (const identity of [null, { ...principal, toolGrants: [] }, { ...principal, organizationId: 'foreign' }]) {
    const f = fixture(); await assert.rejects(createGitGateObserver(f.reader, config, async () => identity).collect(expected())); assert.equal(f.reads(), 0);
  }
  const revoked = fixture(); let calls = 0;
  await assert.rejects(createGitGateObserver(revoked.reader, config, async () => ++calls === 1 ? principal : null).collect(expected()));
  const f = fixture(); let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; }); const readHead = f.reader.readHead;
  f.reader.readHead = async () => { await wait; return readHead(); };
  const observer = createGitGateObserver(f.reader, config, async () => principal); const pending = observer.collect(expected());
  await assert.rejects(observer.observe(), /not accepting/); await assert.rejects(observer.collect(expected()), /not accepting/);
  let stopped = false; const shutdown = observer.shutdown().then(() => { stopped = true; });
  await Promise.resolve(); assert.equal(stopped, false); release(); await pending; await shutdown; assert.equal(stopped, true);
});
test('collector rejects malformed UTF-8 source strings and strips source extras without retaining mutable aliases', async () => {
  const f = fixture(); const original = f.reader.readArtifact; let retained: Awaited<ReturnType<typeof original>> | undefined;
  f.reader.readArtifact = async (path, at) => { const snapshot = await original(path, at); if (path === config.recordPath) retained = snapshot;
    return Object.assign(snapshot, { injectedApproval: true }); };
  const observer = createGitGateObserver(f.reader, config, async () => principal); const bundle = await observer.collect(expected());
  retained!.content = 'replaced'; assert.equal(bundle.record.content, JSON.stringify(record));
  assert.ok(!('injectedApproval' in bundle.record)); assert.ok(!('injectedApproval' in bundle.artifacts[0]!));
  const broken = fixture(); const read = broken.reader.readArtifact;
  broken.reader.readArtifact = async (path, at) => {
    const result = await read(path, at), content = '\ud800';
    return { ...result, content, contentDigest: createHash('sha256').update(content).digest('hex'),
      blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex') };
  };
  await assert.rejects(createGitGateObserver(broken.reader, config, async () => principal).collect(expected()));
});
test('collection rejects expiry reached during its final source-head read', async (t) => {
  let time = Date.now(); t.mock.method(Date, 'now', () => time);
  const f = fixture(), read = f.reader.readHead; let reads = 0;
  const identity = { ...principal, expiresAt: new Date(time + 1000).toISOString() };
  f.reader.readHead = async () => { if (++reads === 2) time += 1000; return read(); };
  await assert.rejects(createGitGateObserver(f.reader, config, async () => identity).collect(expected()));
});
test('collector composes with the real GitHub reader using read-only synthetic HTTP responses', async () => {
  const binding = fixture().reader.binding, tree = 'd'.repeat(40), originalTree = 'e'.repeat(40);
  const digest = (content: string) => createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex');
  const files = [{ path: 'BRIEF.md', content: 'original' }, { path: config.recordPath, content: JSON.stringify(record) }];
  let truncated = false; const calls: string[] = [];
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); calls.push(url.pathname);
    assert.equal(url.origin, 'https://api.github.com'); assert.equal(init?.redirect, 'error');
    const headers = new Headers(init?.headers);
    if (url.pathname === '/app/installations/1/access_tokens') {
      assert.equal(init?.method, 'POST'); assert.equal(headers.get('authorization'), 'Bearer synthetic-app');
      assert.deepEqual(JSON.parse(String(init.body)), { repository_ids: [1], permissions: { contents: 'read' } });
      return Response.json({ token: 'synthetic-read-only', expires_at: new Date(Date.now() + 3600000).toISOString(),
        permissions: { contents: 'read', metadata: 'read' }, repositories: [{ id: 1, full_name: 'synthetic/synthetic' }] });
    }
    assert.equal(init?.method, 'GET'); assert.equal(headers.get('authorization'), 'Bearer synthetic-read-only');
    const prefix = '/repos/synthetic/synthetic/git/'; assert.ok(url.pathname.startsWith(prefix));
    const route = url.pathname.slice(prefix.length);
    if (route === 'ref/heads/synthetic') return Response.json({ ref: 'refs/heads/synthetic', object: { type: 'commit', sha: head } });
    if (route === `commits/${head}` || route === `commits/${revision}`) {
      const at = route.slice('commits/'.length); return Response.json({ sha: at, tree: { sha: at === head ? tree : originalTree } });
    }
    if (route === `trees/${tree}` || route === `trees/${originalTree}`) {
      const at = route.slice('trees/'.length);
      return Response.json({ sha: at, truncated, tree: files.filter((file) => at === tree || file.path === 'BRIEF.md')
        .map((file) => ({ path: file.path, mode: '100644', type: 'blob', sha: digest(file.content) })) });
    }
    const file = files.find((file) => route === `blobs/${digest(file.content)}`); assert.ok(file);
    return Response.json({ sha: digest(file.content), encoding: 'base64', size: Buffer.byteLength(file.content), content: Buffer.from(file.content).toString('base64') });
  };
  const reader = createGitHubReader(binding, { appJwt: async () => 'synthetic-app', fetch: transport });
  const observer = createGitGateObserver(reader, config, async () => principal);
  const bundle = await observer.collect(expected()); assert.equal(bundle.record.content, JSON.stringify(record));
  assert.equal(bundle.artifacts[0]!.content, 'original'); assert.equal(bundle.writeAuthorized, false);
  assert.equal(calls.filter((path) => path.endsWith('/access_tokens')).length, 1);
  truncated = true; await assert.rejects(observer.collect(expected()));
});

test('partial clock rollback during source collection rejects instead of returning plausible provenance', async (t) => {
  const start = Date.now(); let at = start; t.mock.method(Date, 'now', () => at);
  const f = fixture(), read = f.reader.readArtifact; let reads = 0;
  f.reader.readArtifact = async (path, revision) => {
    at = start + (++reads === 1 ? 1000 : 999); return read(path, revision);
  };
  await assert.rejects(createGitGateObserver(f.reader, config, async () => principal).collect(expected()));
});

test('nonfinite start and exact logical deadline deny before further gate-source reads', async (t) => {
  const start = Date.now(); let at = start; t.mock.method(Date, 'now', () => at);
  let authentications = 0;
  const f = fixture(); at = NaN;
  await assert.rejects(createGitGateObserver(f.reader, config, async () => { authentications++; return principal; }).observe());
  assert.equal(authentications, 0); assert.equal(f.reads(), 0);
  for (const advance of [15000, NaN, -1]) {
    at = start; const g = fixture(), read = g.reader.readHead;
    g.reader.readHead = async () => { at = start + advance; return read(); };
    await assert.rejects(createGitGateObserver(g.reader, config, async () => principal).collect(expected()));
    assert.equal(g.reads(), 0);
  }
});

test('equal clock observations preserve collection and the public legacy observation shape', async (t) => {
  const at = Date.now(); t.mock.method(Date, 'now', () => at);
  const f = fixture(), observer = createGitGateObserver(f.reader, config, async () => principal);
  assert.equal((await observer.collect(expected())).writeAuthorized, false);
  assert.deepEqual(Object.keys(await observer.observe()).sort(), ['artifactRevision', 'decisionDigest', 'sourceRevision']);
  await observer.shutdown();
});

test('real collection timeout keeps admission closed and shutdown draining; late source cannot continue', async (t) => {
  const f = fixture(), read = f.reader.readArtifact;
  let release!: () => void, entered!: () => void, sourceCalls = 0;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const arrived = new Promise<void>((resolve) => { entered = resolve; }); t.after(() => release());
  f.reader.readArtifact = async (path, at) => { sourceCalls++; entered(); await blocked; return read(path, at); };
  const observer = createGitGateObserver(f.reader, config, async () => principal);
  const first = observer.collect(expected()); const rejected = assert.rejects(first, /^Error: Gate source observation could not be verified\.$/);
  await arrived; await rejected;
  assert.deepEqual(observer.status(), { stopping: false, active: true });
  await assert.rejects(observer.observe(), /not accepting/); await assert.rejects(observer.collect(expected()), /not accepting/);
  let stopped = false; const draining = observer.shutdown().then(() => { stopped = true; });
  await Promise.resolve(); assert.equal(stopped, false);
  release(); await draining; assert.equal(stopped, true); assert.equal(sourceCalls, 1); assert.equal(f.reads(), 1);
  assert.deepEqual(observer.status(), { stopping: true, active: false }); await assert.rejects(observer.observe(), /not accepting/);
});
