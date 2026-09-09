import assert from 'node:assert/strict';
import test from 'node:test';
import { createIntentScopeTransport } from '../app/intent-scope-transport.ts';
import { scopeEditorFixture } from './intent-scope.fixture.ts';

test('historical transport uses only the history query and refuses current or changed evidence', async () => {
  const f=await scopeEditorFixture();let calls=0;
  const t=createIntentScopeTransport('https://steer.example',async(url,init)=>{
    calls++;assert.ok(String(url).endsWith('/intent.scope.history'));assert.deepEqual(JSON.parse(String(init?.body)),f.readInput);
    assert.equal(init?.credentials,'same-origin');return Response.json(f.history);
  });
  assert.deepEqual(await t.history(f.readInput),f.history);assert.equal(calls,1);t.close();await assert.rejects(t.history(f.readInput));
  for(const output of [f.ready,{...f.history,reviewId:f.scope.draftId},{...f.history,inventory:[]},{...f.history,executionAuthorized:true}])
    await assert.rejects(createIntentScopeTransport('https://steer.example',async()=>Response.json(output)).history(f.readInput));
});

test('scope transport sends exact metadata to fixed same-origin authenticated tools and verifies portable outputs', async () => {
  const f = await scopeEditorFixture(), calls: unknown[] = [];
  const transport = createIntentScopeTransport('https://steer.example', async (url, init) => {
    assert.equal(init?.credentials, 'same-origin'); assert.equal(init?.mode, 'same-origin'); assert.equal(init?.cache, 'no-store');
    assert.equal(init?.redirect, 'error'); assert.equal(init?.referrerPolicy, 'no-referrer'); assert.equal(new Headers(init?.headers).get('authorization'), null);
    assert.doesNotMatch(String(init?.body), /originalText|documents|api.key|budget|profile|namespace|taskQueue/i); calls.push(JSON.parse(String(init?.body)));
    if (String(url).endsWith('intent.scope.prepare')) return Response.json(f.prepared);
    if (String(url).endsWith('intent.scope.start')) return Response.json(f.started);
    if (String(url).endsWith('intent.scope.discover')) return Response.json(f.discovery);
    assert.ok(String(url).endsWith('intent.scope.read')); return Response.json(f.ready);
  });
  assert.deepEqual(await transport.prepare(f.input), f.prepared); assert.deepEqual(await transport.start(f.startInput), f.started);
  assert.deepEqual(await transport.read(f.readInput), f.ready); assert.deepEqual(await transport.discover(f.discoveryInput), f.discovery);
  assert.deepEqual(calls, [f.input, f.startInput, f.readInput, f.discoveryInput]);
  transport.close(); await assert.rejects(transport.read(f.readInput)); assert.equal(calls.length, 4);
});
test('scope transport rejects substituted bindings, corrupt results, authority claims and caller-supplied configuration', async () => {
  const f = await scopeEditorFixture();
  for (const patch of [{ revision: 2 }, { cursor: f.prepared.reference.reviewId }, { contentLoaded: true }])
    await assert.rejects(createIntentScopeTransport('https://steer.example', async () => Response.json({ ...f.discovery, ...patch })).discover(f.discoveryInput));
  for (const patch of [{ draftId: f.prepared.reference.reviewId }, { revision: 2 }, { sourceSnapshotDigest: 'f'.repeat(64) }, { executionAuthorized: true }])
    await assert.rejects(createIntentScopeTransport('https://steer.example', async () => Response.json({ ...f.prepared, ...patch })).prepare(f.input));
  await assert.rejects(createIntentScopeTransport('https://steer.example', async () => Response.json({ ...f.started, receipt: { ...f.started.receipt, workflowId: 'foreign' } })).start(f.startInput));
  for (const patch of [{ organizationId: 'foreign' }, { reviewId: f.source.input.draftId }, { savedToGit: true }, { review: { ...f.ready.review, resultsDigest: 'f'.repeat(64) } }])
    await assert.rejects(createIntentScopeTransport('https://steer.example', async () => Response.json({ ...f.ready, ...patch })).read(f.readInput));
  let calls = 0; const t = createIntentScopeTransport('https://steer.example', async () => { calls++; return Response.json(f.started); });
  await assert.rejects(t.start({ ...f.startInput, budget: 100 } as never)); assert.equal(calls, 0);
});
test('scope transport sanitizes denied, oversized, non-JSON, redirected and malformed replies without retry', async () => {
  const f = await scopeEditorFixture();
  const redirected = Response.json(f.started); Object.defineProperty(redirected, 'redirected', { value: true });
  for (const response of [redirected, Response.json({ PRIVATE: true }, { status: 403 }), Response.json({ PRIVATE: true }, { status: 503 }),
    new Response('PRIVATE'), new Response(new Uint8Array([255]), { headers: { 'content-type': 'application/json' } }),
    new Response('x'.repeat(16385), { headers: { 'content-type': 'application/json' } })]) {
    let calls = 0; const t = createIntentScopeTransport('https://steer.example', async () => { calls++; return response; });
    await assert.rejects(t.start(f.startInput), error => { assert.doesNotMatch(String(error), /PRIVATE/); return true; }); assert.equal(calls, 1);
  }
  for (const origin of ['http://localhost', 'https://user:pass@steer.example', 'https://steer.example/path']) assert.throws(() => createIntentScopeTransport(origin));
});
test('scope timeout retains admission until an ignored-abort fetch drains and cannot release late output', async t => {
  const f = await scopeEditorFixture(); t.mock.timers.enable({ apis: ['setTimeout'] }); let release!: (r: Response) => void, calls = 0;
  const transport = createIntentScopeTransport('https://steer.example', async () => { calls++; return new Promise(r => { release = r; }); });
  const pending = transport.start(f.startInput), rejected = assert.rejects(pending);
  t.mock.timers.tick(40001); await rejected; await assert.rejects(transport.read(f.readInput)); assert.equal(calls, 1);
  transport.close(); release(Response.json(f.started)); await new Promise(r => setImmediate(r)); await assert.rejects(transport.read(f.readInput)); assert.equal(calls, 1);
});
test('scope transport holds admission through slow body cancellation after timeout', async t => {
  const f = await scopeEditorFixture(); t.mock.timers.enable({ apis: ['setTimeout'] }); let release!: () => void, cancelling = false, calls = 0;
  const transport = createIntentScopeTransport('https://steer.example', async () => { calls++; return new Response(new ReadableStream({
    cancel: () => { cancelling = true; return new Promise<void>(r => { release = r; }); },
  }), { headers: { 'content-type': 'application/json' } }); });
  const pending = transport.start(f.startInput), rejected = assert.rejects(pending); await new Promise(r => setImmediate(r));
  t.mock.timers.tick(40001); await rejected; assert.equal(cancelling, true);
  await assert.rejects(transport.read(f.readInput)); assert.equal(calls, 1); transport.close(); release(); await new Promise(r => setImmediate(r));
});
