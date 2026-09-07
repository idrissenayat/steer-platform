import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { createApi } from '../src/app.ts';

test('HTTP overlap query dispatches permitted source review and rejects unauthenticated requests', async () => {
  const scope = { organizationId: 'org', repository: 'github:1' }, path = 'items/0200-booking/BRIEF.md', revision = 'a'.repeat(40);
  const content = '# Clinic\n\nPatients book appointments online.';
  const contentDigest = createHash('sha256').update(content).digest('hex');
  const principal = { subject: 'human', organizationId: 'org', type: 'human', hats: [],
    toolGrants: ['intent.overlap.check', 'intent.brief.catalog', 'intent.brief.read', 'projection.artifact.read'], expiresAt: '2026-09-07T13:00:00Z' };
  const app = createApi({ now: () => new Date('2026-09-07T12:00:00Z'), authenticate: async () => principal,
    services: { artifactProjection: { scope: { ...scope, paths: [path] },
      catalog: async () => [{ path, revision, contentDigest }],
      read: async () => ({ ...scope, path, revision, content, contentDigest, kind: 'projection',
        blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex') }),
    } } });
  const request = () => new Request('https://steer.example/v1/tools/intent.overlap.check', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...scope, intent: 'Patients book appointments online' }),
  });
  const response = await app.fetch(request()); assert.equal(response.status, 200);
  const result = await response.json(); assert.equal(result.kind, 'intent-overlap-candidates');
  assert.equal(result.candidates[0].path, path); assert.equal(result.candidates[0].signal, 'matching-text');
  assert.equal(result.coverage.gaps[0].reason, 'not-configured'); assert.equal(result.authoritativeClearance, false);
  assert.equal((await createApi().fetch(request())).status, 401);
});
