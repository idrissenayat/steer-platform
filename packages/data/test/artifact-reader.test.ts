import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import type { DatabasePool } from '../src/runtime-pool.ts';
import { createArtifactProjectionReader } from '../src/artifact-reader.ts';
import type { Principal } from '@steer/tool-registry';

const now = new Date('2026-09-05T09:00:00Z');
const principal: Principal = { subject: 'synthetic', organizationId: 'org-a', type: 'human', hats: [], toolGrants: ['projection.artifact.read'], expiresAt: '2026-09-05T09:01:00Z' };
const input = { organizationId: 'org-a', repository: 'github:1', path: 'BRIEF.md', revision: 'a'.repeat(40) };
const binding = { organizationId: 'org-a', repository: 'github:1', paths: ['BRIEF.md'] };
const content = 'synthetic';
const row = { organization_id: 'org-a', repository: 'github:1', source_revision: input.revision,
  content_digest: createHash('sha256').update(content).digest('hex'), value: { path: 'BRIEF.md', content,
    blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex') } };
function pool(value: unknown = row, login = 'steer_app') {
  let releases = 0; const queries: string[] = [];
  return { queries, releases: () => releases, value: { connect: async () => ({ query: async (sql: string) => {
    queries.push(sql);
    if (sql.includes('current_user AS role')) return { rows: [{ role: 'steer_app', login_role: login }] };
    if (sql.includes('FROM steer.projection_records')) return { rows: value === null ? [] : [value] };
    return { rows: [{ rolname: 'steer_app', rolsuper: false, rolbypassrls: false, owns_objects: false }] };
  }, release: () => { releases++; } }) } as unknown as DatabasePool };
}

test('projection reader validates scope before acquisition and uses restricted app role', async () => {
  const absent = { connect: async () => { assert.fail('Must not acquire'); } };
  const reader = createArtifactProjectionReader(absent, binding, () => now);
  for (const changed of [{ ...input, organizationId: 'org-b' }, { ...input, repository: 'github:2' }, { ...input, path: 'private.md' }])
    await assert.rejects(reader.read(changed, principal));
  await assert.rejects(reader.read(input, { ...principal, toolGrants: [] }));
  assert.throws(() => createArtifactProjectionReader(absent, { ...binding, paths: ['BRIEF.md', 'BRIEF.md'] }));
  const admin = pool(row, 'postgres'); await assert.rejects(createArtifactProjectionReader(admin.value, binding, () => now).read(input, principal), /Unsafe projection reader role/);
  assert.equal(admin.releases(), 1);
});

test('projection output is exact-revision and self-consistent; absent/stale rows return null', async () => {
  const fixture = pool(); const value = await createArtifactProjectionReader(fixture.value, binding, () => now).read(input, principal);
  assert.deepEqual(value, { ...input, kind: 'projection', content, blobSha: row.value.blobSha, contentDigest: row.content_digest });
  assert.equal(fixture.releases(), 1); assert.ok(fixture.queries.some((sql) => sql.includes('CASE WHEN octet_length')));
  for (const value of [null, { ...row, source_revision: 'b'.repeat(40) }]) {
    assert.equal(await createArtifactProjectionReader(pool(value).value, binding, () => now).read(input, principal), null);
  }
  for (const value of [{ ...row, content_digest: '0'.repeat(64) }, { ...row, repository: 'github:2' },
    { ...row, value: { ...row.value, blobSha: '0'.repeat(40) } }, { ...row, value: { ...row.value, path: 'other.md' } }]) {
    await assert.rejects(createArtifactProjectionReader(pool(value).value, binding, () => now).read(input, principal));
  }
});
