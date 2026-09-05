import assert from 'node:assert/strict';
import { test } from 'node:test';
import { invokeTool, ToolError, type InvocationContext } from '../src/index.ts';

const now = new Date('2026-09-05T09:00:00Z');
const principal = { subject: 'synthetic', organizationId: 'org-a', type: 'human', hats: [], toolGrants: ['projection.artifact.read'], expiresAt: '2026-09-05T09:01:00Z' };
const input = { organizationId: 'org-a', repository: 'github:1', path: 'BRIEF.md', revision: 'a'.repeat(40) };
const output = { ...input, kind: 'projection', content: 'synthetic', blobSha: 'b'.repeat(40), contentDigest: 'c'.repeat(64) };
const scope = { organizationId: 'org-a', repository: 'github:1', paths: ['BRIEF.md'] };
const context = (): InvocationContext => ({ principal, now, clock: () => now, revalidate: async () => principal,
  services: { artifactProjection: { scope, read: async () => output } } });
const code = (value: string) => (error: unknown) => error instanceof ToolError && error.code === value;

test('async projection query uses the same tenant/grant/schema controls and revalidates before releasing output', async () => {
  let reads = 0; let validations = 0; const ctx = context();
  ctx.services = { artifactProjection: { scope, read: async (request, identity) => { reads++; assert.deepEqual(request, input); assert.equal(identity.subject, principal.subject); return output; } } };
  ctx.revalidate = async () => { validations++; return principal; };
  assert.deepEqual(await invokeTool('projection.artifact.read', input, ctx), output); assert.equal(reads, 1); assert.equal(validations, 1);
  await assert.rejects(invokeTool('projection.artifact.read', { ...input, organizationId: 'org-b' }, ctx), code('FORBIDDEN'));
  await assert.rejects(invokeTool('projection.artifact.read', { ...input, repository: 'github:2' }, ctx), code('FORBIDDEN'));
  await assert.rejects(invokeTool('projection.artifact.read', { ...input, path: 'private.md' }, ctx), code('FORBIDDEN'));
  await assert.rejects(invokeTool('projection.artifact.read', { ...input, revision: 'main' }, ctx), code('INVALID_INPUT'));
  await assert.rejects(invokeTool('projection.artifact.read', { ...input, hats: ['org-admin'] }, ctx), code('INVALID_INPUT'));
  await assert.rejects(invokeTool('projection.artifact.read', input, { ...ctx, principal: { ...principal, toolGrants: [] } }), code('FORBIDDEN'));
  assert.equal(reads, 1);
});

test('revocation, removed grant, identity switch, expiry and clock regression after I/O discard content', async () => {
  for (const current of [null, { ...principal, subject: 'other' }, { ...principal, type: 'agent' }, { ...principal, expiresAt: now.toISOString() }]) {
    await assert.rejects(invokeTool('projection.artifact.read', input, { ...context(), revalidate: async () => current }), code('UNAUTHENTICATED'));
  }
  await assert.rejects(invokeTool('projection.artifact.read', input, { ...context(), revalidate: async () => ({ ...principal, toolGrants: [] }) }), code('FORBIDDEN'));
  for (const clock of [() => new Date(0), () => new Date('invalid'), () => new Date('2026-09-05T09:02:00Z')]) {
    await assert.rejects(invokeTool('projection.artifact.read', input, { ...context(), clock }), code('UNAUTHENTICATED'));
  }
});

test('missing reader/revalidator denies, while errors and mismatched or oversized output are sanitized', async () => {
  const withoutRevalidator = context(); delete withoutRevalidator.revalidate;
  for (const ctx of [{ principal, now }, withoutRevalidator]) await assert.rejects(invokeTool('projection.artifact.read', input, ctx), code('UNAVAILABLE'));
  for (const value of [{ ...output, organizationId: 'org-b' }, { ...output, revision: 'd'.repeat(40) }, { ...output, path: 'other.md' },
    { ...output, privateKey: 'must-not-return' }, { ...output, content: 'x'.repeat(512 * 1024 + 1) }]) {
    await assert.rejects(invokeTool('projection.artifact.read', input, { ...context(), services: { artifactProjection: { scope, read: async () => value } } }), code('INTERNAL_ERROR'));
  }
  await assert.rejects(invokeTool('projection.artifact.read', input, { ...context(), services: { artifactProjection: { scope,
    read: async () => { throw new Error('private-database-detail'); } } } }), code('INTERNAL_ERROR'));
  assert.equal(await invokeTool('projection.artifact.read', input, { ...context(), services: { artifactProjection: { scope, read: async () => null } } }), null);
});
