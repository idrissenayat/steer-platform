import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { RepositoryReader } from '../src/code-host/github.ts';
import { createGitGateObserver } from '../src/code-host/gate-observation.ts';

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
