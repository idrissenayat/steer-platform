import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DatabasePool } from '../src/runtime-pool.ts';
import { createArtifactProjectionReader } from '../src/artifact-reader.ts';
import { projectionKey } from '../src/ingestion.ts';
import type { Principal } from '@steer/tool-registry';
const now = new Date('2026-09-05T16:00:00Z');
const principal: Principal = { subject: 'synthetic', organizationId: 'org', type: 'human', hats: [],
  toolGrants: ['intent.brief.catalog', 'intent.brief.read', 'projection.artifact.read'], expiresAt: '2026-09-05T16:05:00Z' };
const binding = { organizationId: 'org', repository: 'github:52', paths: ['BRIEF.md', 'SPEC.md'] };
const row = { record_key: projectionKey(binding.repository, 'BRIEF.md'), path: 'BRIEF.md', source_revision: 'a'.repeat(40), content_digest: 'b'.repeat(64) };
function fixture(rows: unknown[] = [row], role = 'steer_app') {
  const queries: { sql: string; values: unknown }[] = []; let reads = 0;
  return { queries, reads: () => reads, pool: { connect: async () => ({ query: async (sql: string, values: unknown) => {
    queries.push({ sql, values });
    if (sql.includes('current_user AS role')) return { rows: [{ role, login_role: role }] };
    if (sql.includes('FROM steer.projection_records')) { reads++; return { rows }; }
    return { rows: [{ rolname: 'steer_app', rolsuper: false, rolbypassrls: false, owns_objects: false }] };
  }, release() {} }) } as unknown as DatabasePool };
}
test('catalog sends only curated Brief keys through one bounded parameterized metadata query', async () => {
  const f = fixture(); const reader = createArtifactProjectionReader(f.pool, binding, () => now);
  assert.deepEqual(await reader.catalog!(principal), [{ path: row.path, revision: row.source_revision, contentDigest: row.content_digest }]);
  const query = f.queries.find(({ sql }) => sql.includes('FROM steer.projection_records'))!;
  assert.deepEqual(query.values, [binding.organizationId, binding.repository, [row.record_key]]);
  assert.match(query.sql, /record_key=ANY\(\$3::text\[\]\)/); assert.match(query.sql, /LIMIT 1001/);
  assert.match(query.sql, /octet_length\(value->>'path'\)<=500/); assert.equal(f.reads(), 1);
});
test('catalog refuses foreign/missing/agent-hat authority before acquisition and non-app roles before reading', async () => {
  const absent = { connect: async () => { assert.fail('Must not acquire'); } };
  const reader = createArtifactProjectionReader(absent, binding, () => now);
  for (const changed of [{ ...principal, organizationId: 'other' }, { ...principal, toolGrants: [] }, { ...principal, type: 'agent' as const, hats: ['product-lead' as const] }]) {
    await assert.rejects(reader.catalog!(changed));
  }
  const f = fixture([row], 'steer_projector');
  await assert.rejects(createArtifactProjectionReader(f.pool, binding, () => now).catalog!(principal), /Unsafe projection reader role/); assert.equal(f.reads(), 0);
});
test('catalog rejects key/path substitution, malformed/oversized/duplicate data, and expiry after reading', async () => {
  for (const rows of [[{ ...row, record_key: 'other' }], [{ ...row, path: 'intent/0001/BRIEF.md' }], [{ ...row, source_revision: null }],
    [{ ...row, content_digest: 'invalid' }], [row, row], Array(1001).fill(row)]) {
    await assert.rejects(createArtifactProjectionReader(fixture(rows).pool, binding, () => now).catalog!(principal));
  }
  const f = fixture();
  await assert.rejects(createArtifactProjectionReader(f.pool, binding, () => f.reads() ? new Date(principal.expiresAt) : now).catalog!(principal), /current tenant identity/);
  assert.deepEqual(await createArtifactProjectionReader(fixture([]).pool, binding, () => now).catalog!(principal), []);
});
