import { intentDevelopmentHistoryInputSchema,verifyIntentDevelopmentHistoryOutput,type IntentDevelopmentHistoryReader,
  type IntentDevelopmentHistoryOutput } from '@steer/tool-registry/intent-development-history-contracts';
import { createDevelopmentOriginalStore,developmentRecordsConfigurationSchema } from './development-originals.ts';
import { createDevelopmentObservationStore } from './development-observations.ts';
import { createHistoricalDevelopmentOperationReader } from './intent-operations.ts';
import { developmentOriginalHash as hash,freezeOriginal as freeze } from './development-original-contracts.ts';
import { withHistoricalScopeReadWindow } from './historical-scope-read-window.ts';
import { bracketHistoricalReadAuthority } from './historical-read-authority.ts';
import { createReadPolicyAuthority } from './read-policy-authority.ts';

type Records=Parameters<typeof createDevelopmentObservationStore>[2];
const unavailable=()=>new Error('Development history is unavailable.');
/** Owner-authorized historical projection. Both SDK roles and their predecessor
 * chain must agree with one unchanged operation/source snapshot. No writes,
 * model transport, generation permission or raw exchange content is exposed. */
export function createIntentDevelopmentHistoryReader(pools:Parameters<typeof createDevelopmentOriginalStore>[0],rawConfiguration:unknown,records:Records){
  const config=freeze(developmentRecordsConfigurationSchema.parse(rawConfiguration)),r=records;
  const scope=freeze({organizationId:config.organizationId,subject:config.subject,productId:config.productId,repository:config.repository});
  if([r?.authorizeHistoricalRead,r?.verifyHistoricalExchange,r?.originals?.authorizeHistoricalRead,r?.originals?.authorizeOriginal,
    r?.originals?.authorizeDraft,r?.originals?.keyForDraft,r?.results?.authorizeHistoricalResult,r?.results?.authorizeDraft,r?.results?.keyForDraft]
    .some(v=>typeof v!=='function'))throw unavailable();
  let closed=false,running=0;const children=new Set<{close():void}>();
  return{
    scope,
    async read(raw,revalidate){
      const parsed=intentDevelopmentHistoryInputSchema.safeParse(raw);
      if(!parsed.success||closed||running>=4||typeof revalidate!=='function'
        ||(['organizationId','productId','repository'] as const).some(k=>parsed.data[k]!==scope[k]))throw unavailable();
      const input=freeze(parsed.data),target=freeze({operationId:input.operationId,inputDigest:input.inputDigest});running++;
      let finished=false,settled=false,pending=0,released=false,timer:ReturnType<typeof setTimeout>|undefined;
      const owned:{close():void}[]=[];
      const release=()=>{if(settled&&!pending&&!released){released=true;running--;}};
      const guard=()=>{if(closed||finished)throw unavailable();};
      const track=async<T>(work:Promise<T>):Promise<T>=>{pending++;try{return await work;}finally{pending--;release();}};
      const current=async()=>{guard();if(await track(Promise.resolve().then(revalidate))!==undefined)throw unavailable();guard();};
      const checked=async<T>(work:()=>Promise<T>)=>{await current();const value=await track(Promise.resolve().then(work));await current();return value;};
      const authority=createReadPolicyAuthority(current,track,guard);
      const denied=async()=>{throw unavailable();};
      // Memoize only exact deterministic SDK verification within this one read.
      // The final readback rechecks both roles after all SDK callbacks. Scope
      // lineage is composed inside a private full-read/final-full-read window;
      // intermediate reuse never escapes it or replaces caller authorization.
      const verified=new Map<string,string>();
      // Only the private window may supply this port. It already brackets every
      // original/source callback with current(), including nonvoid/late denial.
      // Adding checked()/authority() around it repeats the same barrier at every
      // nested scope read without introducing another IO or policy boundary.
      let scopeHistory:Records['originals']['scopeHistory'];
      const secure:Records={
        authorize:denied,
        authorizeHistoricalRead:context=>authority('read',()=>r.authorizeHistoricalRead!(context)),
        verifyHistoricalExchange:async context=>{
          const fingerprint=hash(context),prior=verified.get(context.role);
          if(prior!==undefined){if(prior!==fingerprint)throw unavailable();guard();return;}
          if(await checked(()=>r.verifyHistoricalExchange!(context))!==undefined)throw unavailable();
          verified.set(context.role,fingerprint);
        },
        originals:{
          authorize:denied,authorizeOperation:denied,
          authorizeHistoricalRead:context=>authority('read',()=>r.originals.authorizeHistoricalRead!(context)),
          authorizeOriginal:bracketHistoricalReadAuthority(current,async (context: Parameters<typeof r.originals.authorizeOriginal>[0])=>{
            if(context.action!=='read')throw unavailable();
            return r.originals.authorizeOriginal(context);
          },track,guard),
          authorizeDraft:context=>authority(context.action,()=>r.originals.authorizeDraft(context)),
          keyForDraft:(ref,keyId)=>{if(keyId===null)throw unavailable();return checked(()=>r.originals.keyForDraft(ref,keyId));},
          ...(r.originals.scopeHistory?{scopeHistory:{scope:r.originals.scopeHistory.scope,
            read:(input,recheck)=>{
              guard();if(!scopeHistory)throw unavailable();
              return track(scopeHistory.read(input,recheck));
            }}}:{}),
        },
        results:{
          authorizeOperation:denied,authorizeResult:denied,
          authorizeHistoricalResult:context=>authority(context.action,()=>r.results.authorizeHistoricalResult!(context)),
          authorizeDraft:context=>authority(context.action,()=>r.results.authorizeDraft(context)),
          keyForDraft:(ref,keyId)=>{if(keyId===null)throw unavailable();return checked(()=>r.results.keyForDraft(ref,keyId));},
        },
      };
      const scopedPools={drafts:{connect:()=>{guard();return track(pools.drafts.connect());}},execution:{connect:()=>{guard();return track(pools.execution.connect());}}};
      const own=<T extends{close():void}>(store:T):T=>{owned.push(store);children.add(store);return store;};
      const authorizeRoles=async()=>{for(const stepId of ['architect','test-agent'] as const)
        await secure.authorizeHistoricalRead!({configuration:config,target:{...target,stepId}});};
      const work=withHistoricalScopeReadWindow(r.originals.scopeHistory,current,async window=>{
        scopeHistory=window;
        await current();await authorizeRoles();
        const originals=own(createDevelopmentOriginalStore(scopedPools,config,secure.originals));
        const original=await originals.readHistorical(target);guard();const source=original.original.source;
        const operations=own(createHistoricalDevelopmentOperationReader(scopedPools.execution,original.original.configuration,{
          authorize:async({request})=>{if(hash(request)!==hash(target))throw unavailable();await authorizeRoles();},
        }));
        const observations=own(createDevelopmentObservationStore(scopedPools,config,secure));
        const inspect=async()=>{
          const result=await operations.inspectHistory(target);guard();
          if(result.operation.draftId!==source.draftId||result.operation.draftRevision!==source.revision)throw unavailable();
          return result;
        };
        const initial=await inspect(),results:IntentDevelopmentHistoryOutput['results']=[];
        for(const stepId of ['architect','test-agent'] as const){
          const step=initial.steps.find(s=>s.record.binding.stepId===stepId);if(step?.record.state!=='succeeded')continue;
          const saved=await observations.readHistoricalExchange({...target,stepId});guard();const ref=saved.resultReference;
          if(!ref||ref.resultRef!==step.resultRef||ref.resultDigest!==step.record.resultDigest
            ||saved.response.result.role!==stepId||saved.stepInputDigest!==step.record.binding.inputDigest
            ||ref.predecessorResultDigest!==step.predecessorResultDigest)throw unavailable();
          results.push({...ref,outputDigest:hash(saved.response.result),result:saved.response.result});
        }
        // The second role was verified with its retained predecessor, and this
        // projection independently verifies that predecessor's SDK exchange too.
        const architect=results.find(r=>r.result.role==='architect');
        if(results.some(r=>r.predecessorResultDigest!==(r.result.role==='architect'?null:architect?.resultDigest)))throw unavailable();
        await authorizeRoles();
        for(const captured of results){
          const reread=await observations.readHistoricalExchange({...target,stepId:captured.result.role});guard();
          if(hash(reread.response.result)!==captured.outputDigest||hash(reread.resultReference)!==hash({resultRef:captured.resultRef,
            resultDigest:captured.resultDigest,stepInputDigest:captured.stepInputDigest,predecessorResultDigest:captured.predecessorResultDigest}))throw unavailable();
        }
        const final=await originals.readHistorical(target);guard();
        if(hash(final.original)!==hash(original.original)||final.latestDraftRevision!==original.latestDraftRevision)throw unavailable();
        const last=await inspect();
        if(hash({operation:last.operation,steps:last.steps})!==hash({operation:initial.operation,steps:initial.steps}))throw unavailable();
        const steps=(['architect','test-agent'] as const).map(role=>({role,state:initial.steps.find(s=>s.record.binding.stepId===role)?.record.state??'pending'}));
        const questions=architect?.result.role==='architect'&&architect.result.output.questions.length>0;
        const status=steps.some(s=>['outcome-unknown','failed-known'].includes(s.state))?'attention-required'
          :questions?'needs-clarification':results.length===2?'complete':results.length===1?'partial':'pending';
        const output=await verifyIntentDevelopmentHistoryOutput({kind:'steer-development-history/v1',...input,historical:true,
          operationExpired:last.operationExpired,source:{draftId:source.draftId,revision:source.revision,revisionDigest:source.revisionDigest,
            scopeInputDigest:source.scopeInputDigest,latestRevision:final.latestDraftRevision},status,steps,results,
          savedToGit:false,gateSigned:false,executionAuthorized:false,retryAuthorized:false,semanticQualityVerified:false});
        await current();return freeze(output);
      });
      void work.finally(()=>{settled=true;release();}).catch(()=>{});
      try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(unavailable()),30000);})]);}
      catch{throw unavailable();}
      finally{finished=true;if(timer)clearTimeout(timer);for(const child of owned){child.close();children.delete(child);}}
    },
    close(){closed=true;for(const child of children)child.close();},
  } satisfies IntentDevelopmentHistoryReader&{close():void};
}
