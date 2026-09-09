import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {transformWithOxc} from 'vite';
import {createElement,act} from 'react';
import {JSDOM} from 'jsdom';
import {developmentHistoryFixture} from '../../../packages/tool-registry/test/intent-development-history.fixture.ts';

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
  return(await import(await compile('intent-development-history'))).default;
}
async function fixture(){
  const f=await developmentHistoryFixture(),Component=await component();
  const dom=new JSDOM('<!doctype html><html lang="en"><title>STEER history test</title><main id="root"></main></html>',{url:'https://steer.example',pretendToBeVisual:true});
  const keys=['window','document','HTMLElement','IS_REACT_ACT_ENVIRONMENT','fetch'],saved=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,key,{configurable:true,value});
  const state={calls:[],output:f.output,denied:false,wait:null};
  globalThis.fetch=async(url,init)=>{state.calls.push(String(url));assert.ok(String(url).endsWith('/intent.development.history'));
    assert.deepEqual(JSON.parse(init.body),f.readInput);assert.equal(init.credentials,'same-origin');if(state.wait)await state.wait;
    return state.denied?Response.json({PRIVATE:'denied'},{status:403}):Response.json(state.output);};
  const props={input:f.readInput,original:{input:f.input,content:f.content},currentSource:{input:{...f.input,revision:2,revisionDigest:'9'.repeat(64)},
    content:{...f.content,documents:{brief:f.ready.results[0].result.output.brief,spec:'# Human Spec',exam:'# Human Exam'}}},
    identity:'org-product-human',expiresAt:new Date(Date.now()+600000).toISOString()};
  const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root'));
  const tick=()=>new Promise(r=>setTimeout(r,20));
  const render=async(patch={})=>act(async()=>{root.render(createElement(Component,{...props,...patch}));await tick();});
  const button=()=>document.querySelector('button');
  const read=async()=>act(async()=>{assert.equal(button().disabled,false);button().click();await tick();});
  const until=async(predicate)=>{for(let i=0;i<50&&!predicate();i++)await act(async()=>{await tick();});assert.ok(predicate());};
  await render();return{f,state,props,root,dom,read,render,until,button,
    cleanup:async()=>{await act(async()=>root.unmount());dom.window.close();for(const k of keys){if(saved[k])Object.defineProperty(globalThis,k,saved[k]);else delete globalThis[k];}}};
}
test('production history panel explicitly compares original Brief Spec Exam with preserved edits without adoption or generation',async()=>{
  const t=await fixture();try{
    assert.equal(t.state.calls.length,0);await t.read();await t.until(()=>document.querySelector('h4'));
    const text=document.getElementById('root').textContent;
    assert.match(text,/execution window has expired/);assert.match(text,/Both recorded roles are verified/);
    assert.match(text,/Text matches the original/);assert.match(text,/Text differs from the original/);assert.match(text,/Human Spec/);assert.match(text,/Patient booking/);
    assert.equal(document.querySelectorAll('details').length,3);assert.equal(document.querySelectorAll('button').length,1);assert.equal(document.querySelector('script'),null);
    assert.equal(document.activeElement,document.querySelector('h4'));assert.equal(t.state.calls.length,1);
    const require=createRequire(import.meta.url),path=require.resolve('axe-core');delete require.cache[path];
    const audit=await require('axe-core').run(document.getElementById('root'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa']},rules:{'color-contrast':{enabled:false}}});
    assert.deepEqual(audit.violations.map(v=>v.id),[]);
  }finally{await t.cleanup();}
});
test('history comparison hides earlier content on editor or identity changes and rejects late old-selection responses',async()=>{
  const t=await fixture();try{
    await t.read();await t.until(()=>document.querySelector('h4'));
    await t.render({currentSource:null});assert.equal(document.querySelector('h4'),null);
    let release;t.state.wait=new Promise(r=>{release=r;});await t.read();
    await t.render({identity:'different-current-identity'});await act(async()=>{release();await new Promise(r=>setTimeout(r,30));});
    assert.equal(document.querySelector('h4'),null);assert.doesNotMatch(document.getElementById('root').textContent,/Patient booking|Human Spec/);
    t.state.wait=null;await t.render();t.state.output={...t.f.output,source:{...t.f.output.source,revisionDigest:'f'.repeat(64)}};
    await t.read();await t.until(()=>document.getElementById('root').textContent.includes('unavailable under current permissions'));
    assert.equal(document.querySelector('h4'),null);
  }finally{await t.cleanup();}
});
test('history keeps incomplete originals explicit and clears documents on denial, hidden page and expired session',async()=>{
  const t=await fixture();try{
    t.state.output={...t.f.output,status:'partial',steps:[t.f.output.steps[0],{role:'test-agent',state:'pending'}],results:t.f.output.results.slice(0,1)};
    await t.read();await t.until(()=>document.querySelector('h4'));assert.match(document.getElementById('root').textContent,/No verified original EXAM/);
    t.state.denied=true;await t.read();await t.until(()=>document.getElementById('root').textContent.includes('unavailable under current permissions'));
    assert.equal(document.querySelector('h4'),null);assert.doesNotMatch(document.getElementById('root').textContent,/PRIVATE/);
    t.state.denied=false;await t.read();await t.until(()=>document.querySelector('h4'));
    await act(async()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new window.Event('visibilitychange'));});
    assert.equal(document.querySelector('h4'),null);assert.equal(t.button().disabled,true);
    Object.defineProperty(document,'hidden',{configurable:true,value:false});await t.render({expiresAt:new Date(0).toISOString()});assert.equal(t.button().disabled,true);
  }finally{await t.cleanup();}
});
