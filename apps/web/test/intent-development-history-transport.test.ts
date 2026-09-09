import assert from 'node:assert/strict';
import test from 'node:test';
import {developmentHistoryFixture} from '../../../packages/tool-registry/test/intent-development-history.fixture.ts';
import {createIntentDevelopmentHistoryTransport} from '../app/intent-development-history-transport.ts';

test('original generation transport sends only a reference to its fixed authenticated read and verifies the linked output',async()=>{
  const f=await developmentHistoryFixture();let calls=0;
  const transport=createIntentDevelopmentHistoryTransport('https://steer.example',async(url,init)=>{
    calls++;assert.equal(String(url),'https://steer.example/v1/tools/intent.development.history');assert.deepEqual(JSON.parse(String(init?.body)),f.readInput);
    assert.equal(init?.credentials,'same-origin');assert.equal(init?.cache,'no-store');assert.equal(init?.redirect,'error');assert.equal(init?.referrerPolicy,'no-referrer');return Response.json(f.output);
  });
  assert.deepEqual(await transport.read(f.readInput),f.output);assert.equal(calls,1);transport.close();await assert.rejects(transport.read(f.readInput));
  for(const origin of ['http://localhost:3000','https://user@steer.example','https://steer.example/path'])assert.throws(()=>createIntentDevelopmentHistoryTransport(origin));
});
test('history transport rejects incorrect bindings, private extras, flags, hashes, HTTP errors and oversized replies',async()=>{
  const f=await developmentHistoryFixture();
  for(const response of [Response.json({PRIVATE:'denied'},{status:403}),Response.json({...f.output,productId:'foreign'}),Response.json({...f.output,requestBody:'PRIVATE'}),
    Response.json({...f.output,executionAuthorized:true}),Response.json({...f.output,results:f.output.results.map(r=>({...r,outputDigest:'f'.repeat(64)}))}),
    new Response('a'.repeat(600001),{headers:{'content-type':'application/json'}})]){
    const transport=createIntentDevelopmentHistoryTransport('https://steer.example',async()=>response);
    try{await assert.rejects(transport.read(f.readInput),{message:'Original agent documents are unavailable. Your editor is unchanged.'});}finally{transport.close();}
  }
});
test('history transport admits only one request and discards ignored-abort late responses after close',async()=>{
  const f=await developmentHistoryFixture();let release!:(value:Response)=>void,calls=0;
  const transport=createIntentDevelopmentHistoryTransport('https://steer.example',async()=>{calls++;return new Promise<Response>(r=>{release=r;});});
  const pending=transport.read(f.readInput);await assert.rejects(transport.read(f.readInput));transport.close();await assert.rejects(pending);
  release(Response.json(f.output));await new Promise(r=>setImmediate(r));await assert.rejects(transport.read(f.readInput));assert.equal(calls,1);
});
