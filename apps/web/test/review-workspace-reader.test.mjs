import assert from 'node:assert/strict';
import test from 'node:test';
import { readBriefDocument } from '@steer/domain/brief-document';
import { createReviewWorkspaceReader } from '../app/review-workspace-reader.ts';

const scope = { organizationId: 'synthetic', repository: 'github:1' }, origin = 'https://steer.example';
const reference = { path: 'items/0189-test/BRIEF.md', revision: 'a'.repeat(40), contentDigest: 'b'.repeat(64) };
const content = '# Brief: Recorded source\n## Problem\nA problem.';
const detail = { ...scope, ...reference, kind: 'brief-projection', blobSha: 'c'.repeat(40), content, document: readBriefDocument(content) };
function fixture() {
  const state = { now: 1000, catalog: { ...scope, kind: 'brief-catalog', records: [reference] }, detail, denied: false };
  const calls = [];
  const reader = createReviewWorkspaceReader(scope, origin, new Date(10000).toISOString(), async (url, init) => {
    calls.push({ url, input: JSON.parse(init.body) });
    return state.denied ? new Response(null, { status: 403 }) : Response.json(url.endsWith('catalog') ? state.catalog : state.detail);
  }, () => state.now);
  return { state, calls, reader };
}

test('review discovery is explicit and never fans out to decisions, evidence, writes or other origins', async () => {
  const f = fixture(); assert.equal(f.reader.view().phase, 'idle'); assert.equal(f.calls.length, 0);
  const list = await f.reader.refresh(); assert.equal(list.records.length, 1); assert.equal(f.calls.length, 1);
  list.records[0].revision = 'f'.repeat(40); assert.equal(f.reader.view().records[0].revision, reference.revision);
  const result = await f.reader.open(reference); assert.equal(result.selected.content, content);
  result.selected.document.title = 'tampered'; assert.equal(f.reader.view().selected.document.title, detail.document.title);
  assert.deepEqual(f.calls, [{ url: `${origin}/v1/tools/intent.brief.catalog`, input: scope },
    { url: `${origin}/v1/tools/intent.brief.read`, input: { ...scope, ...reference } }]); f.reader.close();
});

test('foreign or unlisted revisions cannot become review selections and discard catalog membership', async () => {
  for (const change of [{ revision: 'd'.repeat(40) }, { contentDigest: 'd'.repeat(64) }, { path: 'BRIEF.md' }]) {
    const f = fixture(); await f.reader.refresh(); const result = await f.reader.open({ ...reference, ...change });
    assert.equal(result.phase, 'failed'); assert.equal(result.selected, null); assert.deepEqual(result.records, []); assert.equal(f.calls.length, 1); f.reader.close();
  }
});

test('stale, denied or foreign responses clear prior sources without substituting a newer revision', async () => {
  for (const mode of ['null', 'denied', 'foreign', 'revision']) {
    const f = fixture(); await f.reader.refresh(); await f.reader.open(reference);
    if (mode === 'null') f.state.detail = null;
    if (mode === 'denied') f.state.denied = true;
    if (mode === 'foreign') f.state.detail = { ...detail, organizationId: 'other' };
    if (mode === 'revision') f.state.detail = { ...detail, revision: 'd'.repeat(40) };
    const result = await f.reader.open(reference); assert.equal(result.selected, null); assert.deepEqual(result.records, []);
    assert.equal(result.phase, 'failed'); f.reader.close();
  }
});

test('expiry and backward or invalid clocks clear retained content before another network request', async () => {
  for (const now of [10000, 999, NaN]) {
    const f = fixture(); await f.reader.refresh(); await f.reader.open(reference); f.state.now = now;
    assert.equal(f.reader.view().phase, 'expired'); assert.equal(f.reader.view().selected, null);
    await f.reader.refresh(); assert.equal(f.calls.length, 2);
    f.state.now = 1001; assert.equal((await f.reader.refresh()).phase, 'expired'); assert.equal(f.calls.length, 2); f.reader.close();
  }
});

test('clearing or closing an in-flight read rejects late publication; reopening requires fresh discovery', async () => {
  for (const action of ['clear', 'close']) {
    let release; const held = new Promise(resolve => { release = resolve; }); let calls = 0;
    const reader = createReviewWorkspaceReader(scope, origin, new Date(10000).toISOString(), async () => {
      calls++; await held; return Response.json({ ...scope, kind: 'brief-catalog', records: [reference] });
    }, () => 1000);
    const pending = reader.refresh(); assert.equal(reader.view().phase, 'loading');
    await reader.refresh(); assert.equal(calls, 1); reader[action](); release(); await pending;
    assert.equal(reader.view().selected, null); assert.deepEqual(reader.view().records, []);
    if (action === 'clear') { await reader.refresh(); assert.equal(calls, 2); }
    else { await reader.refresh(); assert.equal(calls, 1); } reader.close();
  }
});

test('expiry while reading and malformed refreshes discard every retained record', async () => {
  const f = fixture(); await f.reader.refresh(); await f.reader.open(reference);
  f.state.catalog = { ...f.state.catalog, repository: 'foreign' };
  assert.equal((await f.reader.refresh()).phase, 'failed'); assert.equal(f.reader.view().selected, null); f.reader.close();
  let now = 1000;
  const reader = createReviewWorkspaceReader(scope, origin, new Date(2000).toISOString(), async () => {
    now = 2000; return Response.json({ ...scope, kind: 'brief-catalog', records: [reference] });
  }, () => now);
  assert.equal((await reader.refresh()).phase, 'expired'); assert.deepEqual(reader.view().records, []); reader.close();
  let calls = 0;
  const unsafe = createReviewWorkspaceReader(scope, 'http://outside.invalid', new Date(10000).toISOString(), async () => { calls++; throw new Error('private'); }, () => 1000);
  assert.equal((await unsafe.refresh()).phase, 'failed'); assert.equal(calls, 0); unsafe.close();
});
