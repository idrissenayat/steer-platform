import assert from 'node:assert/strict';
import test from 'node:test';
import {summarizeNativeRequests as summarize} from './native-request-metrics.ts';

test('native fixture metrics count only the selected interval and expose no paths or provider data',()=>{
  const privateText='PRIVATE-NOT-FOR-DIAGNOSTICS';
  const get=(suffix:string)=>({path:`/repos/${privateText}/repo/git/${suffix}/${privateText}`,method:'GET'});
  const calls=[get('ref/heads'),get('ref/heads'),get('commits'),get('trees'),get('blobs'),
    {path:`/app/installations/${privateText}/access_tokens`,method:'POST'},
    {path:'/graphql',method:'POST'},{path:`/${privateText}`,method:'GET'},
    {...get('blobs'),method:'POST'}];
  const result=summarize(calls,1);
  assert.deepEqual(result,{head:1,commit:1,tree:1,blob:1,token:1,mutation:1,other:2});
  assert.equal(Object.values(result).reduce((a,b)=>a+b,0),calls.length-1);
  assert.equal(JSON.stringify(result).includes(privateText),false);assert.ok(Object.isFrozen(result));
  assert.ok(Object.values(summarize(calls,calls.length)).every(v=>v===0));
  for(const value of [-1,0.5,NaN,calls.length+1])assert.throws(()=>summarize(calls,value),{message:'Invalid diagnostic range.'});
});
