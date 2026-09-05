import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { ArtifactReader } from '../src/code-host/github.ts';
import { reconcileArtifacts, ReconciliationError, type ProjectionOutcome, type SnapshotProjectionSink } from '../src/code-host/reconcile.ts';

const revision = 'a'.repeat(40);
const fixture = () => {
  const rows = new Map<string, string>(); let reads = 0;
  const reader: ArtifactReader = {
    binding: { organizationId: 'org-a', repositoryId: 2, installationId: 1, owner: 'synthetic', repository: 'repo', branch: 'main' },
    readHead: async () => revision,
    readArtifact: async (path, rev) => { reads++; const content = `# ${path}\n`;
      return { organizationId: 'org-a', repositoryId: 2, path, revision: rev, content,
        contentDigest: createHash('sha256').update(content).digest('hex'),
        blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0${content}`).digest('hex') }; },
  };
  const sink: SnapshotProjectionSink<ProjectionOutcome> = {
    currentRevision: async (_repo, path) => rows.get(path) ?? null,
    ingest: async (snapshot, expected) => {
      assert.equal(rows.get(snapshot.path) ?? null, expected);
      const duplicate = rows.get(snapshot.path) === snapshot.revision;
      rows.set(snapshot.path, snapshot.revision); return duplicate ? 'duplicate' : 'applied';
    },
  };
  return { reader, sink, rows, reads: () => reads };
};
const error = (code: string, acknowledged = 0) => (value: unknown) => value instanceof ReconciliationError && value.code === code && value.acknowledged === acknowledged && !value.message.includes('private');

test('batch is deterministic, revision-pinned and safely replays after missing intermediate updates', async () => {
  const f = fixture(); const paths = ['SPEC.md', 'BRIEF.md'];
  const result = await reconcileArtifacts(f.reader, paths, f.sink);
  assert.equal(result.status, 'reconciled'); assert.equal(result.revision, revision);
  assert.deepEqual(result.outcomes.map((item) => item.path), ['BRIEF.md', 'SPEC.md']);
  assert.equal(f.reads(), 2);
  assert.ok((await reconcileArtifacts(f.reader, paths, f.sink)).outcomes.every((item) => item.outcome === 'duplicate'));
  f.reader.readHead = async () => 'c'.repeat(40); // No delivery of intervening revision B.
  assert.ok((await reconcileArtifacts(f.reader, paths, f.sink)).outcomes.every((item) => item.outcome === 'applied'));
  assert.deepEqual([...f.rows.values()], ['c'.repeat(40), 'c'.repeat(40)]);
});

test('invalid manifests, missing files and corrupt or moving source never start writes', async () => {
  for (const paths of [[], ['x', 'x'], ['../x'], Array.from({ length: 101 }, (_, i) => `${i}.md`)]) {
    const f = fixture(); await assert.rejects(reconcileArtifacts(f.reader, paths, f.sink), error('INVALID_SCOPE')); assert.equal(f.reads(), 0);
  }
  for (const fault of ['missing', 'corrupt', 'binding', 'head']) {
    const f = fixture(); const read = f.reader.readArtifact;
    f.reader.readArtifact = async (path, rev) => {
      if (path === 'SPEC.md' && fault === 'missing') throw new Error('private source detail');
      const value = await read(path, rev);
      return fault === 'corrupt' ? { ...value, contentDigest: '0'.repeat(64) } : fault === 'binding' ? { ...value, organizationId: 'foreign' } : value;
    };
    let heads = 0; if (fault === 'head') f.reader.readHead = async () => ++heads > 1 ? 'b'.repeat(40) : revision;
    await assert.rejects(reconcileArtifacts(f.reader, ['BRIEF.md', 'SPEC.md'], f.sink), error(fault === 'head' ? 'SOURCE_CHANGED' : 'SOURCE_FAILED'));
    assert.equal(f.rows.size, 0);
  }
});

test('aggregate staging is bounded before any write', async () => {
  const f = fixture(); const content = 'x'.repeat(512 * 1024);
  f.reader.readArtifact = async (path, rev) => ({ organizationId: 'org-a', repositoryId: 2, path, revision: rev, content,
    contentDigest: createHash('sha256').update(content).digest('hex'), blobSha: createHash('sha1').update(`blob ${content.length}\0${content}`).digest('hex') });
  await assert.rejects(reconcileArtifacts(f.reader, Array.from({ length: 17 }, (_, i) => `${i}.md`), f.sink), error('SOURCE_FAILED'));
  assert.equal(f.rows.size, 0);
});

test('sink failure exposes only acknowledged progress and explicit rerun converges', async () => {
  const f = fixture(); const ingest = f.sink.ingest;
  f.sink.ingest = async (snapshot, expected) => { if (snapshot.path === 'SPEC.md') throw new Error('private database details'); return ingest(snapshot, expected); };
  await assert.rejects(reconcileArtifacts(f.reader, ['BRIEF.md', 'SPEC.md'], f.sink), error('SINK_FAILED', 1));
  assert.equal(f.rows.size, 1); f.sink.ingest = ingest;
  assert.deepEqual((await reconcileArtifacts(f.reader, ['BRIEF.md', 'SPEC.md'], f.sink)).outcomes.map((item) => item.outcome), ['duplicate', 'applied']);
});

test('head movement during writes and cancellation preserve partial-state truth', async () => {
  const f = fixture(); const ingest = f.sink.ingest;
  f.sink.ingest = async (snapshot, expected) => { const result = await ingest(snapshot, expected); f.reader.readHead = async () => 'b'.repeat(40); return result; };
  await assert.rejects(reconcileArtifacts(f.reader, ['BRIEF.md', 'SPEC.md'], f.sink), error('SOURCE_CHANGED', 1));
  const g = fixture(); const controller = new AbortController(); const read = g.reader.readArtifact;
  g.reader.readArtifact = async (path, rev) => { const value = await read(path, rev); controller.abort(); return value; };
  await assert.rejects(reconcileArtifacts(g.reader, ['BRIEF.md'], g.sink, controller.signal), error('ABORTED'));
  assert.equal(g.rows.size, 0);
});

test('superseded sink result never reports a fully reconciled manifest', async () => {
  const f = fixture(); f.sink.ingest = async () => 'superseded';
  assert.equal((await reconcileArtifacts(f.reader, ['BRIEF.md'], f.sink)).status, 'superseded');
});
