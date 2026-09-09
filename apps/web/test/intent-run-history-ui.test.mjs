import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {transformWithOxc} from 'vite';
import {createElement,act} from 'react';
import {JSDOM} from 'jsdom';
import {developmentHistoryFixture} from '../../../packages/tool-registry/test/intent-development-history.fixture.ts';
import {runDiscoveryFixture} from '../../../packages/tool-registry/test/intent-run-discovery.fixture.ts';
import {runCursorFor} from '../../../packages/tool-registry/src/intent-run-discovery-contracts.ts';
import {admissionDiscoveryFixture} from '../../../packages/tool-registry/test/intent-admission-discovery.fixture.ts';

async function component(){
  const require=createRequire(import.meta.url),cache=new Map();
  async function compile(name){
    if(cache.has(name))return cache.get(name);
    let code=(await transformWithOxc(readFileSync(new URL(`../app/${name}.tsx`,import.meta.url),'utf8'),`/synthetic/${name}.tsx`,{jsx:{runtime:'automatic'}})).code;
    for(const specifier of [...code.matchAll(/from\s+(["'])([^"']+)\1/g)].map(m=>m[2])){
      let target;if(specifier.startsWith('./')){
        try{target=await compile(specifier.slice(2));}catch(error){if(error.code!=='ENOENT')throw error;target=new URL(`../app/${specifier.slice(2)}.ts`,import.meta.url).href;}
      }else target=pathToFileURL(require.resolve(specifier)).href;
      for(const quote of ['"',"'"])code=code.replaceAll(`${quote}${specifier}${quote}`,JSON.stringify(target));
    }
    const url=`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;cache.set(name,url);return url;
  }
  return(await import(await compile('intent-run-history'))).default;
}
async function fixture(){
  const f=await developmentHistoryFixture(),metadata=runDiscoveryFixture(),Component=await component();
  const source={revision:f.input.revision,revisionDigest:f.input.revisionDigest,scopeInputDigest:f.input.scopeInputDigest};
  const input={...f.scope,draftId:f.input.draftId,cursor:null};
  const page={...metadata.output,...input,latest:{...source,revision:2,revisionDigest:'9'.repeat(64)},entries:[
    {kind:'development',source,operationId:f.readInput.operationId,inputDigest:f.readInput.inputDigest},
    {...metadata.output.entries[1],source}]};
  const dom=new JSDOM('<!doctype html><html lang="en"><title>STEER retained runs test</title><main id="root"></main></html>',{url:'https://steer.example',pretendToBeVisual:true});
  const keys=['window','document','HTMLElement','IS_REACT_ACT_ENVIRONMENT','fetch'],saved=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,key,{configurable:true,value});
  const state={calls:[],page,diagnostics:{...admissionDiscoveryFixture().output,...input,latest:page.latest,
    entries:page.entries.map((entry,index)=>({...entry,originalRecord:index?'present-metadata':'not-observed',executionExpired:!!index}))},denied:false,wait:null};
  globalThis.fetch=async(url,init)=>{const body=JSON.parse(init.body);state.calls.push({url:String(url),body});assert.equal(init.credentials,'same-origin');
    if(state.wait)await state.wait;if(state.denied)return Response.json({PRIVATE:'not allowed'},{status:403});
    if(String(url).endsWith('/intent.admissions.discover'))return Response.json({...state.diagnostics,cursor:body.cursor});
    if(String(url).endsWith('/intent.runs.discover'))return Response.json({...state.page,cursor:body.cursor});
    if(String(url).endsWith('/intent.development.history')){assert.deepEqual(body,f.readInput);return Response.json(f.output);}
    assert.ok(String(url).endsWith('/intent.scope.history'));assert.deepEqual(body,{...f.scope,reviewId:page.entries[1].reviewId,preparationDigest:page.entries[1].preparationDigest});
    return Response.json({PRIVATE:'separate scope history permission required'},{status:403});
  };
  const props={scope:f.scope,draftId:f.input.draftId,currentSource:{input:{...f.input,revision:2,revisionDigest:'9'.repeat(64)},
    content:{...f.content,documents:{brief:'# My preserved correction',spec:'# Human Spec',exam:'# Human Exam'}}},
    subject:'human',identity:'org-product-human',expiresAt:new Date(Date.now()+600000).toISOString()};
  const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root')),tick=()=>new Promise(r=>setTimeout(r,20));
  const render=async(patch={})=>act(async()=>{root.render(createElement(Component,{...props,...patch}));await tick();});
  const button=label=>[...document.querySelectorAll('button')].find(b=>b.textContent===label);
  const click=async label=>act(async()=>{assert.ok(button(label),label);assert.equal(button(label).disabled,false);button(label).click();await tick();});
  const until=async predicate=>{for(let i=0;i<50&&!predicate();i++)await act(async()=>{await tick();});assert.ok(predicate());};
  await render();return{f,state,props,page,root,dom,render,button,click,until,cleanup:async()=>{
    await act(async()=>root.unmount());dom.window.close();for(const k of keys){if(saved[k])Object.defineProperty(globalThis,k,saved[k]);else delete globalThis[k];}}};
}
test('actual preparation diagnostics show missing originals separately, disclose limited coverage and never offer retry or mutate the editor',async()=>{
  const t=await fixture();try{
    assert.equal(t.state.calls.length,0);await t.click('Check preparation diagnostics');await t.until(()=>document.querySelector('h5'));
    assert.match(document.activeElement.textContent,/Preparation diagnostics/);
    assert.match(document.body.textContent,/original input metadata was not observed/);
    assert.match(document.body.textContent,/content and execution outcome are not verified/);
    assert.match(document.body.textContent,/Other configurations and candidate saves were not searched/);
    assert.match(document.body.textContent,/execution window has expired/);
    assert.match(document.body.textContent,/No retry or new model call is authorized/);
    assert.equal(t.state.calls.length,1);assert.ok(t.state.calls[0].url.endsWith('/intent.admissions.discover'));
    assert.equal(document.querySelector('textarea, input, .intent-development-history'),null);
    assert.ok([...document.querySelectorAll('button')].every(b=>!/retry|start|save|adopt/i.test(b.textContent)));
    const require=createRequire(import.meta.url),path=require.resolve('axe-core');delete require.cache[path];
    const audit=await require('axe-core').run(document.getElementById('root'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa']},rules:{'color-contrast':{enabled:false}}});
    assert.deepEqual(audit.violations.map(v=>v.id),[]);
    await t.click('Find retained agent runs');await t.until(()=>document.querySelector('h5'));
    assert.doesNotMatch(document.querySelector('h5').textContent,/Preparation diagnostics/);
    assert.doesNotMatch(document.body.textContent,/original input metadata was not observed/);
  }finally{await t.cleanup();}
});
test('preparation diagnostic pages require explicit selection and distinguish unavailable from empty coverage',async()=>{
  const t=await fixture();try{
    const entries=Array.from({length:10},(_,i)=>({...t.state.diagnostics.entries[1],reviewId:`00000000-0000-4000-8000-${String(30-i).padStart(12,'0')}`}));
    const cursor={...runCursorFor(entries.at(-1),t.page.latest.revisionDigest),bindingSetDigest:t.state.diagnostics.bindingSetDigest};
    t.state.diagnostics={...t.state.diagnostics,entries,nextCursor:cursor};
    await t.click('Check preparation diagnostics');await t.until(()=>t.button('More preparation records'));
    t.state.diagnostics={...t.state.diagnostics,entries:[],nextCursor:null};
    await t.click('More preparation records');await t.until(()=>t.button('First preparation page'));
    assert.deepEqual(t.state.calls.at(-1).body.cursor,cursor);assert.match(document.body.textContent,/does not prove no earlier request exists/);
    t.state.denied=true;await t.click('First preparation page');await t.until(()=>document.body.textContent.includes('Preparation diagnostics are unavailable'));
    assert.doesNotMatch(document.body.textContent,/No preparation records on this page|PRIVATE/);assert.equal(document.querySelector('h5'),null);
  }finally{await t.cleanup();}
});
test('preparation diagnostics clear stale content, discard late owner responses and close at records expiry or visibility loss',async()=>{
  const t=await fixture();try{
    await t.click('Find retained agent runs');await t.until(()=>document.querySelector('h5'));await t.click('Inspect drafting run from revision 1');
    assert.ok(t.button('Read original agent documents'));
    let release;t.state.wait=new Promise(r=>{release=r;});await t.click('Check preparation diagnostics');
    assert.equal(t.button('Read original agent documents'),undefined);assert.equal(t.button('Find retained agent runs').disabled,true);
    await t.render({identity:'another-user'});await act(async()=>{release();await new Promise(r=>setTimeout(r,30));});
    assert.equal(document.querySelector('h5'),null);t.state.wait=null;await t.render();
    t.state.diagnostics={...t.state.diagnostics,latest:{...t.page.latest,revisionDigest:'f'.repeat(64)}};
    await t.click('Check preparation diagnostics');await t.until(()=>document.body.textContent.includes('Preparation diagnostics are unavailable'));assert.equal(document.querySelector('h5'),null);
    t.state.diagnostics={...t.state.diagnostics,latest:t.page.latest,useUntil:new Date(Date.now()+500).toISOString()};
    await t.click('Check preparation diagnostics');await t.until(()=>document.querySelector('h5'));
    await t.until(()=>!document.querySelector('h5'));assert.equal(t.button('Check preparation diagnostics').disabled,true);
    await t.render({identity:'renewed-view'});t.state.diagnostics.useUntil=new Date(Date.now()+600000).toISOString();
    await t.click('Check preparation diagnostics');await t.until(()=>document.querySelector('h5'));
    await act(async()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new window.Event('visibilitychange'));});
    assert.equal(document.querySelector('h5'),null);assert.equal(t.button('Check preparation diagnostics').disabled,true);
  }finally{await t.cleanup();}
});
test('actual run history graph discovers earlier revisions and explicitly opens original document comparison without changing editor or starting work',async()=>{
  const t=await fixture();try{
    assert.equal(t.state.calls.length,0);await t.click('Find retained agent runs');await t.until(()=>document.querySelector('h5'));
    assert.match(document.activeElement.textContent,/Retained references/);assert.match(document.body.textContent,/latest preserved revision 2/);
    assert.match(document.body.textContent,/not generation time/);assert.equal(t.state.calls.length,1);
    await t.click('Inspect drafting run from revision 1');assert.equal(t.state.calls.length,1);
    await t.click('Read original agent documents');await t.until(()=>document.body.textContent.includes('My preserved correction'));
    assert.match(document.body.textContent,/Text differs from the original/);assert.match(document.body.textContent,/execution window has expired/);
    assert.equal(document.querySelectorAll('.intent-development-history details').length,3);
    await t.click('Inspect scope review from revision 1');assert.equal(document.querySelector('.intent-development-history'),null);
    await t.click('Read historical findings');await t.until(()=>document.body.textContent.includes('Historical findings are unavailable'));
    assert.equal(t.state.calls.length,3);assert.doesNotMatch(document.body.textContent,/PRIVATE|My preserved correction/);
    assert.ok(t.state.calls.every(c=>/intent\.(runs\.discover|development\.history|scope\.history)$/.test(c.url)));
    assert.equal(document.querySelector('textarea, input, script'),null);
    const require=createRequire(import.meta.url),path=require.resolve('axe-core');delete require.cache[path];
    const audit=await require('axe-core').run(document.getElementById('root'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa']},rules:{'color-contrast':{enabled:false}}});
    assert.deepEqual(audit.violations.map(v=>v.id),[]);
  }finally{await t.cleanup();}
});
test('actual run history pages explicit keysets and clears old selection before changed or denied pages',async()=>{
  const t=await fixture();try{
    const entries=Array.from({length:20},(_,i)=>({...t.page.entries[1],reviewId:`00000000-0000-4000-8000-${String(30-i).padStart(12,'0')}`}));
    t.state.page={...t.page,entries,nextCursor:runCursorFor(entries.at(-1),t.page.latest.revisionDigest)};
    await t.click('Find retained agent runs');await t.until(()=>t.button('More retained runs'));
    const cursor=t.state.page.nextCursor;t.state.page={...t.page,entries:[{...t.page.entries[1],reviewId:'00000000-0000-4000-8000-000000000001'}],nextCursor:null};
    await t.click('More retained runs');await t.until(()=>t.button('Return to first page'));assert.deepEqual(t.state.calls.at(-1).body.cursor,cursor);
    await t.click('Inspect scope review from revision 1');assert.ok(t.button('Read historical findings'));
    t.state.denied=true;await t.click('Return to first page');await t.until(()=>document.body.textContent.includes('not an empty history'));
    assert.equal(t.button('Read historical findings'),undefined);assert.doesNotMatch(document.body.textContent,/PRIVATE|No retained input references/);
  }finally{await t.cleanup();}
});
test('run history clears references on context or visibility loss and discards late earlier requests',async()=>{
  const t=await fixture();try{
    await t.click('Find retained agent runs');await t.until(()=>document.querySelector('h5'));
    await t.render({currentSource:null});assert.equal(document.querySelector('h5'),null);
    let release;t.state.wait=new Promise(r=>{release=r;});await t.click('Find retained agent runs');
    await t.render({identity:'changed-user'});await act(async()=>{release();await new Promise(r=>setTimeout(r,30));});
    assert.equal(document.querySelector('h5'),null);t.state.wait=null;await t.render();
    t.state.page={...t.page,entries:[]};await t.click('Find retained agent runs');await t.until(()=>document.body.textContent.includes('No retained input references'));
    assert.match(document.body.textContent,/does not prove that no request was attempted/);
    await act(async()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new window.Event('visibilitychange'));});
    assert.equal(document.querySelector('h5'),null);assert.equal(t.button('Find retained agent runs').disabled,true);
    Object.defineProperty(document,'hidden',{configurable:true,value:false});await t.render({expiresAt:new Date(0).toISOString()});assert.equal(t.button('Find retained agent runs').disabled,true);
  }finally{await t.cleanup();}
});
test('run history rejects mismatched latest bindings and clears both selected documents and pointers at records expiry',async()=>{
  const t=await fixture();try{
    t.state.page={...t.page,latest:{...t.page.latest,revisionDigest:'f'.repeat(64)}};
    await t.click('Find retained agent runs');await t.until(()=>document.body.textContent.includes('not an empty history'));
    assert.equal(document.querySelector('h5'),null);
    t.state.page={...t.page,useUntil:new Date(Date.now()+1500).toISOString()};
    await t.click('Find retained agent runs');await t.until(()=>document.querySelector('h5'));
    await t.click('Inspect drafting run from revision 1');await t.click('Read original agent documents');
    await t.until(()=>document.body.textContent.includes('My preserved correction'));
    await act(async()=>{await new Promise(r=>setTimeout(r,2100));});
    assert.equal(document.querySelector('h5'),null);assert.equal(t.button('Find retained agent runs').disabled,true);
    assert.doesNotMatch(document.body.textContent,/My preserved correction|Patient booking/);
  }finally{await t.cleanup();}
});
