import assert from 'node:assert/strict';
import { test } from 'node:test';
import { invokeTool, ToolError, type InvocationContext, type ArtifactProjectionReader } from '../src/index.ts';
const now = new Date('2026-09-05T16:00:00Z');
const principal = { subject: 'synthetic', organizationId: 'org', type: 'human', hats: [],
  toolGrants: ['intent.brief.catalog', 'intent.brief.read', 'projection.artifact.read'], expiresAt: '2026-09-05T16:05:00Z' };
const input = { organizationId: 'org', repository: 'github:52' };
const record = { path: 'BRIEF.md', revision: 'a'.repeat(40), contentDigest: 'b'.repeat(64) };
const reader = (): ArtifactProjectionReader => ({ scope: { ...input, paths: ['BRIEF.md', 'intent/0001/BRIEF.md', 'SPEC.md'] },
  read: async () => { throw new Error('Catalog must not read content'); }, catalog: async () => [{ ...record, path: 'intent/0001/BRIEF.md' }, record] });
const context = (service = reader()): InvocationContext => ({ principal, now, clock: () => now, revalidate: async () => principal, services: { artifactProjection: service } });
const code = (value: string) => (error: unknown) => error instanceof ToolError && error.code === value;

test('catalog returns stable ordered curated references only, and empty is not fabricated content', async () => {
  const result = await invokeTool('intent.brief.catalog', input, context());
  assert.deepEqual(result, { ...input, kind: 'brief-catalog', records: [record, { ...record, path: 'intent/0001/BRIEF.md' }] });
  const service = reader(); service.catalog = async () => [];
  assert.deepEqual((await invokeTool('intent.brief.catalog', input, context(service))).records, []);
});
test('catalog requires all three grants, exact scope and current identity before metadata I/O', async () => {
  let reads = 0; const service = reader(); service.catalog = async () => { reads++; return []; };
  for (const missing of principal.toolGrants) {
    await assert.rejects(invokeTool('intent.brief.catalog', input, { ...context(service), principal: { ...principal, toolGrants: principal.toolGrants.filter((grant) => grant !== missing) } }), code('FORBIDDEN'));
  }
  for (const value of [{ ...input, organizationId: 'other' }, { ...input, repository: 'github:other' }]) await assert.rejects(invokeTool('intent.brief.catalog', value, context(service)), code('FORBIDDEN'));
  await assert.rejects(invokeTool('intent.brief.catalog', { ...input, paths: ['private'] }, context(service)), code('INVALID_INPUT'));
  await assert.rejects(invokeTool('intent.brief.catalog', input, { ...context(service), revalidate: async () => null }), code('UNAUTHENTICATED'));
  assert.equal(reads, 0);
});
test('invalid, duplicate, uncurated and oversized catalogs fail as a whole without private fields', async () => {
  for (const records of [[record, record], [{ ...record, path: 'intent/9999/BRIEF.md' }], [{ ...record, path: 'SPEC.md' }],
    [{ ...record, content: 'private' }], [{ ...record, revision: 'invalid' }], Array(1001).fill(record)]) {
    const service = reader(); service.catalog = async () => records;
    await assert.rejects(invokeTool('intent.brief.catalog', input, context(service)), code('INTERNAL_ERROR'));
  }
});
test('missing capability and read failures stay generic; post-read revocation discards even empty catalogs', async () => {
  const service = reader(); delete service.catalog;
  await assert.rejects(invokeTool('intent.brief.catalog', input, context(service)), code('UNAVAILABLE'));
  service.catalog = async () => { throw new Error('private source'); };
  await assert.rejects(invokeTool('intent.brief.catalog', input, context(service)), code('INTERNAL_ERROR'));
  let read = false; service.catalog = async () => { read = true; return []; };
  await assert.rejects(invokeTool('intent.brief.catalog', input, { ...context(service), revalidate: async () => read ? null : principal }), code('UNAUTHENTICATED'));
});
