import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { invokeTool, describeTools, type InvocationContext, type ArtifactProjectionReader } from '../src/index.ts';
const now = new Date('2026-09-07T12:00:00Z');
const principal = { subject: 'human', organizationId: 'org', type: 'human', hats: [],
  toolGrants: ['intent.overlap.check', 'intent.brief.catalog', 'intent.brief.read', 'projection.artifact.read'], expiresAt: '2026-09-07T13:00:00Z' };
const scope = { organizationId: 'org', repository: 'github:1' }, revision = 'a'.repeat(40);
const path = 'items/0199-booking/BRIEF.md', specPath = 'items/0199-booking/SPEC.md';
const input = { ...scope, intent: 'Patients book appointments online and receive reminders' };
function source(path: string, content: string) {
  return { ...scope, path, revision, content, kind: 'projection' as const,
    contentDigest: createHash('sha256').update(content).digest('hex'),
    blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex') };
}
function fixture() {
  const brief = source(path, '# Patient portal\n\nPatients book appointments online.');
  const spec = source(specPath, '# Notifications\n\nPatients book appointments online and receive reminders.');
  const values = new Map([[path, brief], [specPath, spec]]); const reads: string[] = [];
  const records = [{ path, revision, contentDigest: brief.contentDigest }];
  const service = { scope: { ...scope, paths: [path, specPath] },
    read: async input => { reads.push(input.path); return values.get(input.path) ?? null; }, catalog: async () => records } satisfies ArtifactProjectionReader;
  const context: InvocationContext = { principal, now, clock: () => now, revalidate: async () => principal, services: { artifactProjection: service } };
  return { service, context, reads, values, records, brief, spec };
}
const check = (f: ReturnType<typeof fixture>) => invokeTool('intent.overlap.check', input, f.context);

test('inspects permitted Brief and Spec at exact revision and returns explained candidates, never clearance', async () => {
  const f = fixture(), result = await check(f);
  assert.deepEqual(f.reads, [path, specPath]); assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0]!.document, 'SPEC'); assert.equal(result.candidates[0]!.signal, 'matching-text');
  assert.equal(result.candidates[1]!.signal, 'shared-terms'); assert.match(result.candidates[0]!.excerpt, /receive reminders/);
  assert.ok(result.candidates.every(item => item.revision === revision && item.briefPath === path));
  assert.equal(result.authoritativeClearance, false); assert.equal(result.semanticReviewComplete, false);
  assert.equal(result.coverage.inspectedDocuments, 2); assert.equal(result.coverage.scanLimited, false);
  assert.equal(describeTools().find(tool => tool.name === 'intent.overlap.check')?.kind, 'query');
});
test('fingerprints bind original input, catalog and inspected Spec content', async () => {
  const f = fixture(), before = await check(f); assert.deepEqual(await check(f), before);
  f.values.set(specPath, source(specPath, '# Changed scope\nAppointments without reminders'));
  const after = await check(f); assert.equal(after.catalogFingerprint, before.catalogFingerprint);
  assert.notEqual(after.reviewFingerprint, before.reviewFingerprint);
  const different = await invokeTool('intent.overlap.check', { ...input, intent: input.intent + '.' }, f.context);
  assert.notEqual(after.sourceDigest, different.sourceDigest);
});
test('empty and unrelated results never mean the proposed intent is new', async () => {
  const f = fixture(); f.service.catalog = async () => [];
  const empty = await check(f); assert.equal(empty.coverage.catalogCount, 0); assert.deepEqual(empty.candidates, []);
  assert.equal(empty.authoritativeClearance, false);
  const unrelated = await invokeTool('intent.overlap.check', { ...input, intent: 'Monitor garden soil moisture' }, fixture().context);
  assert.deepEqual(unrelated.candidates, []); assert.equal(unrelated.semanticReviewComplete, false);
});
test('missing and unconfigured sources are explicit gaps, not absent scope or silent success', async () => {
  const f = fixture(); f.values.delete(path); f.service.scope = { ...scope, paths: [path] };
  const result = await check(f);
  assert.deepEqual(result.coverage.gaps, [{ path, reason: 'not-projected' }, { path: specPath, reason: 'not-configured' }]);
  assert.equal(result.coverage.inspectedDocuments, 0); assert.equal(result.authoritativeClearance, false);
  assert.deepEqual(f.reads, [path]);
});
test('all explicit read grants, tenant and repository scope are required before I/O', async () => {
  const f = fixture(); let catalogs = 0; f.service.catalog = async () => { catalogs++; return f.records; };
  for (const removed of principal.toolGrants) await assert.rejects(invokeTool('intent.overlap.check', input, {
    ...f.context, principal: { ...principal, toolGrants: principal.toolGrants.filter(grant => grant !== removed) },
  }), { code: 'FORBIDDEN' });
  for (const change of [{ organizationId: 'other' }, { repository: 'github:other' }]) await assert.rejects(invokeTool('intent.overlap.check', { ...input, ...change }, f.context), { code: 'FORBIDDEN' });
  assert.equal(catalogs, 0); assert.deepEqual(f.reads, []);
});
test('malformed source, digest corruption, wrong revision and private reader errors reject the whole review', async () => {
  for (const change of [{ contentDigest: '0'.repeat(64) }, { blobSha: '0'.repeat(40) }, { revision: 'b'.repeat(40) }, { organizationId: 'other' }]) {
    const f = fixture(); f.values.set(specPath, { ...f.spec, ...change });
    await assert.rejects(check(f), { code: 'INTERNAL_ERROR' });
  }
  const f = fixture(); f.service.read = async () => { throw new Error('private artifact content'); };
  await assert.rejects(check(f), (error: Error) => !error.message.includes('private artifact'));
});
test('revocation during reading and concurrent catalog change release no review', async () => {
  const f = fixture(); f.context.revalidate = async () => f.reads.length ? { ...principal, toolGrants: [] } : principal;
  await assert.rejects(check(f), { code: 'FORBIDDEN' });
  const changed = fixture(); let calls = 0;
  changed.service.catalog = async () => ++calls === 1 ? changed.records : [];
  await assert.rejects(check(changed), { code: 'UNAVAILABLE' });
});
test('scan and display limits are visible, deterministic and not permission to create', async () => {
  const f = fixture();
  const records = Array.from({ length: 51 }, (_, i) => {
    const briefPath = `items/${String(i + 1000)}-booking/BRIEF.md`, specPath = briefPath.replace('BRIEF.md', 'SPEC.md');
    const brief = source(briefPath, input.intent), spec = source(specPath, input.intent);
    f.values.set(briefPath, brief); f.values.set(specPath, spec);
    return { path: briefPath, revision, contentDigest: brief.contentDigest };
  });
  f.service.scope = { ...scope, paths: [...f.values.keys()] }; f.service.catalog = async () => records;
  const result = await check(f); assert.equal(result.coverage.scanLimited, true); assert.equal(result.coverage.inspectedIntents, 50);
  assert.equal(result.coverage.inspectedDocuments, 100); assert.equal(result.coverage.candidateCount, 100);
  assert.equal(result.coverage.resultsTruncated, true); assert.equal(result.candidates.length, 10);
  assert.equal(result.authoritativeClearance, false); assert.equal(f.reads.length, 100);
});
test('unavailable service and extra source paths do not bypass the curated catalog', async () => {
  await assert.rejects(invokeTool('intent.overlap.check', input, { ...fixture().context, services: {} }), { code: 'UNAVAILABLE' });
  await assert.rejects(invokeTool('intent.overlap.check', { ...input, paths: ['private.md'] }, fixture().context), { code: 'INVALID_INPUT' });
});
test('total content budget stops the scan with explicit incomplete coverage', async () => {
  const f = fixture(); const records: typeof f.records = [];
  for (let i = 0; i < 6; i++) {
    const briefPath = `items/${2000 + i}-large/BRIEF.md`, specPath = briefPath.replace('BRIEF.md', 'SPEC.md');
    const content = 'x'.repeat(512 * 1024);
    const brief = source(briefPath, content); f.values.set(briefPath, brief); f.values.set(specPath, source(specPath, content));
    records.push({ path: briefPath, revision, contentDigest: brief.contentDigest });
  }
  f.service.catalog = async () => records; f.service.scope = { ...scope, paths: [...f.values.keys()] };
  const result = await check(f); assert.equal(result.coverage.scanLimited, true);
  assert.equal(result.coverage.inspectedDocuments, 8); assert.equal(f.reads.length, 9);
  assert.equal(result.authoritativeClearance, false);
});
