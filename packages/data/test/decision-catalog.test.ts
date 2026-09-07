import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DatabasePool } from '../src/runtime-pool.ts';
import { createArtifactProjectionReader } from '../src/artifact-reader.ts';
import { projectionKey } from '../src/ingestion.ts';
import type { Principal } from '@steer/tool-registry';
const now = new Date('2026-09-07T01:00:00Z');
const principal: Principal = { subject: 'synthetic', organizationId: 'org', type: 'human', hats: [],
  toolGrants: ['intent.brief.decisions', 'intent.brief.read', 'projection.artifact.read'], expiresAt: '2026-09-07T02:00:00Z' };
const brief = 'intent/0001/BRIEF.md', path = 'intent/0001/signatures/gate-1.json';
const binding = { organizationId: 'org', repository: 'github:1', paths: [brief, path, 'intent/0002/signatures/gate-1.json', 'access/authorization.json'] };
const row = { record_key: projectionKey(binding.repository, path), path, source_revision: 'a'.repeat(40), content_digest: 'b'.repeat(64) };
function fixture(rows: unknown[] = [row], role = 'steer_app') {
  const queries: { sql: string; values: unknown }[] = []; let reads = 0;
  return { queries, reads: () => reads, pool: { connect: async () => ({ query: async (sql: string, values: unknown) => {
    queries.push({ sql, values });
    if (sql.includes('current_user AS role')) return { rows: [{ role, login_role: role }] };
    if (sql.includes('FROM steer.projection_records')) { reads++; return { rows }; }
    return { rows: [{ rolname: 'steer_app', rolsuper: false, rolbypassrls: false, owns_objects: false }] };
  }, release() {} }) } as unknown as DatabasePool };
}
test('decision discovery selects only configured sibling keys with bounded parameterized metadata', async () => {
  const f = fixture(); const reader = createArtifactProjectionReader(f.pool, binding, () => now);
  assert.deepEqual(await reader.decisionCatalog!(brief, principal), [{ path, revision: row.source_revision, contentDigest: row.content_digest }]);
  const query = f.queries.find(({ sql }) => sql.includes('FROM steer.projection_records'))!;
  assert.deepEqual(query.values, [binding.organizationId, binding.repository, [row.record_key]]);
  assert.match(query.sql, /LIMIT 4/); assert.match(query.sql, /octet_length/);
});
test('decision discovery rejects grants, foreign scope and agent hats before I/O and restricted-role violations', async () => {
  const reader = createArtifactProjectionReader({ connect: async () => { assert.fail('Must not acquire'); } }, binding, () => now);
  for (const removed of principal.toolGrants) await assert.rejects(reader.decisionCatalog!(brief, { ...principal, toolGrants: principal.toolGrants.filter(grant => grant !== removed) }));
  await assert.rejects(reader.decisionCatalog!('BRIEF.md', principal));
  await assert.rejects(reader.decisionCatalog!(brief, { ...principal, organizationId: 'foreign' }));
  await assert.rejects(reader.decisionCatalog!(brief, { ...principal, type: 'agent', hats: ['product-lead'] }));
  const f = fixture([row], 'postgres');
  await assert.rejects(createArtifactProjectionReader(f.pool, binding, () => now).decisionCatalog!(brief, principal)); assert.equal(f.reads(), 0);
});
test('corrupt/duplicate/unconfigured metadata and expiry after read cannot leave discovery', async () => {
  for (const rows of [[{ ...row, record_key: 'other' }], [{ ...row, path: 'intent/0002/signatures/gate-1.json' }],
    [{ ...row, source_revision: null }], [row, row], Array(4).fill(row)])
    await assert.rejects(createArtifactProjectionReader(fixture(rows).pool, binding, () => now).decisionCatalog!(brief, principal));
  const f = fixture(); await assert.rejects(createArtifactProjectionReader(f.pool, binding,
    () => f.reads() ? new Date(principal.expiresAt) : now).decisionCatalog!(brief, principal));
  assert.deepEqual(await createArtifactProjectionReader(fixture([]).pool, binding, () => now).decisionCatalog!(brief, principal), []);
});
