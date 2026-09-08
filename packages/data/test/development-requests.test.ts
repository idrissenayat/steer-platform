import test from 'node:test';
import assert from 'node:assert/strict';
import { originalFixture } from './development-original.fixture.ts';
import { renderDevelopmentRequest,createDevelopmentRequestReader } from '../src/development-requests.ts';
const records={organizationId:'org',subject:'human',productId:'product',repository:'github:52',branch:'codex/synthetic',configurationRevision:'r1',recordsPolicyDigest:'a'.repeat(64)};
const configuration={...records,action:'develop',expiresAt:'2026-09-08T12:00:00.000Z',budget:{organizationId:'org',subject:'human',configurationRevision:'r1',budgetId:'00000000-0000-4000-8000-000000000220',
  approvalDigest:'b'.repeat(64),capMicrousd:5,architectMicrousd:3,testAgentMicrousd:2}};
const operationId='00000000-0000-4000-8000-000000000221';
async function fixture(){
  const original=(await originalFixture(configuration,{draftId:'00000000-0000-4000-8000-000000000220',revision:1,sourceRevision:1,revisionDigest:'c'.repeat(64),
    content:{originalText:' Exact human intent 🌸\r\n',clarificationTurns:[' Exact reply '],documents:{brief:'Earlier Brief-marker',spec:'Earlier Spec-marker',exam:'Forbidden prior Exam-marker'}}})).original;
  const architect=await renderDevelopmentRequest({original,operationId,role:'architect',predecessor:null});
  const predecessor={checkpoint:{binding:{organizationId:'org',subject:'human',operationId,stepId:'architect',draftId:original.source.draftId,draftRevision:1,
    inputDigest:architect.stepReference.stepInputDigest,configurationRevision:'r1'},resultRef:'00000000-0000-4000-8000-000000000222',resultDigest:'d'.repeat(64),recordsPolicyDigest:records.recordsPolicyDigest},
    result:{role:'architect',output:{message:'Forbidden Architect commentary-marker',questions:[],brief:' Exact new Brief 🌸\r\n',spec:' Exact new Spec\n '}}};
  return{original,architect,predecessor};
}
test('renderer preserves exact intent/evidence and projects role contexts without prior Exams or Architect commentary',async()=>{
  const f=await fixture(),source=JSON.parse(f.architect.rendered.request.source);
  assert.equal(source.intent,f.original.source.content.originalText);assert.deepEqual(source.clarificationTurns,f.original.source.content.clarificationTurns);
  assert.deepEqual(source.originalDocuments,{brief:'Earlier Brief-marker',spec:'Earlier Spec-marker'});assert.equal(source.scopeEvidence.coverage.complete,false);
  assert.ok(!JSON.stringify(f.architect).includes('Forbidden prior Exam-marker'));
  const exam=await renderDevelopmentRequest({original:f.original,operationId,role:'test-agent',predecessor:f.predecessor}),payload=JSON.parse(exam.rendered.request.source);
  assert.deepEqual(Object.keys(payload),['intent','clarificationTurns','originalDocuments','direction','scopeEvidence','brief','spec']);
  assert.deepEqual(payload.originalDocuments,source.originalDocuments);
  assert.equal(payload.brief,f.predecessor.result.output.brief);assert.equal(payload.spec,f.predecessor.result.output.spec);
  for(const marker of ['Forbidden prior Exam-marker','Forbidden Architect commentary-marker'])assert.ok(!JSON.stringify(exam).includes(marker));
  assert.equal(exam.rendered.request.instructions,f.original.profiles.testAgent.instructions);assert.equal(exam.executionAuthorized,false);assert.ok(Object.isFrozen(exam.rendered.request));
});
test('rendered fingerprints survive reconstruction and bind predecessor identity without aliasing Architect input',async()=>{
  const f=await fixture(),input={original:f.original,operationId,role:'test-agent',predecessor:f.predecessor};
  const result=await renderDevelopmentRequest(input);assert.deepEqual(await renderDevelopmentRequest(structuredClone(input)),result);
  assert.notEqual(result.stepReference.stepInputDigest,f.architect.stepReference.stepInputDigest);
  const changed=structuredClone(input);changed.predecessor.checkpoint.resultRef='00000000-0000-4000-8000-000000000223';
  assert.notEqual((await renderDevelopmentRequest(changed)).stepReference.stepInputDigest,result.stepReference.stepInputDigest);
});
test('Test Agent context rejects missing, foreign, stale or arbitrary-digest predecessors and unanswered Architect clarification',async()=>{
  const f=await fixture();
  const variants:Array<(p:any)=>void>=[p=>{p.checkpoint.binding.operationId='00000000-0000-4000-8000-000000000223';},p=>{p.checkpoint.binding.subject='foreign';},
    p=>{p.checkpoint.binding.draftRevision=2;},p=>{p.checkpoint.binding.inputDigest='e'.repeat(64);},p=>{p.checkpoint.recordsPolicyDigest='e'.repeat(64);},
    p=>{p.result.output={message:'Question',questions:['Necessary question?'],brief:null,spec:null};},p=>{p.result={role:'test-agent',output:{exam:'Wrong role'}};}];
  for(const mutate of variants){const p=structuredClone(f.predecessor);mutate(p);await assert.rejects(renderDevelopmentRequest({original:f.original,operationId,role:'test-agent',predecessor:p}));}
  await assert.rejects(renderDevelopmentRequest({original:f.original,operationId,role:'test-agent',predecessor:null}));
  await assert.rejects(renderDevelopmentRequest({original:f.original,operationId,role:'architect',predecessor:f.predecessor}));
});
test('renderer rejects caller-injected chat history, authority and malformed payload without echoing private content',async()=>{
  const f=await fixture();
  for(const extra of [{history:['private-history-marker']},{approved:true},{tools:['send']}])await assert.rejects(renderDevelopmentRequest({original:f.original,operationId,role:'architect',predecessor:null,...extra}),{message:'Development request is unavailable.'});
});
test('request reader exposes only read/close and rejects role authority before loading private originals',async()=>{
  let calls=0;const pool={connect:async()=>{calls++;throw new Error('private-connection');}};
  const dependencies={authorize:async()=>{},authorizeOriginal:async()=>{},authorizeOperation:async()=>{},authorizeDraft:async()=>{},keyForDraft:async()=>{throw new Error();}};
  const reader=createDevelopmentRequestReader({drafts:pool,execution:pool},records,{originals:dependencies,results:{...dependencies,authorizeResult:async()=>{}},authorizeRequest:async()=>{throw new Error('private-denial');}});
  assert.deepEqual(Object.keys(reader),['read','close']);await assert.rejects(reader.read({operationId,inputDigest:'a'.repeat(64),role:'architect'}),{message:'Development request is unavailable.'});
  assert.equal(calls,0);reader.close();
});
test('request authorization timeouts retain admission until drainage and close prevents late work',async()=>{
  let calls=0,connections=0,release!:()=>void;const held=new Promise<void>(r=>{release=r;}),pool={connect:async()=>{connections++;throw new Error();}};
  const dependencies={authorize:async()=>{},authorizeOriginal:async()=>{},authorizeOperation:async()=>{},authorizeDraft:async()=>{},keyForDraft:async()=>{throw new Error();}};
  const reader=createDevelopmentRequestReader({drafts:pool,execution:pool},records,{originals:dependencies,results:{...dependencies,authorizeResult:async()=>{}},authorizeRequest:async()=>{calls++;await held;}});
  const target={operationId,inputDigest:'a'.repeat(64),role:'architect'};await assert.rejects(reader.read(target));await assert.rejects(reader.read(target));assert.equal(calls,1);
  reader.close();release();await new Promise(r=>setImmediate(r));assert.equal(connections,0);await assert.rejects(reader.read(target));
});
