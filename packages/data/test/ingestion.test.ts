import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import type { Principal } from '@steer/tool-registry';
import { ingestVerifiedArtifact, projectionKey } from '../src/ingestion.ts';

const bytes = Buffer.from('synthetic source');
const source = { organizationId: 'org-a', repository: 'github:2', path: 'items/1/BRIEF.md', revision: 'a'.repeat(40),
  content: bytes.toString(), contentDigest: createHash('sha256').update(bytes).digest('hex'),
  blobSha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') };
const agent: Principal = { subject: 'projector-1', organizationId: 'org-a', type: 'agent', hats: [], toolGrants: ['projection.ingest'], expiresAt: new Date(Date.now() + 300000).toISOString() };

test('projection keys are deterministic, repository-scoped and safe for arbitrary source paths', () => {
  assert.equal(projectionKey('github:2', 'a/b'), projectionKey('github:2', 'a/b'));
  assert.notEqual(projectionKey('github:2', 'a/b'), projectionKey('github:3', 'a/b'));
  assert.match(projectionKey('github:2', 'a/b'), /^artifact:[a-f0-9]{64}$/);
});

test('bad integrity, wrong tenant, human identity and missing grant deny before acquiring SQL connection', async () => {
  let connections = 0;
  const pool = { connect: async () => { connections++; throw new Error('must-not-connect'); } } as unknown as Pool;
  for (const principal of [{ ...agent, type: 'human' as const }, { ...agent, toolGrants: [] }, { ...agent, organizationId: 'org-b' }]) {
    await assert.rejects(ingestVerifiedArtifact(pool, principal, source, null), /unauthorized source/);
  }
  for (const value of [{ ...source, content: 'changed' }, { ...source, blobSha: 'b'.repeat(40) }]) {
    await assert.rejects(ingestVerifiedArtifact(pool, agent, value, null), /Unverified/);
  }
  await assert.rejects(ingestVerifiedArtifact(pool, agent, { ...source, path: '../other' }, null));
  assert.equal(connections, 0);
});
