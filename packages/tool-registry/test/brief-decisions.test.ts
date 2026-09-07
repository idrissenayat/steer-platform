import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { invokeTool, ToolError, decisionPaths, type ArtifactProjectionReader, type InvocationContext } from '../src/index.ts';

const now = new Date('2026-09-07T01:00:00Z');
const principal = { subject: 'synthetic', organizationId: 'org', type: 'human', hats: [],
  toolGrants: ['intent.brief.decisions', 'intent.brief.read', 'projection.artifact.read'], expiresAt: '2026-09-07T02:00:00Z' };
const fingerprint = (content: string) => ({ content, contentDigest: createHash('sha256').update(content).digest('hex'),
  blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex') });
const scope = { organizationId: 'org', repository: 'github:1' };
const brief = { ...scope, kind: 'projection', path: 'intent/0001/BRIEF.md', revision: 'a'.repeat(40), ...fingerprint('# Brief: Synthetic\n') };
const input = { ...scope, path: brief.path, revision: brief.revision, contentDigest: brief.contentDigest };
const claims = { version: 'steer-gate-signature/v1', organization: 'recorded-org', productHome: 'https://example.invalid', item: 'synthetic',
  gate: 1, decision: 'approved', artifactRevision: brief.revision, artifacts: [{ path: brief.path, revision: brief.revision }],
  signatures: [{ subject: 'unverified', hat: 'product-lead', sequence: 1, signedAt: now.toISOString() }] };
const record = (value: unknown = claims) => ({ ...scope, kind: 'projection', path: decisionPaths(brief.path)[0]!, revision: 'b'.repeat(40), ...fingerprint(JSON.stringify(value)) });
const fixture = (artifact = record()) => {
  let reads = 0, catalogs = 0;
  const service: ArtifactProjectionReader = { scope: { ...scope, paths: [brief.path, ...decisionPaths(brief.path)] },
    decisionCatalog: async () => { catalogs++; return [{ path: artifact.path, revision: artifact.revision, contentDigest: artifact.contentDigest }]; },
    read: async value => { reads++; return value.path === brief.path ? brief : artifact; } };
  const context: InvocationContext = { principal, now, clock: () => now, revalidate: async () => principal, services: { artifactProjection: service } };
  return { service, context, counts: () => ({ reads, catalogs }) };
};
const code = (value: string) => (error: unknown) => error instanceof ToolError && error.code === value;

test('exact decision source preserves extensions, bounded claims and linkage without authority', async () => {
  const source = record({ ...claims, additionalSource: 'not interpreted' });
  const result = await invokeTool('intent.brief.decisions', input, fixture(source).context); assert.ok(result);
  assert.deepEqual(result.brief, input); assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
  assert.equal(result.records[0]!.content, source.content); assert.equal(result.records[0]!.revision, source.revision);
  assert.equal(result.records[0]!.briefLinked, true); assert.deepEqual(result.records[0]!.claims, claims);
  const mismatch = await invokeTool('intent.brief.decisions', input, fixture(record({ ...claims, artifacts: [{ path: brief.path, revision: 'c'.repeat(40) }] })).context);
  assert.equal(mismatch!.records[0]!.briefLinked, false, 'artifactRevision alone cannot establish coverage');
});
test('all grants, scope, identity and configured service are required before decision source reads', async () => {
  const f = fixture();
  for (const removed of principal.toolGrants) await assert.rejects(invokeTool('intent.brief.decisions', input,
    { ...f.context, principal: { ...principal, toolGrants: principal.toolGrants.filter(grant => grant !== removed) } }), code('FORBIDDEN'));
  for (const changes of [{ organizationId: 'foreign' }, { repository: 'github:foreign' }, { path: 'intent/0002/BRIEF.md' }])
    await assert.rejects(invokeTool('intent.brief.decisions', { ...input, ...changes }, f.context), code('FORBIDDEN'));
  await assert.rejects(invokeTool('intent.brief.decisions', input, { ...f.context, revalidate: async () => null }), code('UNAUTHENTICATED'));
  await assert.rejects(invokeTool('intent.brief.decisions', input, { ...f.context, services: {} }), code('UNAVAILABLE'));
  assert.deepEqual(f.counts(), { reads: 0, catalogs: 0 });
});
test('absent exact Brief returns null and unconfigured decision selection is empty, not proof of no decisions', async () => {
  const f = fixture(); f.service.read = async () => null;
  assert.equal(await invokeTool('intent.brief.decisions', input, f.context), null); assert.equal(f.counts().catalogs, 0);
  const empty = fixture(); empty.service.decisionCatalog = async () => [];
  assert.deepEqual((await invokeTool('intent.brief.decisions', input, empty.context))!.records, []);
  assert.equal(await invokeTool('intent.brief.decisions', { ...input, contentDigest: '0'.repeat(64) }, fixture().context), null);
});
test('duplicate, foreign, unconfigured and disappearing selections never return partial data', async () => {
  const reference = { path: record().path, revision: record().revision, contentDigest: record().contentDigest };
  for (const references of [[reference, reference], [{ ...reference, path: 'access/authorization.json' }], Array(4).fill(reference)]) {
    const f = fixture(); f.service.decisionCatalog = async () => references;
    await assert.rejects(invokeTool('intent.brief.decisions', input, f.context), code('INTERNAL_ERROR'));
  }
  const unconfigured = fixture(); unconfigured.service = { ...unconfigured.service, scope: { ...scope, paths: [brief.path] } };
  await assert.rejects(invokeTool('intent.brief.decisions', input, { ...unconfigured.context, services: { artifactProjection: unconfigured.service } }), code('INTERNAL_ERROR'));
  const absent = fixture(); absent.service.read = async value => value.path === brief.path ? brief : null;
  await assert.rejects(invokeTool('intent.brief.decisions', input, absent.context), code('UNAVAILABLE'));
});
test('corruption, wrong gate, malformed/bounded claims and excessive source fail with sanitized errors', async () => {
  for (const artifact of [{ ...record(), content: 'private corruption' }, { ...record(), blobSha: '0'.repeat(40) },
    record({ ...claims, gate: 2 }), record({ ...claims, signatures: [] }), record({ ...claims, artifacts: [{ path: '../BRIEF.md', revision: brief.revision }] }),
    record({ ...claims, extension: 'x'.repeat(32768) }), { ...record(), ...fingerprint('invalid private JSON') }]) {
    await assert.rejects(invokeTool('intent.brief.decisions', input, fixture(artifact).context), error =>
      code('INTERNAL_ERROR')(error) && !(error as Error).message.includes('private'));
  }
});
test('grant revocation, identity switch and expiry during record I/O discard the whole result', async () => {
  for (const current of [{ ...principal, toolGrants: principal.toolGrants.slice(1) }, { ...principal, subject: 'changed' },
    { ...principal, expiresAt: now.toISOString() }]) {
    const f = fixture(); f.context.revalidate = async () => f.counts().reads >= 2 ? current : principal;
    await assert.rejects(invokeTool('intent.brief.decisions', input, f.context), error => error instanceof ToolError);
  }
  const f = fixture(); let catalogued = false; f.service.decisionCatalog = async () => { catalogued = true; return []; };
  f.context.revalidate = async () => catalogued ? { ...principal, toolGrants: [] } : principal;
  await assert.rejects(invokeTool('intent.brief.decisions', input, f.context));
});
