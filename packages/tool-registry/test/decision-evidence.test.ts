import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { invokeTool, ToolError, type ArtifactProjectionReader, type InvocationContext } from '../src/index.ts';

const now = new Date('2026-09-07T02:00:00Z');
const principal = { subject: 'synthetic', organizationId: 'org', type: 'human', hats: [],
  toolGrants: ['intent.brief.decision.evidence', 'intent.brief.decisions', 'intent.brief.read', 'projection.artifact.read'], expiresAt: '2026-09-07T03:00:00Z' };
const scope = { organizationId: 'org', repository: 'github:1' };
const artifact = (path: string, revision: string, content: string) => ({ ...scope, kind: 'projection', path, revision, content,
  contentDigest: createHash('sha256').update(content).digest('hex'), blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex') });
const brief = artifact('intent/0001/BRIEF.md', 'a'.repeat(40), '# Brief: Synthetic\n');
const evidence = artifact('intent/0001/EXAM.md', 'a'.repeat(40), '# Synthetic evidence\r\n\r\n<script>inert source</script>\r\n');
const claims = { version: 'steer-gate-signature/v1', organization: 'recorded', productHome: 'https://example.invalid', item: 'synthetic', gate: 1,
  decision: 'approved', artifactRevision: brief.revision, artifacts: [{ path: brief.path, revision: brief.revision }, { path: evidence.path, revision: evidence.revision }],
  signatures: [{ subject: 'unverified', hat: 'product-lead', sequence: 1, signedAt: now.toISOString() }] };
const decision = artifact('intent/0001/signatures/gate-1.json', 'b'.repeat(40), JSON.stringify(claims));
const reference = { path: decision.path, revision: decision.revision, contentDigest: decision.contentDigest };
const input = { ...scope, path: brief.path, revision: brief.revision, contentDigest: brief.contentDigest,
  decision: reference, evidence: { path: evidence.path, revision: evidence.revision } };
function fixture() {
  const reads: string[] = [];
  const service: ArtifactProjectionReader = { scope: { ...scope, paths: [brief.path, decision.path, evidence.path, 'other.md'] },
    decisionCatalog: async () => [reference], read: async value => {
      reads.push(value.path); return value.path === brief.path ? brief : value.path === decision.path ? decision : evidence;
    } };
  const context: InvocationContext = { principal, now, clock: () => now, revalidate: async () => principal, services: { artifactProjection: service } };
  return { service, context, reads };
}
const code = (value: string) => (error: unknown) => error instanceof ToolError && error.code === value;

test('evidence inspection returns original bytes and all exact context without gate or write authority', async () => {
  const f = fixture(); const result = await invokeTool('intent.brief.decision.evidence', input, f.context); assert.ok(result);
  assert.deepEqual(result.artifact, evidence); assert.deepEqual(result.decision, reference);
  assert.equal(result.brief.revision, brief.revision); assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
  assert.deepEqual(f.reads, [brief.path, decision.path, evidence.path]);
});
test('all grants, exact tenant, configured paths and strict input are required before evidence disclosure', async () => {
  const f = fixture();
  for (const removed of principal.toolGrants) await assert.rejects(invokeTool('intent.brief.decision.evidence', input,
    { ...f.context, principal: { ...principal, toolGrants: principal.toolGrants.filter(grant => grant !== removed) } }), code('FORBIDDEN'));
  for (const change of [{ organizationId: 'foreign' }, { repository: 'github:foreign' }, { evidence: { ...input.evidence, path: 'unconfigured.md' } }])
    await assert.rejects(invokeTool('intent.brief.decision.evidence', { ...input, ...change }, f.context), code('FORBIDDEN'));
  for (const change of [{ approval: true }, { evidence: { ...input.evidence, path: '../EXAM.md' } }, { decision: { ...reference, contentDigest: 'invalid' } }])
    await assert.rejects(invokeTool('intent.brief.decision.evidence', { ...input, ...change }, f.context), code('INVALID_INPUT'));
  assert.deepEqual(f.reads, []);
});
test('current decision must list the requested exact artifact; arbitrary curated paths and revised targets do not dispatch', async () => {
  for (const value of [{ path: 'other.md', revision: evidence.revision }, { ...input.evidence, revision: 'c'.repeat(40) }]) {
    const f = fixture(); await assert.rejects(invokeTool('intent.brief.decision.evidence', { ...input, evidence: value }, f.context), code('FORBIDDEN'));
    assert.deepEqual(f.reads, [brief.path, decision.path]);
  }
});
test('stale Brief/decision or unavailable exact evidence returns null without substituting another source', async () => {
  for (const change of [{ contentDigest: '0'.repeat(64) }, { decision: { ...reference, revision: 'c'.repeat(40) } },
    { decision: { ...reference, contentDigest: '0'.repeat(64) } }]) {
    const f = fixture(); assert.equal(await invokeTool('intent.brief.decision.evidence', { ...input, ...change }, f.context), null);
    assert.ok(!f.reads.includes(evidence.path));
  }
  const f = fixture(); const original = f.service.read; f.service.read = async (value, principal) => value.path === evidence.path ? null : original(value, principal);
  assert.equal(await invokeTool('intent.brief.decision.evidence', input, f.context), null);
});
test('corrupt, foreign, oversized or substituted evidence cannot escape as a partial result', async () => {
  for (const value of [{ ...evidence, content: 'private corruption' }, { ...evidence, blobSha: '0'.repeat(40) }, { ...evidence, repository: 'github:other' },
    { ...evidence, revision: 'c'.repeat(40) }, { ...evidence, content: 'x'.repeat(512 * 1024 + 1) }, { ...evidence, secret: 'private' }]) {
    const f = fixture(); const original = f.service.read; f.service.read = async (input, principal) => input.path === evidence.path ? value : original(input, principal);
    await assert.rejects(invokeTool('intent.brief.decision.evidence', input, f.context), error => code('INTERNAL_ERROR')(error) && !(error as Error).message.includes('private'));
  }
});
test('post-evidence revocation, identity switch and expiry discard content including absent results', async () => {
  for (const current of principal.toolGrants.map(removed => ({ ...principal, toolGrants: principal.toolGrants.filter(grant => grant !== removed) }))
    .concat([{ ...principal, subject: 'switched' }, { ...principal, expiresAt: now.toISOString() }])) {
    const f = fixture(); f.context.revalidate = async () => f.reads.includes(evidence.path) ? current : principal;
    await assert.rejects(invokeTool('intent.brief.decision.evidence', input, f.context), error => error instanceof ToolError);
  }
  const f = fixture(); let absent = false; const original = f.service.read;
  f.service.read = async (value, principal) => { if (value.path === evidence.path) { absent = true; return null; } return original(value, principal); };
  f.context.revalidate = async () => absent ? null : principal;
  await assert.rejects(invokeTool('intent.brief.decision.evidence', input, f.context), code('UNAUTHENTICATED'));
});
