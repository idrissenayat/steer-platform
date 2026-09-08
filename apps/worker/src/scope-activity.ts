import type {createScopeStepRuntime} from './scope-step-runtime.ts';
import {parseScopeTarget,parseScopeStepTarget,parseScopePlanResult,parseScopeStepResult} from './scope-workflow-contracts.ts';

/** A dedicated fixed-review worker, never a public grant or default installation. */
export function createScopeActivities(raw:unknown,runtime:Pick<ReturnType<typeof createScopeStepRuntime>,'binding'|'plan'|'run'|'close'>){
  const target=parseScopeTarget(raw),binding=parseScopeTarget(runtime?.binding);
  if(JSON.stringify(target)!==JSON.stringify(binding)||[runtime?.plan,runtime?.run,runtime?.close].some(v=>typeof v!=='function'))throw new Error('Scope activity unavailable.');
  let closed=false,active=false,abortActive:(()=>void)|undefined;
  const close=()=>{if(closed)return;closed=true;abortActive?.();try{runtime.close();}catch{/* Never expose private close errors in history. */}};
  const call=async<T>(actual:ReturnType<typeof parseScopeTarget>,cancellation:AbortSignal,work:(signal:AbortSignal)=>Promise<unknown>,parse:(raw:unknown)=>T)=>{
    if(actual.organizationId!==target.organizationId||actual.reviewId!==target.reviewId||actual.preparationDigest!==target.preparationDigest
      ||closed||active||!(cancellation instanceof AbortSignal)||cancellation.aborted)throw new Error('Scope activity unavailable.');
    active=true;let pending=false,finished=false;const controller=new AbortController(),release=()=>{if(finished&&!pending)active=false;};
    abortActive=()=>controller.abort();const abort=()=>close();cancellation.addEventListener('abort',abort,{once:true});const deadline=setTimeout(abort,100000);
    let onAbort:(()=>void)|undefined;
    try{
      if(closed||cancellation.aborted)throw new Error();pending=true;
      const task=Promise.resolve().then(()=>{if(closed||controller.signal.aborted)throw new Error();return work(controller.signal);});
      void task.finally(()=>{pending=false;release();}).catch(()=>{});
      const result=await Promise.race([task,new Promise<never>((_,reject)=>{onAbort=()=>reject(new Error());controller.signal.addEventListener('abort',onAbort,{once:true});})]);
      if(closed||cancellation.aborted||controller.signal.aborted)throw new Error();return parse(result);
    }catch{throw new Error('Scope review requires attention.');}
    finally{clearTimeout(deadline);cancellation.removeEventListener('abort',abort);if(onAbort)controller.signal.removeEventListener('abort',onAbort);
      abortActive=undefined;controller.abort();finished=true;release();}
  };
  return{
    async readScopePlan(raw:unknown,signal:AbortSignal){const actual=parseScopeTarget(raw);return call(actual,signal,s=>runtime.plan(s),v=>parseScopePlanResult(v,actual));},
    async reviewScopeBatch(raw:unknown,signal:AbortSignal){const actual=parseScopeStepTarget(raw);return call(actual,signal,s=>runtime.run(actual.batchId,s),v=>parseScopeStepResult(v,actual));},
    close,status:()=>({active,closed}),
  };
}
