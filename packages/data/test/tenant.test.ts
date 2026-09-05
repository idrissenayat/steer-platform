import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Pool } from 'pg';
import { withTenant } from '../src/index.ts';
import { DatabaseCommitOutcomeUnknownError } from '../src/runtime-pool.ts';
import type { Principal } from '@steer/tool-registry';

const now = new Date('2026-09-04T12:00:00Z');
const principal: Principal = { subject: 'human-1', organizationId: 'org-a', type: 'human', hats: [], toolGrants: [], expiresAt: '2026-09-04T12:01:00Z' };

test('invalid or expired identities are denied before acquiring a connection', async () => {
  const pool = { connect: () => { throw new Error('must-not-connect'); } } as unknown as Pool;
  for (const identity of [null, {}, { ...principal, expiresAt: now.toISOString() }]) {
    await assert.rejects(withTenant(pool, identity as Principal, async () => null, () => now), /current tenant identity/);
  }
});

test('tenant context is transaction-local and the connection is released after commit', async () => {
  const calls: unknown[] = [];
  const client = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push([sql.trim(), values]);
      return { rows: [{ rolname: 'steer_app', rolsuper: false, rolbypassrls: false, owns_objects: false }] };
    }, release: (broken: boolean) => calls.push(['release', broken]),
  };
  const pool = { connect: async () => client } as unknown as Pool;
  assert.equal(await withTenant(pool, principal, async () => 'value', () => now), 'value');
  assert.deepEqual(calls[4], ["SELECT set_config('steer.organization_id', $1, true)", ['org-a']]);
  assert.deepEqual(calls.slice(-3), [['COMMIT', undefined], ["SELECT set_config('steer.organization_id', '', false)", undefined], ['release', false]]);
});

test('unsafe runtime roles deny before callback and rollback failures destroy the connection', async () => {
  for (const role of [
    { rolname: 'postgres', rolsuper: true, rolbypassrls: true, owns_objects: true },
    { rolname: 'steer_app', rolsuper: false, rolbypassrls: true, owns_objects: false },
    { rolname: 'steer_app', rolsuper: false, rolbypassrls: false, owns_objects: true },
  ]) {
    let ran = false;
    let released: boolean | undefined;
    const pool = { connect: async () => ({
      query: async (sql: string) => { if (sql === 'ROLLBACK') throw new Error('broken'); return { rows: [role] }; },
      release: (broken: boolean) => { released = broken; },
    }) } as unknown as Pool;
    await assert.rejects(withTenant(pool, principal, async () => { ran = true; }, () => now), /Unsafe runtime/);
    assert.equal(ran, false); assert.equal(released, true);
  }
});

test('principal expiry while waiting for the pool denies before operation execution', async () => {
  let clockCalls = 0;
  let ran = false;
  let rolledBack = false;
  const pool = { connect: async () => ({
    query: async (sql: string) => {
      if (sql === 'ROLLBACK') rolledBack = true;
      return { rows: [{ rolname: 'steer_app', rolsuper: false, rolbypassrls: false, owns_objects: false }] };
    }, release: () => {},
  }) } as unknown as Pool;
  await assert.rejects(withTenant(pool, principal, async () => { ran = true; },
    () => new Date(now.getTime() + (clockCalls++ ? 120000 : 0))), /current tenant identity/);
  assert.equal(ran, false); assert.equal(rolledBack, true);
});

test('post-commit cleanup failure evicts the connection without misreporting the committed result', async () => {
  let committed = false;
  let evicted = false;
  const pool = { connect: async () => ({
    query: async (sql: string) => {
      if (committed) throw new Error('connection lost after commit');
      if (sql === 'COMMIT') committed = true;
      return { rows: [{ rolname: 'steer_app', rolsuper: false, rolbypassrls: false, owns_objects: false }] };
    }, release: (broken: boolean) => { evicted = broken; },
  }) } as unknown as Pool;
  assert.equal(await withTenant(pool, principal, async () => 'committed result', () => now), 'committed result');
  assert.equal(evicted, true);
});

test('a failed COMMIT acknowledgement is explicitly unknown, never replayed or reported as a rollback', async () => {
  let operations = 0; let commits = 0;
  const pool = { connect: async () => ({ query: async (sql: string) => {
    if (sql === 'COMMIT') { commits++; throw new Error('private-connection-detail'); }
    return { rows: [{ rolname: 'steer_app', rolsuper: false, rolbypassrls: false, owns_objects: false }] };
  }, release: () => {} }) } as unknown as Pool;
  await assert.rejects(withTenant(pool, principal, async () => { operations++; }, () => now), DatabaseCommitOutcomeUnknownError);
  assert.equal(operations, 1); assert.equal(commits, 1);
});
