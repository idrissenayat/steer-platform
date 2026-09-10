import assert from 'node:assert/strict';
import test from 'node:test';
import { createGitHubReader } from '@steer/adapters/github';
import { createApplicationIntentCorpusEvidence, createIntentCorpusEvidence, type IntentCorpusAuthority } from '@steer/adapters/intent-corpus-evidence';
import { corpusBatchPrototypeFixture } from './corpus-batch-prototype.fixture.ts';
import { now } from '../../../packages/adapters/test/github-brief-fixture.ts';

async function setup(t: { after(run: () => void): void }, policy?: (f: Awaited<ReturnType<typeof corpusBatchPrototypeFixture>>) => IntentCorpusAuthority) {
  const f = await corpusBatchPrototypeFixture(t, { nativeBatch: true });
  const reader = createGitHubReader(f.binding, { appJwt: async () => 'synthetic-app-jwt', now: () => now, fetch: f.repository });
  const { organizationId, productId, repository, branch, scopeInputDigest } = f.evidence;
  const scope = { organizationId, productId, repository, branch }, input = { ...scope, scopeInputDigest };
  const config = { ...scope, retrievalConfigurationRevision: 'application-corpus-r1' }, authority = policy?.(f) ?? f.authority;
  const service = createApplicationIntentCorpusEvidence(reader, config, authority);
  t.after(() => service.shutdown());
  return { ...f, reader, input, config, authority, service };
}
const error = /Current intent corpus could not be verified/;

test('application native collection matches existing full evidence and envelope without per-file source reads', async t => {
  const f = await setup(t), legacy = createIntentCorpusEvidence(f.reader, f.config, f.authority);
  try {
    const expected = await legacy.collect(f.input, async () => {});
    f.wire.length = 0; f.queries.length = 0;
    const actual = await f.service.collect(f.input, async () => {});
    assert.deepEqual(actual, expected);
    assert.equal(actual.evidence.inventory.length, 34); assert.equal(actual.evidence.inventoryComplete, true);
    assert.ok(Object.isFrozen(actual.evidence.documents)); assert.equal(actual.authoritativeClearance, false);
    assert.ok(f.queries.length > 0); assert.ok(f.queries.every(count => count <= 16));
    assert.equal(f.native.git.mutations(), 0);
    console.log('Application corpus component: '+JSON.stringify({sources:34,providerAttempts:f.wire.length,queries:f.queries,actualHttp:false}));
  } finally { legacy.close(); }
});

test('current incomplete search preserves permitted bodies and aggregate inaccessible/unresolved warnings', async t => {
  const modes = ['missing-spec','nonregular','unsupported','inaccessible','unresolved','invalid-selection','denied','invalid-proposal','corrupt-pointer'] as const;
  for (const mode of modes) {
    const selectedRoot = 'items/0003-existing';
    const f = await setup(t, f => ({ ...f.authority,
      select: async context => context.root !== selectedRoot ? f.authority.select(context)
        : mode === 'inaccessible' || mode === 'unresolved' ? { ...context, selection: mode, authorityDigest: 'a'.repeat(64) }
        : mode === 'invalid-selection' ? { ...context, root: 'items/9999-private', selection: 'canonical', authorityDigest: 'a'.repeat(64) }
        : f.authority.select(context),
      authorizeSource: async ref => { if (mode === 'denied' && ref.path === `${selectedRoot}/SPEC.md`) throw new Error('PRIVATE source'); await f.authority.authorizeSource(ref); },
    }));
    if (mode === 'missing-spec') f.native.git.add([{ path: `${selectedRoot}/SPEC.md`, content: null }]);
    if (mode === 'nonregular') f.native.git.add([{ path: `${selectedRoot}/SPEC.md`, content: 'BRIEF.md', mode: '120000' }]);
    if (mode === 'unsupported') f.native.git.add([{ path: 'intent/private-name/BRIEF.md', content: 'PRIVATE unsupported' }]);
    if (mode === 'invalid-proposal') f.native.git.add([{ path: `${selectedRoot}/proposals/not-uuid.json`, content: '{bad' }]);
    if (mode === 'corrupt-pointer') {
      const paths = f.native.git.git(['ls-tree','-r','--name-only',f.native.git.head()]).split('\n');
      const path = paths.find(p => p.endsWith('/CANDIDATE.json'))!;
      f.native.git.add([{ path, content: '{bad' }]);
    }
    const result = await f.service.collect(f.input, async () => {});
    assert.equal(result.envelope.coverage.complete, false, mode);
    assert.equal(result.authoritativeClearance, false); assert.ok(result.evidence.inventory.length > 0);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE|private-name|9999-private/);
    if (mode === 'inaccessible') {
      assert.equal(result.coverage.accessGapCount, 1);
      assert.ok(result.evidence.inventory.every(s => s.targetId !== selectedRoot));
      assert.ok(f.grants.every(path => !path.startsWith(selectedRoot)));
    }
    if (mode === 'missing-spec' || mode === 'nonregular' || mode === 'denied') {
      assert.equal(result.coverage.sourceGapCount, 1);
      assert.ok(result.evidence.inventory.some(s => s.path === `${selectedRoot}/BRIEF.md`));
      assert.ok(result.evidence.inventory.every(s => s.path !== `${selectedRoot}/SPEC.md`));
    }
  }
});

test('late source, selection, caller, permission or head change denies the entire application read phase', async t => {
  for (const mode of ['source','selection','caller','permission','head','policy-port','reader-port'] as const) {
    let changed = false;
    const f = await setup(t, f => ({ ...f.authority, select: async context => {
      const value = await f.authority.select(context);
      return changed && mode === 'selection' ? { ...value as object, authorityDigest: 'f'.repeat(64) } : value;
    } }));
    const current = async () => { if (changed && mode === 'caller') throw new Error('PRIVATE caller'); };
    await assert.rejects(f.service.withReadSession(f.input, current, async read => {
      await read(); changed = true;
      if (mode === 'source') f.state.source = false;
      if (mode === 'permission') f.state.revision = 'changed';
      if (mode === 'head') f.native.git.add([{path:'advance.md',content:'advance'}]);
      if (mode === 'policy-port') f.authority.authorizeSource = async () => {};
      if (mode === 'reader-port') f.reader.readHead = async () => f.native.git.head();
      return 'must not escape';
    }), error);
  }
});

test('a native dispatch failure never retries through the legacy collector', async t => {
  const f = await setup(t); f.override(() => Response.json({errors:[{message:'PRIVATE denied'}]}));
  await assert.rejects(f.service.collect(f.input, async () => {}), error);
  assert.equal(f.queries.length, 1); assert.equal(f.wire.filter(w => w.kind === 'graphql-read').length, 1);
});

test('repeated evidence reads share only one invocation; source edit between invocations is fresh', async t => {
  const f = await setup(t); let escaped!: () => Promise<unknown>;
  const first = await f.service.withReadSession(f.input, async () => {}, async read => {
    escaped = read; const a = await read(), count = f.queries.length;
    const b = await read(); assert.equal(a,b); assert.equal(f.queries.length,count); return a;
  });
  await assert.rejects(escaped(), error);
  f.native.git.add([{path:'items/0003-existing/BRIEF.md',content:'\ufeff# Fresh 🌸\r\nUser intent preserved.\r\n'}]);
  const second = await f.service.collect(f.input, async () => {});
  assert.notEqual(second.evidence.head, first.evidence.head);
  assert.ok(second.evidence.documents.some(d => d.content.startsWith('\ufeff# Fresh 🌸\r\n')));
});

test('omitted or overlapping consumption invalidates the current phase', async t => {
  const f = await setup(t);
  await assert.rejects(f.service.withReadSession(f.input, async () => {}, async () => 'no read'), error);
  assert.deepEqual(f.wire, [], 'no source prefetch before a service actually requests evidence');
  await assert.rejects(f.service.withReadSession(f.input, async () => {}, async read => {
    const first = read(), second = assert.rejects(read(), error);
    await Promise.allSettled([first, second]); return 'caught overlap';
  }), error);
});

test('four actual callbacks retain admission and shutdown drains them after public cancellation', async t => {
  const f = await setup(t); let entered = 0, release!: () => void, ready!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { ready = resolve; });
  try {
    const runs = Array.from({length:4}, () => assert.rejects(f.service.withReadSession(f.input, async () => {}, async read => {
      await read(); if (++entered === 4) ready(); await held; return 'late';
    }), error));
    await started;
    await assert.rejects(f.service.collect(f.input, async () => {}), error);
    f.service.close(); await Promise.all(runs); let stopped = false;
    const stopping = f.service.shutdown().then(() => { stopped = true; });
    await Promise.resolve(); assert.equal(stopped,false); release(); await stopping; assert.equal(stopped,true);
  } finally { release(); }
});

test('foreign readers keep the prior contract; replacing a native port never selects that fallback', async t => {
  const f = await setup(t);
  const foreign = { ...f.reader }, compatibility = createApplicationIntentCorpusEvidence(foreign, f.config, f.authority);
  try { assert.equal((await compatibility.collect(f.input, async () => {})).evidence.inventory.length,34); }
  finally { await compatibility.shutdown(); }
  const head = f.reader.readHead; f.reader.readHead = () => head();
  await assert.rejects(f.service.collect(f.input, async () => {}),error);
});

test('invalid scope and nonvoid caller deny before source IO; elapsed lifetime still applies after consumption', async t => {
  const f = await setup(t);
  await assert.rejects(f.service.collect({...f.input,productId:'other'},async()=>{}),error);
  await assert.rejects(f.service.collect(f.input,async()=>true as never),error);
  assert.deepEqual(f.wire,[]);
  let clock = 100; t.mock.method(performance,'now',()=>clock);
  await assert.rejects(f.service.withReadSession(f.input,async()=>{},async read=>{
    await read();clock=30100;return 'expired';
  }),error);
});

test('pre-evidence service work is also owned: close rejects publicly and shutdown still waits for all four callbacks', async t => {
  const f=await setup(t);let entered=0,ready!:()=>void,release!:()=>void;
  const started=new Promise<void>(resolve=>{ready=resolve;}),held=new Promise<void>(resolve=>{release=resolve;});
  try {
    const runs=Array.from({length:4},()=>assert.rejects(f.service.withReadSession(f.input,async()=>{},async read=>{
      if(++entered===4)ready();await held;await read();
    }),error));
    await started;await assert.rejects(f.service.collect(f.input,async()=>{}),error);assert.deepEqual(f.wire,[]);
    f.service.close();await Promise.all(runs);let stopped=false;
    const stopping=f.service.shutdown().then(()=>{stopped=true;});await Promise.resolve();assert.equal(stopped,false);
    release();await stopping;assert.deepEqual(f.wire,[]);
  }finally{release();}
});

test('application admission follows the actual graph drain, not its already rejected public timeout', async t => {
  let entered=0,release!:()=>void,ready!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{ready=resolve;});
  const f=await setup(t,f=>({...f.authority,authorize:async()=>{
    if(++entered===4)ready();await held;return f.authority.authorize();
  }}));
  const timeout=new AbortController();t.mock.method(AbortSignal,'timeout',()=>timeout.signal);
  let consumers=0;
  try {
    const runs=Array.from({length:4},()=>assert.rejects(f.service.withReadSession(f.input,async()=>{},async read=>{
      consumers++;await read();
    }),error));
    await started;timeout.abort();await Promise.all(runs);
    for(let i=0;i<10;i++)await Promise.resolve();
    // A fresh timer cannot reclaim slots still owned by the previous graphs.
    t.mock.method(AbortSignal,'timeout',()=>new AbortController().signal);
    await assert.rejects(f.service.withReadSession(f.input,async()=>{},async read=>{consumers++;await read();}),error);
    assert.equal(consumers,4);assert.equal(entered,4);assert.deepEqual(f.wire,[]);
    release();await f.service.shutdown();
  }finally{release();}
});
