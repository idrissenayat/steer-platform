import assert from 'node:assert/strict';
import { briefPreviewOutputSchema, briefSaveOutputSchema, type Principal, type ToolServices } from '@steer/tool-registry';
import { createGitHubReader } from '@steer/adapters/github';
import { createRequestBoundGitHubBriefWriter } from '@steer/adapters/github-brief-writer';
import { fixture, binding, config, ref, now } from '../../../packages/adapters/test/github-brief-fixture.ts';
import { createApi } from '../src/app.ts';

/** Actual HTTP/native Git mechanics; synthetic identity and full gate authority, never live configuration. */
export async function createBriefCreationScenario(t: { after(run: () => void): void }, title: string, services?: ToolServices) {
  const source = fixture(t);
  const human: Principal = { subject: ref.subject, organizationId: ref.organizationId, type: 'human', hats: ['product-lead'],
    toolGrants: ['intent.brief.preview', 'intent.brief.save', 'intent.brief.save.status', 'intent.brief.catalog', 'intent.brief.read', 'projection.artifact.read'],
    expiresAt: new Date(now.getTime() + 600000).toISOString() };
  let current: Principal | null = human, authorityEnabled = true, created = 0, closed = 0;
  const compose = () => createApi({ now: () => now, authenticate: async () => current, ...(services ? { services } : {}),
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
