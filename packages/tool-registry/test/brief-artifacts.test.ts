import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { invokeTool, ToolError, lifecycleArtifactPaths, briefArtifactsOutputSchema, describeTools,
  createOpenApiDocument, type ArtifactProjectionReader, type InvocationContext } from '../src/index.ts';

const now = new Date('2026-09-07T12:00:00Z');
const principal = { subject: 'synthetic-human', organizationId: 'org', type: 'human', hats: [],
  toolGrants: ['intent.brief.artifacts', 'intent.brief.read', 'projection.artifact.read'], expiresAt: '2026-09-07T13:00:00Z' };
const scope = { organizationId: 'org', repository: 'github:1' };
const revision = 'a'.repeat(40), path = 'items/0190-source-coverage/BRIEF.md';
const source = (path: string, content = '# Synthetic source\n') => ({ ...scope, path, revision, kind: 'projection', content,
  contentDigest: createHash('sha256').update(content).digest('hex'),
  blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex') });
const brief = source(path, '# Brief: Synthetic\n'), references = lifecycleArtifactPaths(path);
const input = { ...scope, path, revision, contentDigest: brief.contentDigest };
function fixture() {
  const reads: unknown[] = [];
  const values = new Map<string, unknown>([[path, brief], ...references.map(ref => [ref.path, source(ref.path)] as [string, unknown])]);
  const service = { scope: { ...scope, paths: [path, ...references.map(ref => ref.path)] },
    read: async value => { reads.push(value); return values.get(value.path) ?? null; } } satisfies ArtifactProjectionReader;
  const context: InvocationContext = { principal, now, clock: () => now, revalidate: async () => principal, services: { artifactProjection: service } };
  return { reads, values, service, context };
}
const code = (value: string) => (error: unknown) => error instanceof ToolError && error.code === value;
const read = (f: ReturnType<typeof fixture>, value: unknown = input) => invokeTool('intent.brief.artifacts', value, f.context);

test('four exact reads produce ordered bounded fingerprints, not contents, readiness or approval', async () => {
  const f = fixture(); const result = await read(f); assert.ok(result);
  assert.deepEqual(result.brief, input); assert.equal(result.stage, null);
  assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
  assert.equal(f.reads.length, 4);
  assert.deepEqual(f.reads, [path, ...references.map(ref => ref.path)].map(path => ({ ...scope, path, revision })));
  assert.deepEqual(result.artifacts.map(ref => [ref.kind, ref.status]), [['spec', 'projected'], ['exam', 'projected'], ['plan', 'projected']]);
  assert.deepEqual(result.artifacts[0]!.fingerprint, { blobSha: source(references[0]!.path).blobSha, contentDigest: source(references[0]!.path).contentDigest });
  assert.ok(!JSON.stringify(result).includes('Synthetic source'));
  for (const override of [{ stage: 'engineer' }, { gateVerified: true }, { writeAuthorized: true }, { signatures: [] }])
    assert.equal(briefArtifactsOutputSchema.safeParse({ ...result, ...override }).success, false);
});

test('unconfigured paths are not read and projection absence is distinct from missing configuration', async () => {
  const f = fixture(); f.service.scope = { ...scope, paths: [path, references[0]!.path] }; f.values.delete(references[0]!.path);
  const result = await read(f); assert.ok(result); assert.equal(f.reads.length, 2);
  assert.deepEqual(result.artifacts.map(ref => ref.status), ['not-projected', 'not-configured', 'not-configured']);
  assert.ok(result.artifacts.every(ref => ref.fingerprint === null));
});

test('Brief absence and wrong digest return null without probing siblings', async () => {
  for (const absent of [false, true]) {
    const f = fixture(); if (absent) f.values.delete(path);
    assert.equal(await read(f, absent ? input : { ...input, contentDigest: '0'.repeat(64) }), null);
    assert.equal(f.reads.length, 1);
  }
});

test('every explicit grant, current identity, repository and Brief curation are required before I/O', async () => {
  for (const removed of principal.toolGrants) {
    const f = fixture(); f.context.principal = { ...principal, toolGrants: principal.toolGrants.filter(grant => grant !== removed) };
    await assert.rejects(read(f), code('FORBIDDEN')); assert.equal(f.reads.length, 0);
  }
  for (const override of [{ organizationId: 'foreign' }, { repository: 'github:foreign' }, { path: 'intent/0001/BRIEF.md' }]) {
    const f = fixture(); await assert.rejects(read(f, { ...input, ...override }), code('FORBIDDEN')); assert.equal(f.reads.length, 0);
  }
  const expired = fixture(); expired.context.revalidate = async () => null;
  await assert.rejects(read(expired), code('UNAUTHENTICATED')); assert.equal(expired.reads.length, 0);
});

test('no configured service or revalidation is unavailable, never empty coverage', async () => {
  for (const change of [{ services: {} }, { revalidate: undefined }]) {
    const f = fixture(); Object.assign(f.context, change);
    await assert.rejects(read(f), code('UNAVAILABLE')); assert.equal(f.reads.length, 0);
  }
});

test('malformed scope, source substitution and caller-provided lifecycle authority cannot widen discovery', async () => {
  for (const change of [{ path: '../BRIEF.md' }, { path: 'items/0190-source-coverage/../BRIEF.md' },
    { revision: 'main' }, { paths: ['private/source.md'] }, { gateVerified: true }, { stage: 'release' }]) {
    const f = fixture(); await assert.rejects(read(f, { ...input, ...change }), code('INVALID_INPUT')); assert.equal(f.reads.length, 0);
  }
  assert.deepEqual(lifecycleArtifactPaths('intent/0001/BRIEF.md').map(ref => ref.path),
    ['intent/0001/SPEC.md', 'intent/0001/EXAM.md', 'intent/0001/PLAN.md']);
});

test('wrong tuples, digest/blob corruption, invalid UTF-8-sized content and private failures discard the whole assessment', async () => {
  const original = source(references[1]!.path);
  for (const changes of [{ organizationId: 'foreign' }, { repository: 'github:foreign' }, { path: references[0]!.path },
    { revision: 'b'.repeat(40) }, { content: 'private corruption' }, { contentDigest: '0'.repeat(64) },
    { blobSha: '0'.repeat(40) }, { content: '界'.repeat(180000) }]) {
    const f = fixture(); f.values.set(references[1]!.path, { ...original, ...changes });
    await assert.rejects(read(f), code('INTERNAL_ERROR')); assert.equal(f.reads.length, 3);
  }
  const f = fixture(); f.service.read = async () => { throw new Error('private source detail'); };
  await assert.rejects(read(f), error => code('INTERNAL_ERROR')(error) && !(error as Error).message.includes('private'));
});

test('revocation, identity switches and expiry after each source read release no partial result', async () => {
  for (let boundary = 1; boundary <= 4; boundary++) for (const current of [null,
    ...principal.toolGrants.map(removed => ({ ...principal, toolGrants: principal.toolGrants.filter(grant => grant !== removed) })),
    { ...principal, subject: 'switched' }, { ...principal, type: 'agent' }, { ...principal, organizationId: 'foreign' },
    { ...principal, expiresAt: now.toISOString() }]) {
    const f = fixture(); f.context.revalidate = async () => f.reads.length >= boundary ? current : principal;
    await assert.rejects(read(f), error => error instanceof ToolError); assert.equal(f.reads.length, boundary);
  }
});

test('final revalidation also covers all-unconfigured results and a clock that has become invalid', async () => {
  const f = fixture(); f.service.scope = { ...scope, paths: [path] }; let calls = 0;
  f.context.revalidate = async () => ++calls >= 9 ? null : principal;
  await assert.rejects(read(f), code('UNAUTHENTICATED')); assert.equal(f.reads.length, 1);
  for (const time of [new Date('invalid'), new Date(now.getTime() - 1), new Date(principal.expiresAt)]) {
    const f = fixture(); f.context.clock = () => f.reads.length ? time : now;
    await assert.rejects(read(f), code('UNAUTHENTICATED')); assert.equal(f.reads.length, 1);
  }
});

test('scoped agents can inspect sources but hats or recorded approval text cannot confer gate authority', async () => {
  const f = fixture(); const agent = { ...principal, type: 'agent' };
  f.context.principal = agent; f.context.revalidate = async () => agent;
  f.values.set(references[0]!.path, source(references[0]!.path, '# Approved\nGate 1 and Gate 2 signed; stage engineer.'));
  assert.equal((await read(f))!.stage, null);
  const hats = { ...agent, hats: ['product-lead'] }; f.context.principal = hats; f.context.revalidate = async () => hats;
  await assert.rejects(read(f), code('UNAUTHENTICATED'));
});

test('shared discovery exposes only the bounded query schema, and output tuples cannot be duplicated or relabelled', async () => {
  const tool = describeTools().find(tool => tool.name === 'intent.brief.artifacts')!;
  assert.equal(tool.kind, 'query'); assert.equal(tool.authorization, 'explicit-tool-grant');
  assert.ok(createOpenApiDocument().paths['/v1/tools/intent.brief.artifacts']);
  const result = (await read(fixture()))!;
  assert.equal(briefArtifactsOutputSchema.safeParse({ ...result, brief: { ...result.brief, path: '../BRIEF.md' } }).success, false);
  for (const artifacts of [[], [...result.artifacts, result.artifacts[0]], [...result.artifacts].reverse(),
    result.artifacts.map(ref => ({ ...ref, status: 'not-configured' })),
    [result.artifacts[0], result.artifacts[0], result.artifacts[2]]]) {
    assert.equal(briefArtifactsOutputSchema.safeParse({ ...result, artifacts }).success, false);
  }
});
