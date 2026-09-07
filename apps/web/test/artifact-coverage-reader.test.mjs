import assert from 'node:assert/strict';
import test from 'node:test';
import { createArtifactCoverageReader } from '../app/artifact-coverage-reader.ts';

const brief = { organizationId: 'org', repository: 'github:1', path: 'items/0191-support/BRIEF.md', revision: 'a'.repeat(40), contentDigest: 'b'.repeat(64) };
const output = { kind: 'brief-artifact-coverage', brief, stage: null, gateVerified: false, writeAuthorized: false,
  artifacts: ['spec', 'exam', 'plan'].map((kind, index) => ({ kind, path: `items/0191-support/${kind.toUpperCase()}.md`,
    status: ['projected', 'not-projected', 'not-configured'][index],
    fingerprint: index === 0 ? { blobSha: 'c'.repeat(40), contentDigest: 'd'.repeat(64) } : null })) };
const origin = 'https://steer.example';
function fixture() {
  const state = { now: 1000, value: output, status: 200 }, calls = [];
  const input = { ...brief };
  const reader = createArtifactCoverageReader(input, origin, new Date(10000).toISOString(), async (url, init) => {
    calls.push({ url, init }); return state.status === 200 ? Response.json(state.value) : new Response(null, { status: state.status });
  }, () => state.now);
  return { state, calls, input, reader };
}

test('explicit source check fixes the Brief tuple and uses only the bounded same-origin read endpoint', async () => {
  const f = fixture(); assert.equal(f.reader.view().phase, 'idle'); assert.equal(f.calls.length, 0);
  f.input.revision = 'e'.repeat(40);
  const result = await f.reader.read(); assert.equal(result.phase, 'ready'); assert.deepEqual(result.result, output);
  assert.equal(f.calls.length, 1); const { url, init } = f.calls[0];
  assert.equal(url, `${origin}/v1/tools/intent.brief.artifacts`); assert.deepEqual(JSON.parse(init.body), brief);
  assert.equal(init.credentials, 'same-origin'); assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'error');
  assert.equal(init.referrerPolicy, 'no-referrer'); assert.ok(!JSON.stringify(init.headers).includes('Bearer'));
  result.result.artifacts[0].fingerprint.contentDigest = 'e'.repeat(64);
  assert.equal(f.reader.view().result.artifacts[0].fingerprint.contentDigest, 'd'.repeat(64)); f.reader.close();
});

test('unavailable Brief and all-unconfigured sources remain distinct from failure or approval', async () => {
  const f = fixture(); f.state.value = null; assert.deepEqual(await f.reader.read(), { phase: 'unavailable', result: null });
  f.state.value = { ...output, artifacts: output.artifacts.map(ref => ({ ...ref, status: 'not-configured', fingerprint: null })) };
  const result = await f.reader.read(); assert.equal(result.phase, 'ready'); assert.equal(result.result.stage, null);
  assert.equal(result.result.gateVerified, false); assert.equal(result.result.writeAuthorized, false); f.reader.close();
});

test('foreign or stale source tuples, malformed entries and fabricated authority discard prior results', async () => {
  const invalid = [
    ...Object.keys(brief).map(key => ({ ...output, brief: { ...brief, [key]: key === 'revision' ? 'e'.repeat(40) : key === 'contentDigest' ? 'e'.repeat(64) : 'foreign' } })),
    { ...output, stage: 'engineer' }, { ...output, gateVerified: true }, { ...output, writeAuthorized: true },
    { ...output, artifacts: [] }, { ...output, artifacts: [...output.artifacts].reverse() },
    { ...output, artifacts: output.artifacts.map(ref => ({ ...ref, content: 'private text' })) },
    { ...output, artifacts: output.artifacts.map(ref => ({ ...ref, fingerprint: null })) },
    { ...output, artifacts: [{ ...output.artifacts[0], path: '../SPEC.md' }, ...output.artifacts.slice(1)] },
  ];
  for (const value of invalid) {
    const f = fixture(); await f.reader.read(); f.state.value = value;
    assert.deepEqual(await f.reader.read(), { phase: 'failed', result: null }); f.reader.close();
  }
});

test('current denial or transport failure clears previous metadata, and explicit retry can recover', async () => {
  for (const status of [401, 403, 422, 500, 503]) {
    const f = fixture(); await f.reader.read(); f.state.status = status;
    assert.deepEqual(await f.reader.read(), { phase: 'failed', result: null });
    f.state.status = 200; assert.equal((await f.reader.read()).phase, 'ready'); f.reader.close();
  }
  let calls = 0;
  const reader = createArtifactCoverageReader(brief, 'http://foreign.invalid', new Date(10000).toISOString(), async () => { calls++; throw new Error('private'); }, () => 1000);
  assert.deepEqual(await reader.read(), { phase: 'failed', result: null }); assert.equal(calls, 0); reader.close();
});

test('expiry and backward or invalid clocks permanently remove metadata without another network request', async () => {
  for (const now of [10000, 999, NaN]) {
    const f = fixture(); await f.reader.read(); f.state.now = now;
    assert.deepEqual(f.reader.view(), { phase: 'expired', result: null }); f.state.now = 1001;
    assert.equal((await f.reader.read()).phase, 'expired'); assert.equal(f.calls.length, 1); f.reader.close();
  }
  let calls = 0;
  const reader = createArtifactCoverageReader(brief, origin, 'invalid', async () => { calls++; }, () => 1000);
  assert.equal((await reader.read()).phase, 'expired'); assert.equal(calls, 0); reader.close();
});

test('clear, close and expiry during an in-flight read prevent late publication and duplicate reads', async () => {
  for (const action of ['clear', 'close', 'expire']) {
    let release, now = 1000, calls = 0;
    const held = new Promise(resolve => { release = resolve; });
    const reader = createArtifactCoverageReader(brief, origin, new Date(10000).toISOString(), async () => {
      calls++; await held; return Response.json(output);
    }, () => now);
    const pending = reader.read(); assert.equal(reader.view().phase, 'loading'); await reader.read(); assert.equal(calls, 1);
    if (action === 'expire') now = 10000; else reader[action](); release(); await pending;
    assert.equal(reader.view().result, null);
    assert.equal(reader.view().phase, action === 'clear' ? 'idle' : action === 'close' ? 'closed' : 'expired');
    await reader.read(); assert.equal(calls, action === 'clear' ? 2 : 1); reader.close();
  }
});

test('an aborted old request cannot overwrite a newly requested result', async () => {
  let release, calls = 0;
  const held = new Promise(resolve => { release = resolve; });
  const reader = createArtifactCoverageReader(brief, origin, new Date(10000).toISOString(), async () => {
    if (++calls === 1) { await held; return Response.json(null); } return Response.json(output);
  }, () => 1000);
  const stale = reader.read(); reader.clear(); await reader.read(); release(); await stale;
  assert.equal(reader.view().phase, 'ready'); assert.deepEqual(reader.view().result, output); reader.close();
});
