import { z } from 'zod';
import { intentRoleResultSchema } from '@steer/tool-registry/intent-role-result';
import { describeDevelopmentOriginal,developmentOriginalHash as hash,freezeOriginal as freeze } from './development-original-contracts.ts';
import { createDevelopmentOriginalStore,developmentRecordsConfigurationSchema } from './development-originals.ts';
import { createDevelopmentResultStore } from './development-results.ts';
import { createIntentOperationStore } from './intent-operations.ts';

const id=z.string().min(1).max(200).refine(v=>v.trim().length>0&&!/[\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(v));
const uuid=z.uuid().length(36).refine(v=>v===v.toLowerCase()),digest=z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const role=z.enum(['architect','test-agent']),revision=z.number().int().min(1).max(1000);
const targetSchema=z.strictObject({operationId:uuid,inputDigest:digest,role});
const checkpointSchema=z.strictObject({binding:z.strictObject({organizationId:id,operationId:uuid,stepId:z.literal('architect'),subject:id,
  draftId:uuid,draftRevision:revision,inputDigest:digest,configurationRevision:id}),resultRef:uuid,resultDigest:digest,recordsPolicyDigest:digest});
const predecessorSchema=z.strictObject({checkpoint:checkpointSchema,result:intentRoleResultSchema});
const renderSchema=z.strictObject({original:z.unknown(),operationId:uuid,role,predecessor:predecessorSchema.nullable()});
export type DevelopmentRequestTarget=z.infer<typeof targetSchema>;
class Unavailable extends Error {constructor(){super('Development request is unavailable.');}}

/** Deterministic private role context, NOT a dispatch permit or observed provider
 * request. Only instructions/source belong at the model adapter; keep the packet
 * itself out of workflow history, tracing, URLs and browser status responses.
 */
export async function renderDevelopmentRequest(raw:unknown) {
  try {
    const input=renderSchema.parse(raw),d=await describeDevelopmentOriginal(input.original),o=d.original,c=o.configuration,s=o.source;
    if((input.role==='architect')!==(input.predecessor===null))throw new Unavailable();
    const common={intent:s.content.originalText,clarificationTurns:s.content.clarificationTurns,
      originalDocuments:s.content.documents?{brief:s.content.documents.brief,spec:s.content.documents.spec}:null,
      direction:o.direction,scopeEvidence:d.evidence};
    const packet=(selected:'architect'|'test-agent',source:string,predecessor:{resultRef:string;resultDigest:string}|null)=>{
      const profile=selected==='architect'?o.profiles.architect:o.profiles.testAgent;
      return {kind:'steer-development-role-request/v1' as const,rendererRevision:'steer-role-context/v1' as const,
        organizationId:c.organizationId,subject:c.subject,operationId:input.operationId,inputDigest:d.inputDigest,
        draftId:s.draftId,draftRevision:s.revision,sourceRevisionDigest:s.revisionDigest,scopeInputDigest:s.scopeInputDigest,
        executionConfigurationDigest:hash(c),role:selected,predecessor,
        request:{profileRevision:profile.configurationRevision,runtimeRevision:profile.runtimeRevision,modelRoute:profile.modelRoute,
          maxOutputTokens:profile.maxOutputTokens,instructions:profile.instructions,source,
          outputContract:selected==='architect'?'steer-architect-output/v1' as const:'steer-exam-output/v1' as const}};
    };
    const fingerprint=(value:unknown)=>hash(['steer-development-role-input/v1',value]);
    // Project allowed fields explicitly. Never spread the stored editable snapshot:
    // it may contain an earlier Exam, which neither drafting role should inherit.
    const architect=packet('architect',JSON.stringify(common),null);
    let rendered=architect;
    if(input.predecessor){
      const p=input.predecessor,b=p.checkpoint.binding;
      if(input.role!=='test-agent'||p.result.role!=='architect'||p.result.output.questions.length||p.result.output.brief===null||p.result.output.spec===null
        ||b.organizationId!==c.organizationId||b.subject!==c.subject||b.operationId!==input.operationId||b.draftId!==s.draftId||b.draftRevision!==s.revision
        ||b.configurationRevision!==c.configurationRevision||b.inputDigest!==fingerprint(architect)||p.checkpoint.recordsPolicyDigest!==c.recordsPolicyDigest)throw new Unavailable();
      // Preserve source-revision Brief/Spec corrections separately from the new
      // candidate. Excluding those originals would lose user constraints. No prior
      // Exam, Architect commentary/questions or private conversation state.
      rendered=packet('test-agent',JSON.stringify({...common,brief:p.result.output.brief,spec:p.result.output.spec}),
        {resultRef:p.checkpoint.resultRef,resultDigest:p.checkpoint.resultDigest});
    }
    const stepInputDigest=fingerprint(rendered);
    if(Buffer.byteLength(JSON.stringify(rendered))>786432)throw new Unavailable();
    return freeze({rendered,stepReference:{operationId:input.operationId,inputDigest:d.inputDigest,stepId:input.role,stepInputDigest,
      predecessorResultDigest:input.predecessor?.checkpoint.resultDigest??null},executionAuthorized:false as const,retryAuthorized:false as const,gateSigned:false as const});
  }catch{throw new Unavailable();}
}

/** Uninstalled trusted-worker reader. Reconstruct only from actual encrypted
 * originals and a succeeded Architect checkpoint. Existing step input hashes must
 * match the renderer; sent/failed/unknown/completed own steps cannot be rendered as
 * new work. Operation-store claim/dispatch remains the separate effect boundary.
 */
export function createDevelopmentRequestReader(pools:Parameters<typeof createDevelopmentOriginalStore>[0],rawConfiguration:unknown,dependencies:{
  originals:Parameters<typeof createDevelopmentOriginalStore>[2];
  results:Parameters<typeof createDevelopmentResultStore>[2];
  authorizeRequest:(context:Readonly<{configuration:z.infer<typeof developmentRecordsConfigurationSchema>;target:DevelopmentRequestTarget}>)=>Promise<void>;
}){
  const config=freeze(developmentRecordsConfigurationSchema.parse(rawConfiguration));
  if(typeof dependencies.authorizeRequest!=='function')throw new Unavailable();
  const originals=createDevelopmentOriginalStore(pools,config,dependencies.originals),children=new Set<{close():void}>();
  let closed=false,active=false,pending=0;
  const bounded=async<T>(work:Promise<T>):Promise<T>=>{
    pending++;void work.finally(()=>{pending--;}).catch(()=>{});let timer:ReturnType<typeof setTimeout>|undefined;
    try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Unavailable()),5000);})]);}
    finally{if(timer)clearTimeout(timer);}
  };
  return{
    async read(raw:unknown){
      if(closed||active||pending)throw new Unavailable();active=true;
      let operations:ReturnType<typeof createIntentOperationStore>|undefined,results:ReturnType<typeof createDevelopmentResultStore>|undefined;
      try{
        const target=freeze(targetSchema.parse(raw)),ref={operationId:target.operationId,inputDigest:target.inputDigest};
        const authorize=async()=>{if(closed||await bounded(dependencies.authorizeRequest(freeze({configuration:config,target})))!==undefined||closed)throw new Unavailable();};
        await authorize();const original=await bounded(originals.read(ref));
        if(closed||original.operationExpired||original.latestDraftRevision!==original.original.source.revision)throw new Unavailable();
        const c=original.original.configuration;
        operations=createIntentOperationStore(pools.execution,c,{authorize:dependencies.originals.authorizeOperation,verifyCheckpoint:async()=>{throw new Unavailable();}});children.add(operations);
        results=createDevelopmentResultStore(pools,c,dependencies.results);children.add(results);
        const inspect=async()=>{const observed=await bounded(operations!.inspect(ref));
          if(closed||observed.outcome!=='ok'||observed.value.operation.draftId!==original.original.source.draftId
            ||observed.value.operation.draftRevision!==original.original.source.revision)throw new Unavailable();return observed.value;};
        let observed=await inspect(),predecessor:z.infer<typeof predecessorSchema>|null=null;
        if(target.role==='test-agent'){
          const step=observed.steps.find(v=>v.record.binding.stepId==='architect');
          if(!step||step.record.state!=='succeeded')throw new Unavailable();
          const result=await bounded(results.read({...ref,stepId:'architect'}));
          if(closed||result.checkpoint.resultRef!==step.resultRef||result.checkpoint.resultDigest!==step.record.resultDigest)throw new Unavailable();
          predecessor=predecessorSchema.parse({checkpoint:result.checkpoint,result:result.result});
        }
        const rendered=await renderDevelopmentRequest({original:original.original,operationId:target.operationId,role:target.role,predecessor});
        const checkSteps=(value:typeof observed)=>{
          const own=value.steps.find(v=>v.record.binding.stepId===target.role);
          if(own&&(own.record.state!=='claimed'||own.record.binding.inputDigest!==rendered.stepReference.stepInputDigest
            ||own.predecessorResultDigest!==rendered.stepReference.predecessorResultDigest))throw new Unavailable();
          if(predecessor){const current=value.steps.find(v=>v.record.binding.stepId==='architect');
            if(current?.record.state!=='succeeded'||current.resultRef!==predecessor.checkpoint.resultRef||current.record.resultDigest!==predecessor.checkpoint.resultDigest)throw new Unavailable();}
        };
        checkSteps(await inspect());
        if(predecessor)await bounded(results.verifyCheckpoint(predecessor.checkpoint));
        // Recheck content/evidence/key/lifecycle after operation and predecessor I/O.
        const final=await bounded(originals.read(ref));
        if(closed||final.operationExpired||final.latestDraftRevision!==original.original.source.revision||hash(final.original)!==hash(original.original))throw new Unavailable();
        checkSteps(await inspect());
        await authorize();return rendered;
      }catch{throw new Unavailable();}
      finally{for(const child of [operations,results])if(child){child.close();children.delete(child);}active=false;}
    },
    close(){closed=true;originals.close();for(const child of children)child.close();},
  };
}
