import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { intentRoleResultSchema,type IntentRoleResult } from '@steer/tool-registry/intent-role-result';
import { createDevelopmentOriginalStore,developmentRecordsConfigurationSchema } from '@steer/data/development-originals';
import { createDevelopmentRequestReader,type renderDevelopmentRequest } from '@steer/data/development-requests';
import { createDevelopmentResultStore } from '@steer/data/development-results';
import { createIntentOperationStore,type IntentCheckpointReference } from '@steer/data/intent-operations';
import { developmentOriginalHash as hash,freezeOriginal as freeze } from '@steer/data/development-original-contracts';

type Prepared=Awaited<ReturnType<typeof renderDevelopmentRequest>>;
type ReaderDependencies=Parameters<typeof createDevelopmentRequestReader>[2];
type Execution=Awaited<ReturnType<ReturnType<typeof createDevelopmentOriginalStore>['read']>>['original']['configuration'];
const uuid=z.uuid().length(36).refine(v=>v===v.toLowerCase()),digest=z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const roleSchema=z.enum(['architect','test-agent']);
type Role=z.infer<typeof roleSchema>;
const targetSchema=z.strictObject({operationId:uuid,inputDigest:digest});
type Target=z.infer<typeof targetSchema>;
export type DevelopmentObservationBinding=Readonly<{organizationId:string;operationId:string;stepId:Role;inputDigest:string;
  stepInputDigest:string;outputDigest:string;recordsPolicyDigest:string}>;
/** Live binding is deliberately uninstalled. execute must capture the actual
 * adapter request/response/usage before returning; verify must independently read
 * those durable observations under current authority. A void fixture is no proof.
 * No automatic provider retries or implicit environment-selected model clients.
 */
export interface RecordedDevelopmentModel {
  execute(input:Readonly<{rendered:Prepared['rendered'];owner:string;fencingToken:number;reservationId:string}>,signal:AbortSignal):Promise<unknown>;
  verify(binding:DevelopmentObservationBinding):Promise<void>;
}
type Outcome='succeeded'|'needs-clarification'|'superseded'|'attention-required'|'busy';

/** Uninstalled one-step orchestration over actual operation/request/result stores.
 * Fixed operation identity; only a freshly acknowledged SQL dispatch reaches the
 * model port. A restart observes succeeded checkpoints and never resends unknown
 * work. Recorded-model composition exists separately; live authority is unbound.
 */
export function createDevelopmentStepRuntime(pools:Parameters<typeof createDevelopmentRequestReader>[0],rawConfiguration:unknown,rawTarget:unknown,dependencies:{
  reader:ReaderDependencies;model:RecordedDevelopmentModel;
  authorize:(context:Readonly<{configuration:z.infer<typeof developmentRecordsConfigurationSchema>;target:Target&{role:Role};
    action:'observe'|'dispatch';request:Prepared['rendered']|null;execution:Execution|null}>)=>Promise<void>;
},options:{maxDurationMs?:number}={}){
  const config=freeze(developmentRecordsConfigurationSchema.parse(rawConfiguration)),target=freeze(targetSchema.parse(rawTarget)),owner=randomUUID();
  const duration=z.number().int().min(1000).max(90000).parse(options.maxDurationMs??90000);
  if(typeof dependencies.authorize!=='function'||typeof dependencies.model?.execute!=='function'||typeof dependencies.model?.verify!=='function')throw new Error('Development runtime unavailable.');
  const originals=createDevelopmentOriginalStore(pools,config,dependencies.reader.originals),requests=createDevelopmentRequestReader(pools,config,dependencies.reader);
  let closed=false,active=false,pending=0,controller:AbortController|undefined;
  const outcome=(role:Role,state:Outcome,checkpoint?:IntentCheckpointReference)=>freeze({kind:'steer-development-step-outcome/v1' as const,...target,role,outcome:state,
    resultRef:checkpoint?.resultRef??null,resultDigest:checkpoint?.resultDigest??null,gateSigned:false as const,executionAuthorized:false as const,retryAuthorized:false as const});
  return{
    async run(rawRole:unknown,cancellation:AbortSignal){
      const role=roleSchema.parse(rawRole);
      if(!(cancellation instanceof AbortSignal))throw new Error('Development runtime unavailable.');
      if(closed||active||pending||!cancellation||cancellation.aborted)return outcome(role,'busy');active=true;
      const signal=new AbortController();controller=signal;const abort=()=>signal.abort();cancellation.addEventListener('abort',abort,{once:true});
      const timer=setTimeout(abort,duration);
      let operations:ReturnType<typeof createIntentOperationStore>|undefined,results:ReturnType<typeof createDevelopmentResultStore>|undefined;
      let prepared:Prepared|undefined,fence:number|undefined,dispatchAttempted=false;
      let executionConfig:Execution|null=null;
      const guard=()=>{if(closed||signal.signal.aborted)throw new Error();};
      const within=async<T>(work:Promise<T>,ms=5000,observeCancellation=true):Promise<T>=>{
        pending++;void work.finally(()=>{pending--;}).catch(()=>{});let timeout:ReturnType<typeof setTimeout>|undefined,onAbort:(()=>void)|undefined;
        try{
          if(observeCancellation)guard();
          return await Promise.race([work,new Promise<never>((_,reject)=>{
            onAbort=()=>reject(new Error());if(observeCancellation)signal.signal.addEventListener('abort',onAbort,{once:true});timeout=setTimeout(()=>reject(new Error()),ms);
          })]);
        }finally{if(timeout)clearTimeout(timeout);if(onAbort)signal.signal.removeEventListener('abort',onAbort);}
      };
      const authorize=async(action:'observe'|'dispatch',request:Prepared['rendered']|null=null)=>{
        guard();if(await within(dependencies.authorize(freeze({configuration:config,target:{...target,role},action,request,execution:executionConfig})))!==undefined)throw new Error();guard();
      };
      const verify=async(checkpoint:IntentCheckpointReference,result:IntentRoleResult)=>{
        guard();
        const b=checkpoint.binding;if(b.stepId!=='architect'&&b.stepId!=='test-agent')throw new Error();
        if(b.organizationId!==config.organizationId||b.subject!==config.subject||b.operationId!==target.operationId||result.role!==b.stepId)throw new Error();
        if(await within(dependencies.model.verify(freeze({organizationId:config.organizationId,...target,stepId:b.stepId,
          stepInputDigest:b.inputDigest,outputDigest:hash(result),recordsPolicyDigest:config.recordsPolicyDigest})))!==undefined)throw new Error();guard();
      };
      const completed=async(checkpoint:IntentCheckpointReference)=>{
        guard();
        const restored=await within(results!.read({...target,stepId:role}));guard();
        if(restored.checkpoint.resultRef!==checkpoint.resultRef||restored.checkpoint.resultDigest!==checkpoint.resultDigest)throw new Error();
        await verify(restored.checkpoint,restored.result);const current=await within(originals.read(target));guard();
        if(current.operationExpired)throw new Error();await authorize('observe');
        const state=current.latestDraftRevision!==restored.sourceDraftRevision?'superseded':restored.result.role==='architect'&&restored.result.output.questions.length?'needs-clarification':'succeeded';
        return outcome(role,state,restored.checkpoint);
      };
      try{
        await authorize('observe');const original=await within(originals.read(target));guard();
        if(original.operationExpired)throw new Error();const execution=original.original.configuration;executionConfig=execution;
        results=createDevelopmentResultStore(pools,execution,dependencies.reader.results);
        operations=createIntentOperationStore(pools.execution,execution,{authorize:dependencies.reader.originals.authorizeOperation,verifyCheckpoint:async ref=>{
          guard();await results!.verifyCheckpoint(ref);guard();const prior=await results!.read({...target,stepId:ref.binding.stepId});guard();
          await verify(ref,prior.result);
        }});
        const observed=await within(operations.inspect(target));guard();if(observed.outcome!=='ok')throw new Error();
        const existing=observed.value.steps.find(s=>s.record.binding.stepId===role);
        if(existing?.record.state==='succeeded'&&existing.resultRef&&existing.record.resultDigest)return await completed({binding:existing.record.binding,resultRef:existing.resultRef,resultDigest:existing.record.resultDigest,recordsPolicyDigest:config.recordsPolicyDigest});
        if(existing&&existing.record.state!=='claimed')return outcome(role,'attention-required');
        prepared=await within(requests.read({...target,role}));await authorize('dispatch',prepared.rendered);
        const claimed=await within(operations.claim({...prepared.stepReference,owner,leaseMs:30000}));guard();
        if(claimed.outcome!=='ok'||claimed.value.record.state!=='claimed'||claimed.value.record.owner!==owner)return outcome(role,'busy');
        fence=claimed.value.record.fencingToken;
        const reservationId=uuid.parse(claimed.value.record.reservationId);
        const current=await within(requests.read({...target,role}));if(hash(current)!==hash(prepared))throw new Error();
        await authorize('dispatch',current.rendered);guard();dispatchAttempted=true;
        const committed=await within(operations.transition({...prepared.stepReference,event:{type:'commit-dispatch',owner,fencingToken:fence}}));
        guard();if(committed.outcome!=='ok'||!committed.dispatchAllowed)throw new Error();
        await authorize('dispatch',prepared.rendered);guard();
        const beforeModel=await within(originals.read(target));guard();
        if(beforeModel.operationExpired||beforeModel.latestDraftRevision!==original.original.source.revision||hash(beforeModel.original)!==hash(original.original))throw new Error();
        const finalState=await within(operations.inspect(target));guard();if(finalState.outcome!=='ok')throw new Error();
        const sent=finalState.value.steps.find(s=>s.record.binding.stepId===role);
        if(!sent||sent.record.state!=='dispatch-committed'||sent.record.owner!==owner||sent.record.fencingToken!==fence
          ||sent.record.reservationId!==reservationId)throw new Error();
        const result=intentRoleResultSchema.parse(await within(dependencies.model.execute(freeze({rendered:prepared.rendered,owner,fencingToken:fence,
          reservationId}),signal.signal),duration));guard();
        if(result.role!==role)throw new Error();
        const binding={organizationId:config.organizationId,...target,stepId:role,stepInputDigest:prepared.stepReference.stepInputDigest,outputDigest:hash(result),recordsPolicyDigest:config.recordsPolicyDigest};
        if(await within(dependencies.model.verify(freeze(binding)))!==undefined)throw new Error();guard();
        const captured=await within(results.put({...target,stepId:role,owner,fencingToken:fence,result}));guard();
        if(captured.outcome!=='stored')throw new Error();
        const checkpointed=await within(operations.transition({...prepared.stepReference,event:{type:'checkpoint',owner,fencingToken:fence,
          resultRef:captured.checkpoint.resultRef,resultDigest:captured.checkpoint.resultDigest}}));guard();
        if(checkpointed.outcome!=='ok'||checkpointed.value.record.state!=='succeeded')throw new Error();
        return await completed(captured.checkpoint);
      }catch{
        signal.abort();
        if(dispatchAttempted&&operations&&prepared&&fence)try{
          // Metadata-only quarantine under the current operation grant. If access
          // is gone, the durable dispatch-committed state still prevents resend.
          await within(operations.transition({...prepared.stepReference,event:{type:'outcome-unknown',fencingToken:fence}}),5000,false);
        }catch{/* Never replace uncertainty with retry permission. */}
        return outcome(role,'attention-required');
      }finally{
        clearTimeout(timer);cancellation.removeEventListener('abort',abort);signal.abort();controller=undefined;
        operations?.close();results?.close();active=false;
      }
    },
    close(){closed=true;controller?.abort();originals.close();requests.close();},
  };
}
