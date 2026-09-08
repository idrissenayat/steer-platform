import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {prepareIntentScopeReview,scopeReviewProfileSchema} from '@steer/tool-registry/intent-scope-review';
import {createRecordedScopeMastraRuntime,createRecordedScopeMastraVerifier} from '@steer/agents/recorded-mastra';
import {createScopeReviewOriginalStore,scopeRecordsConfigurationSchema} from '@steer/data/scope-review-originals';
import {createScopeReviewObservationStore} from '@steer/data/scope-review-observations';
import {createScopeReviewOperationStore,describeScopeReviewCheckpoint} from '@steer/data/scope-review-operations';
import {scopeOriginalHash as hash,freezeScopeOriginal as freeze,type ScopeOriginal} from '@steer/data/scope-original-contracts';

const uuid=z.uuid().length(36).refine(v=>v===v.toLowerCase()),digest=z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const targetSchema=z.strictObject({reviewId:uuid,preparationDigest:digest});
type Target=z.infer<typeof targetSchema>;
type Records=Parameters<typeof createScopeReviewObservationStore>[2];
type Packet=Awaited<ReturnType<typeof prepareIntentScopeReview>>['batches'][number]['packet'];
type Step=Awaited<ReturnType<ReturnType<typeof createScopeReviewOperationStore>['inspect']>>;
type Batch=Extract<Step,{outcome:'ok'}>['value']['batches'][number];
type Outcome='succeeded'|'superseded'|'attention-required'|'busy';
const unavailable=()=>new Error('Scope runtime is unavailable.');

/** Disabled one-batch composition over real SQL ownership, encrypted observations
 * and the pinned recorded SDK. A new dispatch ACK AND newly inserted request are
 * required for transport. Restart reads completed work; it cannot resend sent,
 * unknown or failed work. No separate private result copy or semantic clearance.
 */
export function createScopeStepRuntime(pools:Parameters<typeof createScopeReviewOriginalStore>[0],rawConfiguration:unknown,rawTarget:unknown,dependencies:{
  records:Omit<Records,'verifyObservation'>;profile:unknown;
  gateway:Pick<Parameters<typeof createRecordedScopeMastraRuntime>[0],'gatewayUrl'|'gatewayKey'|'transport'>;
  authorize:(context:Readonly<{configuration:z.infer<typeof scopeRecordsConfigurationSchema>;target:Target&{batchId:string};
    action:'observe'|'dispatch';execution:ScopeOriginal['configuration']|null;packet:Packet|null}>)=>Promise<void>;
},options:{maxDurationMs?:number}={}){
  const config=freeze(scopeRecordsConfigurationSchema.parse(rawConfiguration)),target=freeze(targetSchema.parse(rawTarget)),owner=randomUUID();
  const profile=freeze(scopeReviewProfileSchema.parse(dependencies.profile)),duration=z.number().int().min(1000).max(90000).parse(options.maxDurationMs??90000);
  const r=dependencies.records;
  if([dependencies.authorize,r?.authorize,r?.originals?.authorize,r?.originals?.authorizeOriginal,r?.originals?.authorizeReview,
    r?.originals?.authorizeDraft,r?.originals?.keyForDraft].some(v=>typeof v!=='function'))throw unavailable();
  let closed=false,active=false,pending=0,controller:AbortController|undefined;
  const children=new Set<{close():void}>();
  // Track the underlying dependency, not only a child store's timeout race.
  const track=async<T>(work:()=>Promise<T>,cancelable=true):Promise<T>=>{
    pending++;const signal=controller?.signal;
    try{if(cancelable&&(closed||signal?.aborted))throw unavailable();const value=await work();
      if(cancelable&&(closed||signal?.aborted))throw unavailable();return value;
    }finally{pending--;}
  };
  // A fetch resolves at headers, not at body/connection cleanup. Preserve native
  // response metadata (including redirect status) while tracking the SDK's reads
  // and fire-and-forget cancellation against the same admission slot.
  const observeResponse=(response:Response):Response=>{
    const body=response.body;if(!body)return response;
    const observedBody=new Proxy(body,{get(object,key){
      if(key==='cancel')return(reason?:unknown)=>track(()=>object.cancel(reason),false);
      if(key==='getReader')return(...args:unknown[])=>{
        const reader=Reflect.apply(object.getReader,object,args) as ReadableStreamDefaultReader<Uint8Array>;
        return new Proxy(reader,{get(object,key){
          if(key==='read')return()=>track(()=>object.read(),false);
          if(key==='cancel')return(reason?:unknown)=>track(()=>object.cancel(reason),false);
          const value=Reflect.get(object,key,object);return typeof value==='function'?value.bind(object):value;
        }});
      };
      const value=Reflect.get(object,key,object);return typeof value==='function'?value.bind(object):value;
    }});
    return new Proxy(response,{get(object,key){if(key==='body')return observedBody;
      const value=Reflect.get(object,key,object);return typeof value==='function'?value.bind(object):value;
    }});
  };
  const records:Records={
    authorize:ctx=>track(()=>r.authorize(ctx)),
    originals:{authorize:ctx=>track(()=>r.originals.authorize(ctx)),
      authorizeOriginal:ctx=>track(async()=>{if(hash(ctx.original.profile)!==hash(profile))throw unavailable();
        if(await r.originals.authorizeOriginal(ctx)!==undefined)throw unavailable();}),
      // Metadata quarantine still needs current authority after cancellation.
      authorizeReview:ctx=>track(()=>r.originals.authorizeReview(ctx),false),
      authorizeDraft:ctx=>track(()=>r.originals.authorizeDraft(ctx)),keyForDraft:(ref,keyId)=>track(()=>r.originals.keyForDraft(ref,keyId))},
    verifyObservation:ctx=>track(async()=>{
      const codec=await createRecordedScopeMastraVerifier({scope:ctx.original.source.scope,evidence:ctx.original.evidence,profile});
      const wire={adapterRevision:ctx.request.adapterRevision,protocol:ctx.request.protocol,requestBody:ctx.request.requestBody};codec.verifyRequest(ctx.batchId,wire);
      if(ctx.response)codec.verify(ctx.batchId,wire,{responseBody:ctx.response.responseBody,providerRequestId:ctx.response.providerRequestId,usage:ctx.response.usage,result:ctx.response.result});
    }),
  };
  const scopedPools={drafts:{connect:()=>track(()=>pools.drafts.connect(),false)},execution:{connect:()=>track(()=>pools.execution.connect(),false)}};
  const originals=createScopeReviewOriginalStore(scopedPools,config,records.originals);
  const result=(batchId:string,outcome:Outcome,resultDigest:string|null=null)=>freeze({kind:'steer-scope-step-outcome/v1' as const,...target,batchId,outcome,resultDigest,
    semanticQualityVerified:false as const,authoritativeClearance:false as const,executionAuthorized:false as const,retryAuthorized:false as const,gateSigned:false as const});
  return{
    async run(rawBatchId:unknown,cancellation:AbortSignal){
      const batchId=digest.parse(rawBatchId);if(!(cancellation instanceof AbortSignal))throw unavailable();
      if(closed||active||pending||cancellation.aborted)return result(batchId,'busy');active=true;
      const control=new AbortController();controller=control;const abort=()=>control.abort();cancellation.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,duration);
      const guard=()=>{if(closed||control.signal.aborted)throw unavailable();};
      const within=async<T>(work:Promise<T>,ms=5000,cancelable=true):Promise<T>=>{
        pending++;void work.finally(()=>{pending--;}).catch(()=>{});let timeout:ReturnType<typeof setTimeout>|undefined,onAbort:(()=>void)|undefined;
        try{if(cancelable)guard();return await Promise.race([work,new Promise<never>((_,reject)=>{
          onAbort=()=>reject(unavailable());if(cancelable)control.signal.addEventListener('abort',onAbort,{once:true});timeout=setTimeout(()=>reject(unavailable()),ms);
        })]);}finally{if(timeout)clearTimeout(timeout);if(onAbort)control.signal.removeEventListener('abort',onAbort);}
      };
      let operations:ReturnType<typeof createScopeReviewOperationStore>|undefined,journal:ReturnType<typeof createScopeReviewObservationStore>|undefined;
      let execution:ScopeOriginal['configuration']|null=null,packet:Packet|null=null;
      let reference:(Target&{batchId:string;inputDigest:string})|undefined,fence:number|undefined,dispatchAttempted=false;
      const authorize=async(action:'observe'|'dispatch')=>{guard();if(await within(dependencies.authorize(freeze({configuration:config,target:{...target,batchId},action,execution,packet})))!==undefined)throw unavailable();guard();};
      try{
        await authorize('observe');const original=await within(originals.read(target));guard();if(original.reviewExpired)throw unavailable();execution=original.original.configuration;
        const prepared=await within(prepareIntentScopeReview(original.original.source.scope,original.original.evidence,profile));guard();
        const batch=prepared.batches.find(b=>b.metadata.batchId===batchId);
        if(!batch||prepared.preparationDigest!==target.preparationDigest)throw unavailable();packet=batch.packet;reference={...target,batchId,inputDigest:batch.inputDigest};
        journal=createScopeReviewObservationStore(scopedPools,config,records);children.add(journal);
        operations=createScopeReviewOperationStore(scopedPools.execution,execution,{authorize:records.originals.authorizeReview,verifyCheckpoint:async ref=>{
          guard();const saved=await journal!.read({...target,batchId,stage:'response'});guard();
          if(saved.requiresOutcomeResolution||!saved.checkpoint||hash(saved.checkpoint)!==hash(ref)||saved.payloadDigest!==ref.resultDigest)throw unavailable();
        }});
        const inspect=async()=>{const read=await within(operations!.inspect(target));guard();
          if(read.outcome!=='ok'||hash(read.value.manifest)!==hash(original.manifest))throw unavailable();return read.value.batches.find(s=>s.binding.stepId===batchId);};
        const completed=async(step:Batch)=>{
          if(step.state!=='succeeded'||!step.resultDigest)throw unavailable();
          const saved=await within(journal!.read({...target,batchId,stage:'response'}));guard();
          const ref=describeScopeReviewCheckpoint(execution!,target.preparationDigest,step,step.resultDigest);
          if(saved.batchState!=='succeeded'||saved.requiresOutcomeResolution||!saved.checkpoint||hash(saved.checkpoint)!==hash(ref)||saved.payloadDigest!==step.resultDigest)throw unavailable();
          await authorize('observe');const final=await within(originals.read(target));guard();
          if(final.reviewExpired||hash(final.original)!==hash(original.original)||hash(await inspect())!==hash(step))throw unavailable();
          await authorize('observe');
          return result(batchId,final.latestDraftRevision!==original.original.source.revision?'superseded':'succeeded',step.resultDigest);
        };
        const existing=await inspect();
        if(existing?.state==='succeeded')return await completed(existing);
        if(existing&&existing.state!=='claimed')return result(batchId,'attention-required');
        if(original.latestDraftRevision!==original.original.source.revision)return result(batchId,'superseded');
        // Validate the configured SDK/gateway before reserving new work. Creating
        // this binding does not send a request; completed recovery never needs it.
        const runtime=await within(createRecordedScopeMastraRuntime({...dependencies.gateway,scope:original.original.source.scope,evidence:original.original.evidence,profile,
          transport:(input,init)=>track(async()=>{
            guard();const response=await (dependencies.gateway.transport??globalThis.fetch)(input,init);
            if(closed||control.signal.aborted){await response.body?.cancel();throw unavailable();}
            return observeResponse(response);
          },false)}));guard();
        await authorize('dispatch');const claimed=await within(operations.claim({...reference,owner,leaseMs:30000}));guard();
        if(claimed.outcome!=='ok'||claimed.value.state!=='claimed'||claimed.value.owner!==owner)return result(batchId,'busy');
        fence=claimed.value.fencingToken;const reservationId=uuid.parse(claimed.value.reservationId);
        const currentSource=async()=>{const current=await within(originals.read(target));guard();
          if(current.reviewExpired||current.latestDraftRevision!==original.original.source.revision||hash(current.original)!==hash(original.original))throw unavailable();};
        await authorize('dispatch');await currentSource();guard();dispatchAttempted=true;
        const committed=await within(operations.transition({...reference,event:{type:'commit-dispatch',owner,fencingToken:fence}}));guard();
        if(committed.outcome!=='ok'||!committed.dispatchAllowed)throw unavailable();
        const currentDispatch=async()=>{await authorize('dispatch');await currentSource();const sent=await inspect();
          if(!sent||sent.state!=='dispatch-committed'||sent.owner!==owner||sent.fencingToken!==fence||sent.reservationId!==reservationId||sent.binding.inputDigest!==batch.inputDigest)throw unavailable();};
        await currentDispatch();let requestDigest:string|undefined,responseDigest:string|undefined,outputDigest:string|undefined;
        const generated=await within(runtime.generate(batchId,{
          recordRequest:async request=>{guard();const payload={stage:'request' as const,...request,rendered:batch.packet};
            const saved=await within(journal!.put({...target,batchId,owner,fencingToken:fence,observation:payload}));guard();
            if(saved.outcome!=='stored'||!saved.created)throw unavailable();requestDigest=saved.payloadDigest;},
          authorizeDispatch:async()=>{if(!requestDigest)throw unavailable();await currentDispatch();},
          recordResponse:async response=>{guard();if(!requestDigest)throw unavailable();
            const saved=await within(journal!.put({...target,batchId,owner,fencingToken:fence,observation:{stage:'response',requestDigest,...response}}));guard();
            if(saved.outcome!=='stored')throw unavailable();responseDigest=saved.payloadDigest;outputDigest=hash(response.result);},
        },control.signal),duration);guard();if(!responseDigest||hash(generated)!==outputDigest)throw unavailable();
        const checkpoint=await within(operations.transition({...reference,event:{type:'checkpoint',owner,fencingToken:fence,resultDigest:responseDigest}}));guard();
        if(checkpoint.outcome!=='ok')throw unavailable();return await completed(checkpoint.value);
      }catch{
        control.abort();if(dispatchAttempted&&operations&&reference&&fence)try{
          await within(operations.transition({...reference,event:{type:'outcome-unknown',owner,fencingToken:fence}}),5000,false);
        }catch{/* Current authority may deny quarantine; sent state still denies resend. */}
        return result(batchId,'attention-required');
      }finally{clearTimeout(timer);cancellation.removeEventListener('abort',abort);control.abort();controller=undefined;
        operations?.close();if(journal){journal.close();children.delete(journal);}active=false;}
    },
    close(){closed=true;controller?.abort();originals.close();for(const child of children)child.close();},
  };
}
