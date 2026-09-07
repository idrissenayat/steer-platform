import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createIdentityRuntime } from '../src/runtime.ts';
import { heldRuntimeFixture } from './held-runtime-fixture.ts';
import { selectChain } from '../../../packages/adapters/test/gate-selection-fixture.ts';
import { identifySelection } from '../../../packages/adapters/test/gate-selector-identity-fixture.ts';

const draft = { title: 'Held runtime draft', problem: 'Duplicate entry', outcome: 'Enter once', users: ['Coordinators'], systems: ['Unverified intake system'], constraints: ['No new subscription'], openQuestions: ['Confirm the system name'], successMeasure: 'Duplicate count' };
const request = (name: string, input: unknown, token: string) => new Request(`https://steer.example/v1/tools/${name}`, {
  method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(input),
});

test('held runtime binds a native whole-selection manifest and retains only fingerprints without granting a save', async t => {
  const f = await heldRuntimeFixture(t, false, { organizationId: 'synthetic-org', issuer: 'https://identity.synthetic.invalid', subject: 'synthetic-runtime-human' }), selected = selectChain(f);
  const runtime = await createIdentityRuntime({ ...f.profile, heldBrief: { ...f.profile.heldBrief, policy: selected.configuration } }, f.secrets, f.ports);
  t.after(() => runtime.shutdown()); const input = await saveInput(runtime, f);
  assert.equal((await runtime.fetch(request('intent.brief.save', input, f.token))).status, 503);
  const assessment = runtime.status().heldBrief!.lastAssessment; assert.ok(assessment?.selectionSource);
  assert.equal(assessment.policyOutcome, 'policy-satisfied');
  assert.equal(assessment.selectionSource.path, selected.reference.path); assert.equal(assessment.selectionSource.revision, f.state.head);
  assert.equal(assessment.selectionSource.contentDigest, selected.reference.digest);
  assert.equal('content' in assessment.selectionSource, false); assert.equal(assessment.writeAuthorized, false); assert.equal(assessment.gateVerified, false);
  assert.ok(assessment.missing.includes('governed-selection-unverified')); assert.ok(assessment.missing.includes('review-provenance-unverified'));
  assert.equal(f.io.writes, 0);
  f.sources.set(selected.reference.path, JSON.stringify({ ...selected.document, branch: 'foreign' })); f.commit();
  assert.equal((await runtime.fetch(request('intent.brief.save', { ...input, expectedHead: f.state.head }, f.token))).status, 503);
  assert.equal(runtime.status().heldBrief!.lastAssessment, null); assert.equal(f.io.writes, 0);
});
test('held HTTP runtime joins selector session and grant evidence without a success callback or identity disclosure', async t => {
  const f = await heldRuntimeFixture(t), selected = identifySelection(f, 'agent');
  const profile = () => ({ ...f.profile, heldBrief: { ...f.profile.heldBrief, policy: selected.configuration } });
  const runtime = await createIdentityRuntime(profile(), f.secrets, f.ports); t.after(() => runtime.shutdown());
  const input = await saveInput(runtime, f), before = f.state.head;
  const response = await runtime.fetch(request('intent.brief.save', input, f.token)); assert.equal(response.status, 503);
  const text = await response.text(); assert.equal(text.includes(selected.identity.payload.sessionId), false);
  assert.equal(text.includes(selected.reference.proof.digest), false);
  const assessment = runtime.status().heldBrief!.lastAssessment; assert.ok(assessment);
  assert.equal(assessment.policyOutcome, 'policy-satisfied'); assert.equal(assessment.sourceRevision, before);
  assert.deepEqual(assessment.missing, ['governed-selection-unverified', 'review-provenance-unverified', 'action-time-authority-incomplete']);
  assert.equal('selectorIdentity' in assessment, false); assert.equal('selectorAuthorization' in assessment, false);
  assert.equal(assessment.writeAuthorized, false); assert.equal(assessment.gateVerified, false); assert.equal(f.io.writes, 0);
  assert.equal(f.git('rev-parse', 'HEAD'), before);
  assert.equal(f.git('ls-tree', '-r', '--name-only', 'HEAD', '--', input.path, '.steer/authoring/operations'), '');
  selected.grant.active = false; selected.publishGrant();
  assert.equal((await runtime.fetch(request('intent.brief.save', { ...input, expectedHead: f.state.head }, f.token))).status, 503);
  assert.equal(runtime.status().heldBrief!.lastAssessment, null); await runtime.shutdown();
  selected.grant.active = true; selected.publishGrant();
  selected.identity.trust.revokedAt = new Date(Date.now()).toISOString(); selected.publishIdentity();
  const restored = await createIdentityRuntime(profile(), f.secrets, f.ports); t.after(() => restored.shutdown());
  assert.equal((await restored.fetch(request('intent.brief.save', { ...input, expectedHead: f.state.head }, f.token))).status, 503);
  assert.equal(restored.status().heldBrief!.lastAssessment, null); assert.equal(f.io.writes, 0);
  assert.equal(restored.status().database.connections, 0);
});

async function saveInput(runtime: Awaited<ReturnType<typeof createIdentityRuntime>>, f: Awaited<ReturnType<typeof heldRuntimeFixture>>) {
  const preview = await runtime.fetch(request('intent.brief.preview', { organizationId: f.grant.organizationId, draft }, f.token)); assert.equal(preview.status, 200);
  const value = await preview.json() as { contentDigest: string };
  return { organizationId: f.grant.organizationId, repository: 'github:1', branch: 'synthetic', path: f.profile.heldBrief.writer.paths[0]!,
    idempotencyKey: '00000000-0000-4000-8000-000000000169', expectedHead: f.state.head, draft,
    confirmation: { action: 'accept-rendered-brief', templateVersion: 'steer-brief/v1', contentDigest: value.contentDigest } };
}

for (const blocked of [false, true]) test(`held runtime connects current OIDC/Git and complete policy collection but denies mutation: policy blocked=${blocked}`, async t => {
  const f = await heldRuntimeFixture(t, blocked), runtime = await createIdentityRuntime(f.profile, f.secrets, f.ports); t.after(() => runtime.shutdown());
  assert.equal(f.io.reads + f.io.tokens + f.io.observerCalls + f.io.jwks, 0);
  assert.deepEqual(runtime.status().heldBrief, { gateVerified: false, writeAuthorized: false, lastAssessment: null });
  const input = await saveInput(runtime, f), before = f.state.head;
  assert.equal((await runtime.fetch(request('intent.brief.save', input, f.token))).status, 503);
  const observation = runtime.status().heldBrief!.lastAssessment; assert.ok(observation);
  assert.equal(observation.sourceRevision, before); assert.equal(observation.policyOutcome, blocked ? 'blocked' : 'policy-satisfied');
  assert.equal(observation.missing.includes('policy-blocked'), blocked);
  for (const missing of ['governed-selection-unverified', 'review-provenance-unverified', 'action-time-authority-incomplete'] as const) assert.ok(observation.missing.includes(missing));
  assert.equal(observation.writeAuthorized, false); assert.equal(observation.gateVerified, false); assert.ok(Object.isFrozen(observation));
  assert.ok(f.io.reads > 0 && f.io.tokens > 0 && f.io.jwks > 0 && f.io.observerCalls > 0); assert.equal(f.io.writes, 0);
  assert.equal(f.git('rev-parse', 'HEAD'), before); assert.equal(f.git('ls-tree', '-r', '--name-only', 'HEAD', '--', input.path, '.steer/authoring/operations'), '');
  assert.equal(runtime.status().database.connections, 0); // This bearer journey must not open browser storage.
  const { expectedHead: _head, draft: _draft, confirmation: _confirmation, ...reference } = input;
  const status = await runtime.fetch(request('intent.brief.save.status', reference, f.token)); assert.equal(status.status, 200);
  assert.equal(((await status.json()) as { result: { outcome: string } }).result.outcome, 'not-found');
  assert.equal(runtime.status().heldBrief!.lastAssessment, null);
  const observer = f.state.identity; f.state.identity = null;
  assert.equal((await runtime.fetch(request('intent.brief.save', input, f.token))).status, 503); assert.equal(runtime.status().heldBrief!.lastAssessment, null);
  f.state.identity = observer; f.io.failRead = true;
  assert.equal((await runtime.fetch(request('intent.brief.save', input, f.token))).status, 401); assert.equal(f.io.writes, 0);
  await runtime.shutdown(); assert.equal(runtime.status().heldBrief!.lastAssessment, null); assert.equal(runtime.status().database.closed, true);
});

test('held runtime configuration is explicit, source-bound and startup-lazy with no observer fallback', async t => {
  const f = await heldRuntimeFixture(t), { heldBrief, ...base } = f.profile;
  for (const [profile, ports] of [
    [f.profile, { github: f.ports.github }], [base, f.ports],
    [{ ...f.profile, heldBrief: { ...heldBrief, writeAuthorized: true } }, f.ports],
    [{ ...f.profile, heldBrief: { ...heldBrief, writer: { ...heldBrief.writer, platformRevision: 'f'.repeat(40) } } }, f.ports],
    [{ ...f.profile, heldBrief: { ...heldBrief, policy: { gates: [] } } }, f.ports],
    ...[f.profile.github.authorizationPath, heldBrief.writer.paths[0]!].map(path => [
      { ...f.profile, heldBrief: { ...heldBrief, policy: { ...heldBrief.policy, selection: { path, digest: 'f'.repeat(64) } } } }, f.ports,
    ] as const),
    [f.profile, { ...f.ports, authenticateGateObserver: 'human' }],
  ] as const) await assert.rejects(createIdentityRuntime(profile, f.secrets, ports as Parameters<typeof createIdentityRuntime>[2]), /configuration could not be initialized/);
  assert.equal(f.io.reads + f.io.tokens + f.io.observerCalls + f.io.jwks, 0);
  const runtime = await createIdentityRuntime(base, f.secrets, { github: f.ports.github, identity: f.ports.identity });
  try { assert.equal(runtime.status().heldBrief, undefined); assert.equal(runtime.status().database.connections, 0); }
  finally { await runtime.shutdown(); }
});

test('held runtime shutdown drains pending source assessment and cannot retain it or admit another request', async t => {
  const f = await heldRuntimeFixture(t);
  let enter!: () => void, release!: () => void;
  const entered = new Promise<void>(resolve => { enter = resolve; }), pending = new Promise<void>(resolve => { release = resolve; });
  const runtime = await createIdentityRuntime(f.profile, f.secrets, { ...f.ports, authenticateGateObserver: async () => { enter(); await pending; return f.state.identity; } });
  t.after(async () => { release(); await runtime.shutdown(); });
  const input = await saveInput(runtime, f), operation = runtime.fetch(request('intent.brief.save', input, f.token));
  await Promise.race([entered, operation.then(() => { throw new Error('Held request finished before reaching its observer.'); })]);
  let finished = false; const shutdown = runtime.shutdown().then(() => { finished = true; });
  assert.equal(runtime.status().state, 'draining'); assert.equal(finished, false); assert.equal(runtime.status().heldBrief!.lastAssessment, null);
  release(); assert.equal((await operation).status, 503); await shutdown;
  assert.equal(runtime.status().state, 'stopped'); assert.equal(runtime.status().database.closed, true); assert.equal(runtime.status().heldBrief!.lastAssessment, null);
  const reads = f.io.reads; assert.equal((await runtime.fetch(request('intent.brief.save', input, f.token))).status, 503);
  assert.equal(f.io.reads, reads); assert.equal(f.io.writes, 0);
});
