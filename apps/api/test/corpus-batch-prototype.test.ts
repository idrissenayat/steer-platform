import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { corpusBatchPrototypeFixture } from './corpus-batch-prototype.fixture.ts';
import { partitionCorpusBatch, corpusBatchQuery, collectCorpusBatchPrototype } from './corpus-batch-prototype.ts';

test('bounded corpus query is read-only with fixed aliases and worst-case response-size partitions',()=>{
  for(const invalid of [0,17,1.5,NaN])assert.throws(()=>corpusBatchQuery(invalid));
  assert.match(corpusBatchQuery(16),/^query SteerImmutableCorpusBatch/);assert.doesNotMatch(corpusBatchQuery(16),/mutation|expression|HEAD/);
  const batches=partitionCorpusBatch(Array.from({length:5},()=>({size:131072})));
  assert.deepEqual(batches.map(b=>b.length),[2,2,1]);
  for(const b of batches)assert.ok(b.reduce((n,f)=>n+6*f.size+2048,4096)<=2097152);
  assert.deepEqual(partitionCorpusBatch(Array.from({length:34},()=>({size:100}))).map(b=>b.length),[16,16,2]);
  for(const size of [-1,0,131073,NaN,Infinity])assert.throws(()=>partitionCorpusBatch([{size}]));
});
test('native 34-source corpus keeps all exact bytes, pointer/manifest dependencies and source grants within the proposed corpus budget',async t=>{
  const f=await corpusBatchPrototypeFixture(t),result=await f.run();
  assert.equal(result.productionInstalled,false);assert.equal(result.semanticQualityVerified,false);
  assert.equal(result.files.length,42);assert.equal(result.semantic.length,34);
  for(const source of f.evidence.inventory){const actual=result.semantic.find(s=>s.path===source.path)!;
    assert.ok(actual);assert.equal(actual.contentDigest,source.contentDigest);assert.equal(actual.blobSha,source.blobOid);
    assert.equal(actual.status,source.status);assert.equal(actual.content,f.evidence.documents.find(d=>d.sourceId===source.sourceId)!.content);}
  assert.deepEqual(result.waves.map(w=>({name:w.name,count:w.paths.length,batches:w.batches})),[
    {name:'roots-and-pointers',count:34,batches:3},{name:'manifests',count:2,batches:1},{name:'bundle-documents',count:6,batches:1}]);
  assert.deepEqual(f.queries,[16,16,2,2,6]);
  assert.equal(f.grants.length,126);assert.equal(result.sourcePolicyQueries,f.grants.length);
  for(const file of result.files)assert.equal(f.grants.filter(p=>p===file.path).length,3);
  assert.equal(f.priorPhysicalReads,43);assert.equal(f.wire.length,27);assert.equal(f.native.git.mutations(),0);
  const counts=Object.fromEntries(['identity','repository'].map(origin=>[origin,f.wire.filter(w=>w.origin===origin).reduce((out,w)=>({...out,[w.kind]:(out[w.kind]??0)+1}),{} as Record<string,number>)]));
  console.log('Synthetic corpus batch feasibility: '+JSON.stringify({physicalUnique:result.files.length,priorPhysicalReads:f.priorPhysicalReads,semanticSources:result.semantic.length,
    totalProviderAttempts:f.wire.length,counts,sourcePolicyQueries:f.grants.length,waves:result.waves.map(w=>({name:w.name,files:w.paths.length,batches:w.batches,bytes:w.bytes})),
    consumed:result.files.map(file=>({path:file.path,bytes:Buffer.byteLength(file.content),sha256:createHash('sha256').update(file.content).digest('hex')})),
    metadataAuthoritySynthetic:true,currentCallerStandIn:'native Git head lookup, not the HTTP/OIDC/GitAuthorizationResolver composition',
    integratedCorpusBudgetAccepted:false,wholeJourneyPerformanceAccepted:false,productionInstalled:false}));
});
test('source denial prevents content dispatch and incomplete lifecycle selection never establishes newness',async t=>{
  const f=await corpusBatchPrototypeFixture(t);f.state.source=false;await assert.rejects(f.run());assert.equal(f.queries.length,0);
  f.state.source=true;f.authority.select=async c=>({...c,selection:'inaccessible',authorityDigest:'e'.repeat(64)});
  await assert.rejects(f.run());assert.equal(f.queries.length,0);
});
test('pinned historical revision preserves old source bytes while current head and source grants still revalidate', async t => {
  const f = await corpusBatchPrototypeFixture(t), prior = await f.run();
  f.native.git.add([{ path: 'items/0003-existing/BRIEF.md', content: '# Different current source\nDo not substitute these bytes into history.\n' }]);
  assert.notEqual(f.native.git.head(), prior.revision);
  const retained = await collectCorpusBatchPrototype(f.binding, f.evidence.productId, f.repository, f.authority,
    async () => { if (!f.state.caller) throw new Error('Synthetic caller denied'); }, undefined, prior.revision);
  assert.deepEqual(retained.semantic, prior.semantic); assert.equal(retained.revision, prior.revision);
  f.state.source = false;
  await assert.rejects(collectCorpusBatchPrototype(f.binding, f.evidence.productId, f.repository, f.authority, async () => {}, undefined, prior.revision));
  f.state.source = true; let changed = false;
  f.afterQuery(() => { if (!changed) { changed = true; f.native.git.add([{ path: 'history-test-race.md', content: 'changed during history read\n' }]); } });
  await assert.rejects(collectCorpusBatchPrototype(f.binding, f.evidence.productId, f.repository, f.authority, async () => {}, undefined, prior.revision));
  assert.equal(changed, true);
  const before = f.wire.length;
  await assert.rejects(collectCorpusBatchPrototype(f.binding, f.evidence.productId, f.repository, f.authority, async () => {}, undefined, 'HEAD'));
  assert.equal(f.wire.length, before);
});
test('changed caller, source, all-grants revision or source head during a batch prevents release',async t=>{
  const f=await corpusBatchPrototypeFixture(t);
  for(const mode of ['caller','source','revision','head']){
    f.state.caller=true;f.state.source=true;f.state.revision='synthetic-grants-r1';let acted=false;
    f.afterQuery(()=>{if(acted)return;acted=true;
      if(mode==='caller')f.state.caller=false;if(mode==='source')f.state.source=false;if(mode==='revision')f.state.revision='changed';
      if(mode==='head')f.native.git.add([{path:'synthetic-head-change.md',content:'new head'}]);});
    await assert.rejects(f.run());assert.ok(acted);
  }
});
test('partial, corrupt, binary, truncated, oversized and mismatched GraphQL replies fail closed',async t=>{
  const f=await corpusBatchPrototypeFixture(t);
  const bad:Array<(value:any)=>unknown>=[v=>({...v,errors:[{message:'partial'}]}),v=>{v.data.repository.b0=null;return v},
    v=>{delete v.data.repository.b0;return v},v=>{v.data.repository.extra=v.data.repository.b0;return v},
    v=>{v.data.repository.databaseId=53;return v},v=>{v.data.repository.nameWithOwner='foreign/repo';return v},
    v=>{v.data.repository.b0.isBinary=true;return v},v=>{v.data.repository.b0.isTruncated=true;return v},
    v=>{v.data.repository.b0.oid='a'.repeat(40);return v},v=>{v.data.repository.b0.byteSize++;return v},
    v=>{v.data.repository.b0.text+='changed';return v},v=>{v.data.repository.b0.text='\ud800';return v},
    ()=>new Response('x'.repeat(2097153)),()=>new Response('{}',{status:403})];
  for(const alter of bad){f.override(alter);await assert.rejects(f.run());}
  assert.equal(f.queries.length,bad.length);
});
test('cancellation after a reply stops later batches and never returns partial source content',async t=>{
  const f=await corpusBatchPrototypeFixture(t),stop=new AbortController();
  f.afterQuery(()=>stop.abort());await assert.rejects(f.run(stop.signal));assert.equal(f.queries.length,1);
});
test('binding or authority method replacement during a batch rejects before later dispatch',async t=>{
  const f=await corpusBatchPrototypeFixture(t),originalBinding={...f.binding},originalPorts={...f.authority};
  for(const mode of ['binding','authorize','select','authorizeSource'] as const){
    Object.assign(f.binding,originalBinding);Object.assign(f.authority,originalPorts);const before=f.queries.length;
    f.afterQuery(()=>{if(mode==='binding')f.binding.repository='foreign';
      else if(mode==='authorize')f.authority.authorize=async()=>({permissionsRevision:f.state.revision});
      else if(mode==='select')f.authority.select=async context=>originalPorts.select(context);
      else f.authority.authorizeSource=async()=>{};});
    await assert.rejects(f.run());assert.equal(f.queries.length,before+1);
  }
});
test('large Unicode sources preserve exact trailing bytes and force size-bounded waves, not a universal 30-attempt claim',async t=>{
  const f=await corpusBatchPrototypeFixture(t),content='🙂'.repeat(32767)+'ok\n\n';
  assert.equal(Buffer.byteLength(content),131072);
  const canonical=f.evidence.inventory.filter(s=>s.status==='canonical');
  f.native.git.add(canonical.map(s=>({path:s.path,content})));
  const result=await f.run();
  for(const source of canonical)assert.equal(result.semantic.find(s=>s.path===source.path)!.content,content);
  assert.ok(result.waves[0]!.batches>3);assert.ok(f.wire.length>30);
  assert.equal(result.files.length,42);assert.equal(result.semantic.length,34);
  console.log('Synthetic corpus batch size diagnostic: '+JSON.stringify({canonicalDocuments:canonical.length,bytesEach:Buffer.byteLength(content),
    totalProviderAttempts:f.wire.length,queries:f.queries,representativeBudgetAccepted:false}));
});
