import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { invokeTool, ToolError, type InvocationContext, type ArtifactProjectionReader } from '../src/index.ts';

const now = new Date('2026-09-05T15:40:00Z');
const principal = { subject: 'synthetic', organizationId: 'org', type: 'human', hats: [],
  toolGrants: ['intent.brief.read', 'projection.artifact.read'], expiresAt: new Date(now.getTime() + 300000).toISOString() };
const content = '# Brief: Scoped outcome\r\n\r\nAuthor: unverified\r\n\r\n## Problem\r\n\r\nPrivate source text.\r\n';
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const blob = (text: string) => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const input = { organizationId: 'org', repository: 'github:51', path: 'intent/0051/BRIEF.md', revision: 'a'.repeat(40), contentDigest: digest(content) };
const artifact = { ...input, kind: 'projection', content, blobSha: blob(content) };
const reader = (): ArtifactProjectionReader => ({ scope: { organizationId: input.organizationId, repository: input.repository, paths: [input.path] }, read: async () => artifact });
const context = (service = reader()): InvocationContext => ({ principal, now, clock: () => now, revalidate: async () => principal, services: { artifactProjection: service } });
const code = (value: string) => (error: unknown) => error instanceof ToolError && error.code === value;

test('Brief reads preserve exact source and parsed structure with independently checked fingerprints', async () => {
  const result = await invokeTool('intent.brief.read', input, context()); assert.ok(result);
  assert.equal(result.kind, 'brief-projection'); assert.equal(result.content, content); assert.equal(result.document.title, 'Scoped outcome');
  assert.equal(result.contentDigest, digest(content)); assert.equal(result.blobSha, blob(content));
  assert.equal(result.document.sections[0]!.markdown, '\r\nPrivate source text.\r\n');
  assert.ok(result.document.issues.some((issue) => issue.code === 'missing-section'));
  assert.ok(!('author' in result.document)); assert.ok(!('status' in result.document));
});
test('both explicit grants, current identity, curated scope and Brief paths are required before source I/O', async () => {
  let reads = 0; const service = reader(); service.read = async () => { reads++; return artifact; };
  for (const toolGrants of [[], ['intent.brief.read'], ['projection.artifact.read']]) {
    await assert.rejects(invokeTool('intent.brief.read', input, { ...context(service), principal: { ...principal, toolGrants } }), code('FORBIDDEN'));
  }
  for (const change of [{ organizationId: 'foreign' }, { repository: 'github:other' }, { path: 'intent/9999/BRIEF.md' }]) {
    await assert.rejects(invokeTool('intent.brief.read', { ...input, ...change }, context(service)), code('FORBIDDEN'));
  }
  for (const change of [{ path: 'EXAM.md' }, { path: 'access/authorization.json' }, { path: '../BRIEF.md' },
    { path: 'intent/item/BRIEF.md' }, { path: 'intent/0001/brief.md' }, { hats: [] }, { contentDigest: 'invalid' }]) {
    await assert.rejects(invokeTool('intent.brief.read', { ...input, ...change }, context(service)), code('INVALID_INPUT'));
  }
  await assert.rejects(invokeTool('intent.brief.read', input, { ...context(service), revalidate: async () => null }), code('UNAUTHENTICATED'));
  await assert.rejects(invokeTool('intent.brief.read', input, { ...context(service), principal: { ...principal, type: 'agent', hats: ['product-lead'] } }), code('UNAUTHENTICATED'));
  assert.equal(reads, 0);
});
test('absence and selected revision/digest mismatch return null without inventing a Brief', async () => {
  const service = reader(); service.read = async () => null;
  assert.equal(await invokeTool('intent.brief.read', input, context(service)), null);
  assert.equal(await invokeTool('intent.brief.read', { ...input, contentDigest: '0'.repeat(64) }, context()), null);
  // The underlying exact-revision reader returns null for unavailable revisions.
  assert.equal(await invokeTool('intent.brief.read', { ...input, revision: 'b'.repeat(40) }, context(service)), null);
  await assert.rejects(invokeTool('intent.brief.read', input, { principal, now }), code('UNAVAILABLE'));
});
test('tampered content, blob/digest claims, scope or malformed Brief source never leave the tool', async () => {
  for (const value of [{ ...artifact, content: 'replaced private text' }, { ...artifact, contentDigest: '0'.repeat(64) },
    { ...artifact, blobSha: '0'.repeat(40) }, { ...artifact, path: 'BRIEF.md' }, { ...artifact, revision: 'b'.repeat(40) },
    { ...artifact, content: '\0', contentDigest: digest('\0'), blobSha: blob('\0') },
    { ...artifact, providerSecret: 'secret' }]) {
    const service = reader(); service.read = async () => value;
    await assert.rejects(invokeTool('intent.brief.read', { ...input, contentDigest: value.contentDigest }, context(service)), code('INTERNAL_ERROR'));
  }
  const service = reader(); service.read = async () => { throw new Error(content); };
  await assert.rejects(invokeTool('intent.brief.read', input, context(service)), (error: unknown) => code('INTERNAL_ERROR')(error) && !(error as Error).message.includes('Private'));
});
test('revocation of either grant during or after reading and identity/clock changes discard results', async () => {
  for (const toolGrants of [[], ['intent.brief.read'], ['projection.artifact.read']]) {
    let reads = 0; const service = reader(); service.read = async () => { reads++; return artifact; };
    await assert.rejects(invokeTool('intent.brief.read', input, { ...context(service),
      revalidate: async () => reads ? { ...principal, toolGrants } : principal }), code('FORBIDDEN'));
    assert.equal(reads, 1);
  }
  // Post-parse authority check must include the raw-content grant too.
  let checks = 0;
  await assert.rejects(invokeTool('intent.brief.read', input, { ...context(), revalidate: async () =>
    ++checks === 3 ? { ...principal, toolGrants: ['intent.brief.read'] } : principal }), code('FORBIDDEN'));
  for (const current of [null, { ...principal, subject: 'switched' }, { ...principal, type: 'agent' },
    { ...principal, expiresAt: now.toISOString() }]) {
    await assert.rejects(invokeTool('intent.brief.read', input, { ...context(), revalidate: async () => current }), code('UNAUTHENTICATED'));
  }
  await assert.rejects(invokeTool('intent.brief.read', input, { ...context(), clock: () => new Date(now.getTime() - 1) }), code('UNAUTHENTICATED'));
});
