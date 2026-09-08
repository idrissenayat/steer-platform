import { z } from 'zod';
import { createRecordedMastraRuntime, type RecordedRequest, type RecordedResponse } from '@steer/agents/recorded-mastra';
import { createDevelopmentObservationStore, developmentObservationSchema } from '@steer/data/development-observations';
import { createDevelopmentOriginalStore, developmentRecordsConfigurationSchema } from '@steer/data/development-originals';
import { createIntentOperationStore } from '@steer/data/intent-operations';
import { developmentOriginalHash as hash, freezeOriginal as freeze } from '@steer/data/development-original-contracts';
import type { RecordedDevelopmentModel } from './development-step-runtime.ts';

const uuid=z.uuid().length(36).refine(v=>v===v.toLowerCase()),digest=z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const role=z.enum(['architect','test-agent']),targetSchema=z.strictObject({operationId:uuid,inputDigest:digest});
const bindingSchema=targetSchema.extend({organizationId:z.string(),stepId:role,stepInputDigest:digest,outputDigest:digest,recordsPolicyDigest:digest});
const executionSchema=z.strictObject({rendered:z.unknown(),owner:uuid,fencingToken:z.number().int().positive().safe(),reservationId:uuid});
type ModelInput=Parameters<RecordedDevelopmentModel['execute']>[0];
type ObservationDeps=Parameters<typeof createDevelopmentObservationStore>[2];
const unavailable=()=>new Error('Recorded development model is unavailable.');

/** Uninstalled fixed-operation binding for the step runner. The first acknowledged
 * request insertion is consumed once; recovering that row never authorizes a new
 * transport send. No separate provider, API registration or automatic retries.
 */
export function createRecordedDevelopmentModel(pools:Parameters<typeof createDevelopmentObservationStore>[0],rawConfiguration:unknown,rawTarget:unknown,dependencies:{
  records:ObservationDeps;
  gateway:Parameters<typeof createRecordedMastraRuntime>[0];
  authorize:(context:Readonly<{configuration:z.infer<typeof developmentRecordsConfigurationSchema>;target:z.infer<typeof targetSchema>&{stepId:z.infer<typeof role>};
    action:'read'|'dispatch'}>)=>Promise<void>;
}){
  const config=freeze(developmentRecordsConfigurationSchema.parse(rawConfiguration)),target=freeze(targetSchema.parse(rawTarget));
  if(typeof dependencies.authorize!=='function')throw unavailable();
  const runtime=createRecordedMastraRuntime(dependencies.gateway),originals=createDevelopmentOriginalStore(pools,config,dependencies.records.originals);
  const children=new Set<{close():void}>();let closed=false,active=false,pending=0,controller:AbortController|undefined;
  const guard=()=>{if(closed)throw unavailable();};
  const bounded=async<T>(work:Promise<T>):Promise<T>=>{
    pending++;void work.finally(()=>{pending--;}).catch(()=>{});let timer:ReturnType<typeof setTimeout>|undefined;
    try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(unavailable()),5000);})]);}
    finally{if(timer)clearTimeout(timer);}
  };
  const authorize=async(stepId:z.infer<typeof role>,action:'read'|'dispatch')=>{
    guard();if(await bounded(dependencies.authorize(freeze({configuration:config,target:{...target,stepId},action})))!==undefined)throw unavailable();guard();
  };
  const journal=()=>{guard();const store=createDevelopmentObservationStore(pools,config,dependencies.records);children.add(store);return store;};
  const closeChild=(child:{close():void})=>{child.close();children.delete(child);};
  async function currentDispatch(input:ModelInput,signal:AbortSignal){
    guard();signal.throwIfAborted();const r=input.rendered;
    if(r.organizationId!==config.organizationId||r.subject!==config.subject||r.operationId!==target.operationId||r.inputDigest!==target.inputDigest)throw unavailable();
    await authorize(r.role,'dispatch');signal.throwIfAborted();
    const restored=await bounded(originals.read(target));guard();signal.throwIfAborted();
    if(restored.operationExpired||restored.latestDraftRevision!==restored.original.source.revision||r.draftId!==restored.original.source.draftId||r.draftRevision!==restored.original.source.revision)throw unavailable();
    const operations=createIntentOperationStore(pools.execution,restored.original.configuration,{authorize:dependencies.records.originals.authorizeOperation,verifyCheckpoint:async()=>{throw unavailable();}});children.add(operations);
    try{
      await authorize(r.role,'dispatch');signal.throwIfAborted();
      // Authorization can itself await external policy. Recheck the original
      // source/expiry and actual SQL state after that final wait, before sending.
      const latest=await bounded(originals.read(target));guard();signal.throwIfAborted();
      if(latest.operationExpired||latest.latestDraftRevision!==restored.original.source.revision||hash(latest.original)!==hash(restored.original))throw unavailable();
      const observed=await bounded(operations.inspect(target));guard();signal.throwIfAborted();if(observed.outcome!=='ok')throw unavailable();
      const own=observed.value.steps.find(s=>s.record.binding.stepId===r.role);
      if(!own||own.record.state!=='dispatch-committed'||own.record.owner!==input.owner||own.record.fencingToken!==input.fencingToken||own.record.reservationId!==input.reservationId
        ||own.record.binding.inputDigest!==hash(['steer-development-role-input/v1',r]))throw unavailable();
    }finally{closeChild(operations);}
  }
  return{
    async execute(raw:ModelInput,cancellation:AbortSignal){
      if(closed||active||pending||!(cancellation instanceof AbortSignal)||cancellation.aborted)throw unavailable();active=true;
      const control=new AbortController();controller=control;const abort=()=>control.abort();cancellation.addEventListener('abort',abort,{once:true});
      let store:ReturnType<typeof journal>|undefined;
      try{
        const input=freeze(executionSchema.parse(structuredClone(raw))) as ModelInput;role.parse(input.rendered.role);
        await currentDispatch(input,control.signal);store=journal();let requestDigest:string|undefined;
        return await runtime.generate(input.rendered.role,input.rendered.request,{
          recordRequest:async observation=>{
            guard();control.signal.throwIfAborted();const payload=developmentObservationSchema.parse({stage:'request',...observation,rendered:input.rendered});
            const saved=await bounded(store!.put({...target,stepId:input.rendered.role,owner:input.owner,fencingToken:input.fencingToken,observation:payload}));guard();control.signal.throwIfAborted();
            // A repeated/lost-ACK request is a recovery record, never a new send.
            if(saved.outcome!=='stored'||!saved.created||saved.payloadDigest!==hash(payload))throw unavailable();requestDigest=saved.payloadDigest;
          },
          authorizeDispatch:async()=>{if(!requestDigest)throw unavailable();await currentDispatch(input,control.signal);},
          recordResponse:async observation=>{
            guard();control.signal.throwIfAborted();if(!requestDigest)throw unavailable();
            const saved=await bounded(store!.put({...target,stepId:input.rendered.role,owner:input.owner,fencingToken:input.fencingToken,
              observation:{stage:'response',requestDigest,...observation}}));guard();control.signal.throwIfAborted();
            if(saved.outcome!=='stored')throw unavailable();
          },
        },control.signal);
      }catch{throw unavailable();}
      finally{if(store)closeChild(store);cancellation.removeEventListener('abort',abort);abort();controller=undefined;active=false;}
    },
    async verify(raw:Parameters<RecordedDevelopmentModel['verify']>[0]){
      if(closed||active||pending)throw unavailable();active=true;let store:ReturnType<typeof journal>|undefined;
      try{
        const binding=freeze(bindingSchema.parse(raw));
        if(binding.organizationId!==config.organizationId||binding.operationId!==target.operationId||binding.inputDigest!==target.inputDigest||binding.recordsPolicyDigest!==config.recordsPolicyDigest)throw unavailable();
        await authorize(binding.stepId,'read');store=journal();
        const request=await bounded(store.read({...target,stepId:binding.stepId,stage:'request'}));guard();
        const response=await bounded(store.read({...target,stepId:binding.stepId,stage:'response'}));guard();
        if(request.observation.stage!=='request'||response.observation.stage!=='response'||response.observation.requestDigest!==request.payloadDigest
          ||request.stepInputDigest!==binding.stepInputDigest||response.stepInputDigest!==binding.stepInputDigest||response.outputDigest!==binding.outputDigest)throw unavailable();
        const rendered=request.observation.rendered as ModelInput['rendered'];
        const parsed=runtime.verify(binding.stepId,rendered.request,request.observation as RecordedRequest,response.observation as RecordedResponse);
        if(hash(parsed.result)!==binding.outputDigest)throw unavailable();await authorize(binding.stepId,'read');
      }catch{throw unavailable();}finally{if(store)closeChild(store);active=false;}
    },
    close(){closed=true;controller?.abort();originals.close();for(const child of children)child.close();},
  } satisfies RecordedDevelopmentModel&{close():void};
}
