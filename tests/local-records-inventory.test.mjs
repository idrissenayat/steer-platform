import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectLocalRecordsInventory } from '../apps/api/ops/local-records-inventory.mjs';

const known = Array.from({ length: 7 }, (_, index) => ({ tag: `${String(index).padStart(4, '0')}_synthetic`, hash: String(index).repeat(64) }));
const profile = { identity: {} };
function fixture({ applied = known.slice(0, 5), readOnly = 'on', failOn = '' } = {}) {
  const queries = [];
  return { queries, async query(sql) {
    queries.push(sql);
    if (failOn && sql.includes(failOn)) throw new Error('PRIVATE details');
    if (sql === 'SHOW transaction_read_only') return { rows: [{ transaction_read_only: readOnly }] };
    if (sql.startsWith('SELECT hash')) return { rows: applied.map(row => ({ hash: row.hash })) };
    if (sql.includes('pg_stat_replication')) return { rows: [{ active_replicas: 0, replication_slots: 0 }] };
    return { rows: [] };
  } };
}

test('installed migrations are observed separately from the configured boundary with metadata-only reads', async () => {
  const client = fixture(), result = await inspectLocalRecordsInventory(client, known, profile);
  assert.equal(result.migrationCount, 5);
  assert.equal(result.matchesExistingSevenMigrationBoundary, false);
  assert.deepEqual(result.appliedMigrations, known.slice(0, 5).map(row => row.tag));
  assert.equal(result.applicationContentRead, false); assert.equal(result.migrationApplied, false);
  assert.equal(result.providerCalled, false); assert.equal(result.profileHasIntentJourney, false);
  assert.deepEqual(result.operationalRecordTables, []);
  assert.equal(client.queries[0], 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal(client.queries.at(-1), 'ROLLBACK');
  assert.ok(client.queries.every(sql => /^(BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY|SHOW transaction_read_only|SELECT |ROLLBACK)/.test(sql)));
  assert.ok(!client.queries.some(sql => /FROM steer_drafts\.|FROM steer_execution\.|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP/.test(sql)));
});

test('unknown migration hashes are not silently counted as the existing exact boundary', async () => {
  const exact = await inspectLocalRecordsInventory(fixture({ applied: known }), known, profile);
  assert.equal(exact.matchesExistingSevenMigrationBoundary, true);
  const changed = await inspectLocalRecordsInventory(fixture({ applied: [...known.slice(0, 6), { hash: 'f'.repeat(64) }] }), known, profile);
  assert.equal(changed.matchesExistingSevenMigrationBoundary, false);
  assert.equal(changed.appliedMigrations.at(-1), 'unmatched-checkout-hash');
  assert.doesNotMatch(JSON.stringify(changed), /ffff/);
});

test('read-only verification, query or rollback failure withholds results and sanitizes private errors', async () => {
  for (const config of [{ readOnly: 'off' }, { failOn: 'SELECT hash' }, { failOn: 'ROLLBACK' }]) {
    const client = fixture(config);
    await assert.rejects(inspectLocalRecordsInventory(client, known, profile), /^Error: Local records inventory is unavailable\.$/);
    assert.equal(client.queries.at(-1), 'ROLLBACK');
    if (config.readOnly === 'off') assert.equal(client.queries.length, 3);
  }
});

test('an invalid checkout migration inventory fails before database access', async () => {
  const client = fixture();
  for (const invalid of [[], known.slice(0, 5), [...known.slice(0, 6), { tag: '../private', hash: 'a'.repeat(64) }]])
    await assert.rejects(inspectLocalRecordsInventory(client, invalid, profile), /inventory is unavailable/);
  assert.deepEqual(client.queries, []);
});
