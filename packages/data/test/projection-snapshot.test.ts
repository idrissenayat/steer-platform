import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Pool } from 'pg';
import type { Principal } from '@steer/tool-registry';
import { createProjectionSnapshotReader } from '../src/projection-snapshot.ts';

test('projection snapshot scope and explicit grant deny before acquiring the database', async () => {
  let calls = 0; const pool = { connect: async () => { calls++; throw new Error('must not connect'); } } as unknown as Pool;
  const principal: Principal = { subject: 'human', organizationId: 'org', type: 'human', hats: [], toolGrants: ['projection.snapshot.read'], expiresAt: new Date(Date.now() + 300000).toISOString() };
  const reader = createProjectionSnapshotReader(pool, { organizationId: 'org', repository: 'github:44' });
  for (const input of [{ ...principal, organizationId: 'foreign' }, { ...principal, toolGrants: ['projection.changes.read'] }]) {
    await assert.rejects(reader.read(input), /not allowed/);
  }
  assert.equal(calls, 0);
});
