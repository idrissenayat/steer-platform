import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { briefPreviewOutputSchema, briefSaveOutputSchema, type Principal } from '@steer/tool-registry';
import { createGitHubReader } from '@steer/adapters/github';
import { createRequestBoundGitHubBriefWriter } from '@steer/adapters/github-brief-writer';
import { fixture, binding, config, ref, now } from '../../../packages/adapters/test/github-brief-fixture.ts';
import { createApi } from '../src/app.ts';
import { createPostgresSessionHarness } from './postgres-session-harness.ts';

// Opt-in, no-network verification of real creation mechanics. Identity and full
// gate authority are explicit TEST DOUBLES, not provider or human approval proof.
// The production held writer and disabled save UI are not changed or bypassed.
async function scenario(t: TestContext, title: string) {
  const source = fixture(t);
  const human: Principal = { subject: ref.subject, organizationId: ref.organizationId, type: 'human', hats: ['product-lead'],
    toolGrants: ['intent.brief.preview', 'intent.brief.save', 'intent.brief.save.status'], expiresAt: new Date(now.getTime() + 600000).toISOString() };
  let current: Principal | null = human, authorityEnabled = true, created = 0, closed = 0;
  const compose = () => createApi({ now: () => now, authenticate: async () => current,
    createBriefWriter: () => {
      created++; let stopped = false;
      const writer = createRequestBoundGitHubBriefWriter(binding, config, {
        issuer: 'https://synthetic.example/issuer', now: () => now, fetch: source.transport, appJwt: async () => 'synthetic-app-jwt',
        authenticate: async () => current ? { issuer: 'https://synthetic.example/issuer', principal: current,
          establishedAt: new Date(now.getTime() - 60000).toISOString(), sessionBinding: '1'.repeat(64) } : null,
        verifyAuthority: async request => {
          if (!authorityEnabled) throw new Error('Synthetic gate authority deliberately unavailable');
          return source.verifyAuthority(request);
        },
      });
      return { ...writer, close: () => { if (!stopped) { stopped = true; closed++; writer.close(); } } };
    },
  });
  let app = compose();
  const call = (tool: string, body: unknown) => app.request(`/v1/tools/${tool}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const draft = { title, problem: 'Coordinators enter requests twice.', outcome: 'Each request is entered once.', users: ['Coordinators'],
    systems: ['Unverified intake system'], constraints: ['No new subscription'], openQuestions: ['Confirm the system name'], successMeasure: 'Duplicate count' };
  const previewResponse = await call('intent.brief.preview', { organizationId: ref.organizationId, draft }); assert.equal(previewResponse.status, 200);
  const preview = briefPreviewOutputSchema.parse(await previewResponse.json());
  assert.deepEqual([preview.saved, preview.confirmed, preview.executionAuthorized], [false, false, false]);
  const { subject: _subject, ...reference } = ref;
  const input = { ...reference, expectedHead: source.head(), draft,
    confirmation: { action: 'accept-rendered-brief', templateVersion: 'steer-brief/v1', contentDigest: preview.contentDigest } };
  const inspect = async () => { const response = await call('intent.brief.save.status', reference); assert.equal(response.status, 200);
    return briefSaveOutputSchema.parse(await response.json()); };
  t.after(() => assert.equal(created, closed, 'Every request-owned writer must close'));
  return { source, preview, input, reference, call, inspect, human,
    reader: createGitHubReader(binding, { fetch: source.transport, appJwt: async () => 'synthetic-app-jwt', now: () => now }),
    reconstruct: () => { app = compose(); }, identify: (identity: Principal | null) => { current = identity; },
    hold: () => { authorityEnabled = false; }, counts: () => ({ created, closed }) };
}

test('actual HTTP-rendered creation, native Git readback and owned PostgreSQL projection form one isolated journey', async t => {
  const f = await scenario(t, 'Actual isolated creation');
  const storage = await createPostgresSessionHarness({ issuer: 'https://synthetic.example/issuer', clientId: 'synthetic', redirectUri: 'https://steer.example/auth/callback' });
  t.after(() => storage.close());
  assert.equal((await f.inspect()).result.outcome, 'not-found');
  const response = await f.call('intent.brief.save', f.input); assert.equal(response.status, 200);
  const saved = briefSaveOutputSchema.parse(await response.json()); assert.equal(saved.gateSigned, false); assert.equal(saved.result.outcome, 'committed');
  if (saved.result.outcome !== 'committed') throw new Error('Expected an isolated native commit');
  const receipt = saved.result;
  assert.equal(receipt.revision, f.source.head()); assert.equal(receipt.contentDigest, f.preview.contentDigest);
  const source = await f.reader.readArtifact(ref.path, receipt.revision);
  assert.equal(source.content, f.preview.markdown); assert.equal(source.blobSha, receipt.blobSha);
  assert.deepEqual(f.source.git(['diff-tree', '--no-commit-id', '--name-only', '-r', receipt.revision]).split('\n'),
    [`.steer/authoring/operations/${ref.idempotencyKey}.json`, ref.path]);
  assert.equal(f.source.mutations(), 1); assert.ok(f.source.approvals() >= 2);
  f.reconstruct(); assert.deepEqual(await f.inspect(), saved);
  const duplicate = await f.call('intent.brief.save', f.input); assert.equal(duplicate.status, 200);
  assert.deepEqual(await duplicate.json(), saved); assert.equal(f.source.mutations(), 1);
  assert.ok(storage.createReceiptProjection);
  const projection = await storage.createReceiptProjection(f.reader, ref.path, receipt.revision, f.inspect);
  try {
    await projection.project(); await projection.project(); assert.equal(f.source.mutations(), 1);
    f.identify({ ...f.human, toolGrants: ['intent.brief.preview', 'intent.brief.save'] });
    const before = f.source.calls.length; await assert.rejects(projection.project()); assert.equal(f.source.calls.length, before);
  } finally { await projection.close(); }
  assert.equal(f.counts().created, f.counts().closed);
});

test('lost creation acknowledgment is recovered through a reconstructed API without another Git mutation', async t => {
  const f = await scenario(t, 'Lost acknowledgment recovery'); f.source.loseAck();
  const response = await f.call('intent.brief.save', f.input); assert.equal(response.status, 200);
  assert.equal(briefSaveOutputSchema.parse(await response.json()).result.outcome, 'unknown'); assert.equal(f.source.mutations(), 1);
  f.reconstruct(); const recovered = await f.inspect(); assert.equal(recovered.result.outcome, 'committed');
  if (recovered.result.outcome !== 'committed') throw new Error('Expected original native commit');
  assert.equal((await f.reader.readArtifact(ref.path, recovered.result.revision)).content, f.preview.markdown);
  const duplicate = await f.call('intent.brief.save', f.input); assert.deepEqual(await duplicate.json(), recovered);
  assert.equal(f.source.mutations(), 1);
});

test('wrong confirmation, current grant denial and unavailable authority cannot create a native commit', async t => {
  const f = await scenario(t, 'Denied creation'); const base = f.source.head();
  const invalid = await f.call('intent.brief.save', { ...f.input, confirmation: { ...f.input.confirmation, contentDigest: '0'.repeat(64) } });
  assert.equal(invalid.status, 422); assert.equal(f.source.calls.length, 0);
  f.identify({ ...f.human, toolGrants: ['intent.brief.preview', 'intent.brief.save.status'] });
  assert.equal((await f.call('intent.brief.save', f.input)).status, 403); assert.equal(f.source.calls.length, 0);
  f.identify({ ...f.human, type: 'agent', hats: [] }); assert.equal((await f.call('intent.brief.save', f.input)).status, 403);
  f.identify(f.human); f.hold(); const held = await f.call('intent.brief.save', f.input); assert.equal(held.status, 503);
  assert.ok(!(await held.text()).includes('Synthetic gate')); assert.equal(f.source.mutations(), 0); assert.equal(f.source.head(), base);
  assert.equal((await f.inspect()).result.outcome, 'not-found');
});
