import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Pool } from 'pg';
import type { Principal } from '@steer/tool-registry';
import { createProjectionChangeReader, projectionCursorSchema } from '../src/projection-changes.ts';

test('projection cursor uses bounded exact decimal positions and strict scoped generation fields', () => {
  const cursor = { organizationId: 'org', repository: 'github:44', generation: '00000000-0000-4000-8000-000000000000', position: '9007199254740993' };
  assert.equal(projectionCursorSchema.parse(cursor).position, '9007199254740993');
  for (const position of ['01', '-1', '1.1', '9223372036854775808', '1e3']) assert.equal(projectionCursorSchema.safeParse({ ...cursor, position }).success, false);
  assert.equal(projectionCursorSchema.safeParse({ ...cursor, approved: true }).success, false);
});
test('invalid feed scope, grant, limits and cursor substitution deny before SQL', async () => {
  let calls = 0; const pool = { connect: async () => { calls++; throw new Error('must not connect'); } } as unknown as Pool;
  const principal: Principal = { subject: 'human', type: 'human', organizationId: 'org', hats: [], toolGrants: ['projection.changes.read'], expiresAt: new Date(Date.now() + 300000).toISOString() };
  const reader = createProjectionChangeReader(pool, { organizationId: 'org', repository: 'github:44' });
  for (const limit of [0, 101, 1.5]) await assert.rejects(reader.read({ cursor: null, limit }, principal));
  for (const changed of [{ ...principal, organizationId: 'other' }, { ...principal, toolGrants: [] }]) await assert.rejects(reader.read({ cursor: null, limit: 1 }, changed), /not allowed/);
  await assert.rejects(reader.read({ cursor: { organizationId: 'org', repository: 'other', generation: '00000000-0000-4000-8000-000000000000', position: '0' }, limit: 1 }, principal), /not allowed/);
  assert.equal(calls, 0);
});
