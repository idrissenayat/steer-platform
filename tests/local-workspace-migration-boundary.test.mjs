import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { assertLocalMigrationBoundary } from '../apps/api/ops/local-migration-boundary.mjs';

const journal = JSON.parse(readFileSync(new URL('../packages/data/migrations/meta/_journal.json', import.meta.url), 'utf8'));
test('new execution migrations cannot silently expand the real local database baseline', () => {
  assert.doesNotThrow(() => assertLocalMigrationBoundary({ ...journal, entries: journal.entries.slice(0, 7) }));
  assert.throws(() => assertLocalMigrationBoundary(journal), /Local migration is held/);
  for (const entries of [journal.entries.slice(0, 6), [...journal.entries.slice(0, 7)].reverse(),
    journal.entries.slice(0, 7).map((entry, i) => i === 6 ? { ...entry, tag: 'unadopted' } : entry)])
    assert.throws(() => assertLocalMigrationBoundary({ ...journal, entries }), /Local migration is held/);
});
test('migration-set preflight precedes real private-state reads and administrative database creation', () => {
  const source = readFileSync(new URL('../apps/api/ops/local-workspace.mjs', import.meta.url), 'utf8');
  const guard = source.indexOf("if (action === 'migrate') assertLocalMigrationBoundary");
  assert.ok(guard > 0 && guard < source.indexOf('privateDirectory(directory);'));
  assert.ok(guard < source.indexOf('const secrets = JSON.parse(privateRead'));
  assert.ok(guard < source.indexOf('const pool = new pg.Pool'));
});
