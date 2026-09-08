import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecordedMastraRuntime, createRecordedMastraVerifier, RECORDED_MASTRA_REVISION, type RecordedRequest, type RecordedResponse } from '../src/recorded-mastra.ts';
const profile={profileRevision:'synthetic-profile',instructions:' Exact synthetic instructions 🌸\r\n',modelRoute:'synthetic-route',maxOutputTokens:1000,allowedResponseModels:['synthetic-model']};
const options={gatewayUrl:'http://127.0.0.1:4000/v1',gatewayKey:'synthetic-fixture-key',profiles:{architect:profile,testAgent:{...profile,instructions:' Separate Test Agent instructions '}}};
const request=(role:'architect'|'test-agent')=>{const {allowedResponseModels:_models,...p}=role==='architect'?options.profiles.architect:options.profiles.testAgent;return {...p,runtimeRevision:RECORDED_MASTRA_REVISION,source:' Exact synthetic source\r\n',outputContract:role==='architect'?'steer-architect-output/v1':'steer-exam-output/v1'};};
const output={message:' Ready ',questions:[],brief:' # Brief 🌸\r\n',spec:' # Spec\n '};
const response=(role='architect')=>({id:'synthetic-completion',object:'chat.completion',created:1,model:'synthetic-model',
  choices:[{index:0,message:{role:'assistant',content:JSON.stringify(role==='architect'?output:{exam:' # Exam\r\nNOT RUN '})},finish_reason:'stop'}],usage:{prompt_tokens:2,completion_tokens:1,total_tokens:3}});
test('actual Mastra serialization is recorded before transport and exact raw parsed output is recorded before return',async()=>{
  for(const role of ['architect','test-agent'] as const){
    const order:string[]=[];let sent='',req!:RecordedRequest,res!:RecordedResponse;
    const runtime=createRecordedMastraRuntime({...options,transport:async(_,init)=>{order.push('transport');sent=String(init?.body);
      assert.equal(init?.redirect,'error');assert.equal(new Headers(init?.headers).get('authorization'),'Bearer synthetic-fixture-key');
      return new Response(JSON.stringify(response(role))+'\r\n',{headers:{'content-type':'application/json','x-request-id':'synthetic-http-request'}});}});
    const result=await runtime.generate(role,request(role),{recordRequest:async v=>{order.push('request');req=v;},authorizeDispatch:async()=>{order.push('authorize');},recordResponse:async v=>{order.push('response');res=v;}},new AbortController().signal);
    assert.deepEqual(order,['request','authorize','transport','response']);assert.equal(req.requestBody,sent);assert.equal(JSON.parse(sent).store,false);
    assert.equal(JSON.parse(sent).messages[0].content,request(role).instructions);assert.equal(JSON.parse(sent).messages[1].content,request(role).source);
    assert.equal(res.responseBody,JSON.stringify(response(role))+'\r\n');assert.equal(res.providerRequestId,'synthetic-http-request');assert.deepEqual(res.result,result);
    assert.deepEqual(runtime.verify(role,request(role),req,res).result,result);assert.ok(!JSON.stringify([req,res]).includes('synthetic-fixture-key'));
    assert.throws(()=>runtime.verify(role,request(role),{...req,requestBody:sent.replace('1000','1001')},res));
    assert.throws(()=>runtime.verify(role,request(role),req,{...res,usage:{...res.usage,totalTokens:4}}));
    const priorFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => { throw new Error('Verifier must not have network capability'); };
      const verifier = createRecordedMastraVerifier(options.profiles);
      assert.deepEqual(Object.keys(verifier), ['verify']);
      assert.deepEqual(verifier.verify(role, request(role), req, res), runtime.verify(role, request(role), req, res));
      assert.throws(() => verifier.verify(role, request(role), req, { ...res, responseBody: JSON.stringify({ ...response(role), model: 'unapproved' }) }));
    } finally { globalThis.fetch = priorFetch; }
  }
});
test('missing request acknowledgement, cancelled dispatch and lost response acknowledgement cannot manufacture success or retry',async()=>{
  for(const failure of ['request','authorize','response'] as const){let calls=0;
    const runtime=createRecordedMastraRuntime({...options,transport:async()=>{calls++;return Response.json(response());}});
    await assert.rejects(runtime.generate('architect',request('architect'),{recordRequest:async()=>{if(failure==='request')throw new Error('private-request-failure');},
      authorizeDispatch:async()=>{if(failure==='authorize')throw new Error('private-grant');},recordResponse:async()=>{if(failure==='response')throw new Error('private-response-failure');}},new AbortController().signal),{message:'Recorded model generation is unavailable.'});
    assert.equal(calls,failure==='response'?1:0);
  }
});
test('refusal, length, tools, wrong model, missing content, multiple choices, invalid schema and malformed usage fail without retries',async()=>{
  const cases:Array<(v:any)=>void>=[v=>{v.choices[0].message.refusal='private-refusal';},v=>{v.choices[0].finish_reason='length';},
    v=>{v.choices[0].message.tool_calls=[{id:'tool'}];},v=>{v.model='unexpected';},v=>{v.choices[0].message.content=null;},
    v=>{v.choices.push(v.choices[0]);},v=>{v.choices[0].message.content='{"extra":"bad"}';},v=>{v.usage.total_tokens=9;},v=>{v.usage.completion_tokens=1001;},v=>{v.usage.prompt_tokens=-1;},v=>{v.error={message:'private-error'};}];
  for(const mutate of cases){let calls=0,stored=0;const value=response();mutate(value);
    const runtime=createRecordedMastraRuntime({...options,transport:async()=>{calls++;return Response.json(value);}});
    await assert.rejects(runtime.generate('architect',request('architect'),{recordRequest:async()=>{},authorizeDispatch:async()=>{},recordResponse:async()=>{stored++;}},new AbortController().signal));
    assert.equal(calls,1);assert.equal(stored,0);
  }
});
test('unsupported profile/runtime/configuration or cancellation fails before transport; unknown usage remains null',async()=>{
  assert.throws(()=>createRecordedMastraRuntime({...options,gatewayUrl:'https://api.openai.com/v1'}));let calls=0,captured!:RecordedResponse;
  assert.throws(()=>createRecordedMastraRuntime({...options,gatewayKey:'synthetic\n'}));
  const runtime=createRecordedMastraRuntime({...options,transport:async()=>{calls++;const value:any=response();delete value.usage;return Response.json(value);}});
  const hooks={recordRequest:async()=>{},authorizeDispatch:async()=>{},recordResponse:async(v:RecordedResponse)=>{captured=v;}};
  for(const patch of [{runtimeRevision:'old'},{profileRevision:'changed'},{instructions:'changed'},{modelRoute:'other'},{maxOutputTokens:2000},{outputContract:'steer-exam-output/v1'}])
    await assert.rejects(runtime.generate('architect',{...request('architect'),...patch},hooks,new AbortController().signal));
  const cancelled=new AbortController();cancelled.abort();await assert.rejects(runtime.generate('architect',request('architect'),hooks,cancelled.signal));assert.equal(calls,0);
  await runtime.generate('architect',request('architect'),hooks,new AbortController().signal);assert.deepEqual(captured.usage,{inputTokens:null,outputTokens:null,totalTokens:null});
});
test('cancellation discards and closes a successful late response without recording or retrying it',async()=>{
  let release!:(v:Response)=>void,entered!:()=>void,calls=0,recorded=0,cancelled=false;const ready=new Promise<void>(r=>{entered=r;});
  const runtime=createRecordedMastraRuntime({...options,transport:async()=>{calls++;entered();return await new Promise<Response>(r=>{release=r;});}});
  const cancellation=new AbortController(),running=runtime.generate('architect',request('architect'),{recordRequest:async()=>{},authorizeDispatch:async()=>{},recordResponse:async()=>{recorded++;}},cancellation.signal);
  await ready;cancellation.abort();await assert.rejects(running);release(new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}}));
  await new Promise(r=>setImmediate(r));assert.equal(calls,1);assert.equal(recorded,0);assert.equal(cancelled,true);
});
test('HTTP failures, invalid UTF-8, wrong media and excessive responses never log private text or gateway credentials',async()=>{
  let calls=0;const logs:unknown[]=[];const original={log:console.log,warn:console.warn,error:console.error};console.log=console.warn=console.error=(...args)=>{logs.push(args);};
  try{
    for(const make of [()=>Response.json({error:{message:'private-provider'}},{status:500}),()=>new Response(new Uint8Array([0xff]),{headers:{'content-type':'application/json'}}),
      ()=>new Response('private-text'),()=>new Response('x'.repeat(350001),{headers:{'content-type':'application/json'}})]){
      const runtime=createRecordedMastraRuntime({...options,transport:async()=>{calls++;return make();}});
      await assert.rejects(runtime.generate('architect',request('architect'),{recordRequest:async()=>{},authorizeDispatch:async()=>{},recordResponse:async()=>{throw new Error('must not record');}},new AbortController().signal),{message:'Recorded model generation is unavailable.'});
    }
    assert.equal(calls,4);assert.ok(!JSON.stringify(logs).includes('private-'));assert.ok(!JSON.stringify(logs).includes(options.gatewayKey));
  }finally{Object.assign(console,original);}
});
