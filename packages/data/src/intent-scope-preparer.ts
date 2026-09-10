import {intentScopePrepareInputSchema,intentScopePrepareOutputSchema,type IntentScopePreparer,
  type IntentScopePrepareInput,type IntentScopePrepareOutput} from '@steer/tool-registry/intent-scope-prepare-contracts';
import {intentEvidenceInputSchema} from '@steer/tool-registry/intent-evidence-contracts';
import {planIntentScopeBatches} from '@steer/tool-registry/intent-scope-batches';
import {createDraftRevisionStore} from './draft-revisions.ts';
import {createScopeReviewOperationStore,scopeReviewConfigurationSchema} from './scope-review-operations.ts';
import {createScopeReviewOriginalStore,scopeRecordsConfigurationSchema} from './scope-review-originals.ts';
import {describeScopeOriginal,scopeOriginalSchema,scopeOriginalHash as hash,freezeScopeOriginal as freeze,type ScopeOriginal} from './scope-original-contracts.ts';
import {withPreparationEvidence,type PreparationEvidenceWindow} from './preparation-evidence-window.ts';
import {createReadPolicyAuthority} from './read-policy-authority.ts';
import {withDraftReadSession} from './draft-read-session.ts';

type Records=Parameters<typeof createScopeReviewOriginalStore>[2];
const unavailable=()=>new Error('Scope preparation is unavailable.');
class Conflict extends Error {}

/** Explicit, uninstalled exact-source admission. Configuration/profile/expiry are
 * server-fixed; current evidence, records and preparation authorities are required.
 * No model transport, reservation, workflow start or publication exists here. */
export function createIntentScopePreparer(pools:Parameters<typeof createScopeReviewOriginalStore>[0],rawConfiguration:unknown,
  rawProfile:unknown,deps:{records:Records;evidenceFor(input:Readonly<IntentScopePrepareInput>,revalidate:()=>Promise<void>):Promise<unknown>;
    // Trusted read-only recheck composition; never encloses admission or puts.
    withEvidenceRead?(input:Readonly<IntentScopePrepareInput>,revalidate:()=>Promise<void>,work:Parameters<PreparationEvidenceWindow>[0]):Promise<void>;
    authorizePreparation(original:Readonly<ScopeOriginal>):Promise<void>}){
  const execution=freeze(scopeReviewConfigurationSchema.parse(rawConfiguration));
  const {expiresAt:_expiry,budget:_budget,scopeTerms:_terms,...recordsConfig}=execution;
  const config=freeze(scopeRecordsConfigurationSchema.parse(recordsConfig)),profile=freeze(scopeOriginalSchema.shape.profile.parse(rawProfile)),r=deps.records;
  if([r?.authorize,r?.authorizeOriginal,r?.authorizeReview,r?.authorizeDraft,r?.keyForDraft,deps.evidenceFor,deps.authorizePreparation].some(v=>typeof v!=='function'))throw unavailable();
  if(deps.withEvidenceRead!==undefined&&typeof deps.withEvidenceRead!=='function')throw unavailable();
  const scope=freeze({organizationId:config.organizationId,subject:config.subject,productId:config.productId,repository:config.repository,configurationRevision:config.configurationRevision});
  let closed=false,active=0;const children=new Set<{close():void}>();
  return{
    scope,
    async prepare(raw,revalidate){
      const input=freeze(intentScopePrepareInputSchema.parse(raw));
      if(closed||active>=4||typeof revalidate!=='function'||(['organizationId','productId','repository','configurationRevision'] as const).some(k=>input[k]!==scope[k]))throw unavailable();
      active++;let finished=false,settled=false,pending=0,released=false,effectPossible=false,timer:ReturnType<typeof setTimeout>|undefined;
      const evidenceWindow=deps.withEvidenceRead;
      let reference:IntentScopePrepareOutput['reference']=null,coverage:IntentScopePrepareOutput['coverage']=null;
      const owned:{close():void}[]=[],release=()=>{if(settled&&!pending&&!released){released=true;active--;}};
      const guard=()=>{if(finished||closed||deps.withEvidenceRead!==evidenceWindow)throw unavailable();};
      const track=async<T>(work:Promise<T>)=>{pending++;try{return await work;}finally{pending--;release();}};
      const current=async()=>{guard();if(await track(Promise.resolve().then(revalidate))!==undefined)throw unavailable();guard();};
      const checked=async<T>(work:()=>Promise<T>)=>{await current();const value=await track(Promise.resolve().then(work));await current();return value;};
      const authority=async(work:()=>Promise<void>)=>{if(await checked(work)!==undefined)throw unavailable();};
      const readAuthority=createReadPolicyAuthority(current,track,guard);
      // Only metadata permission queries use the read path. Admission, puts,
      // preparation approval and all key/content IO retain full caller brackets.
      const recordsAuthority=(action:'put'|'read',work:()=>Promise<void>)=>action==='read'?readAuthority(action,work):authority(work);
      const scopedPools={drafts:{connect:()=>{guard();return track(pools.drafts.connect());}},execution:{connect:()=>{guard();return track(pools.execution.connect());}}};
      const own=<T extends{close():void}>(store:T)=>{owned.push(store);children.add(store);return store;};
      const output=(outcome:IntentScopePrepareOutput['outcome'])=>freeze(intentScopePrepareOutputSchema.parse({...input,kind:'steer-scope-prepare/v1',outcome,
        reference:['prepared','unknown'].includes(outcome)?reference:null,coverage,originalPreserved:outcome==='prepared',readyToRequestStart:outcome==='prepared',
        modelCallsStarted:0,semanticReviewComplete:false,authoritativeClearance:false,executionAuthorized:false,savedToGit:false,gateSigned:false}));
      const work=Promise.resolve().then(async()=>{
        await current();
        const sourceAuthority:Records['authorizeDraft']=async c=>{if(c.action!=='read'||c.draftId!==input.draftId)throw unavailable();await readAuthority(c.action,()=>r.authorizeDraft(c));};
        const keyForDraft:Records['keyForDraft']=(ref,keyId)=>{if(ref.draftId!==input.draftId)throw unavailable();return checked(()=>r.keyForDraft(ref,keyId));};
        const drafts=own(createDraftRevisionStore(scopedPools.drafts,config,{authorize:sourceAuthority,keyForDraft:(ref,keyId)=>{if(keyId===null)throw unavailable();return keyForDraft(ref,keyId);}}));
        const read=async(borrowed?:()=>ReturnType<typeof drafts.read>)=>{
          const found=await (borrowed?borrowed():drafts.read({draftId:input.draftId,revision:input.revision}));guard();
          if(found.latestRevision!==input.revision||found.reference.revisionDigest!==input.revisionDigest||found.reference.scopeInputDigest!==input.scopeInputDigest)throw new Conflict();
          return found;
        };
        const source=await read();
        const evidence=intentEvidenceInputSchema.parse(await checked(()=>deps.evidenceFor(input,current))),plan=await planIntentScopeBatches(evidence);guard();
        if((['organizationId','productId','repository','branch'] as const).some(k=>evidence[k]!==config[k])
          ||evidence.scopeInputDigest!==input.scopeInputDigest||plan.summary.sourceSnapshotDigest!==input.sourceSnapshotDigest)throw new Conflict();
        const {gaps,...counts}=plan.summary.coverage;coverage={...counts,gapCount:gaps.length,batchCount:plan.batches.length};
        const evidenceFor=()=>deps.evidenceFor(input,current);
        const recheckSources=async(readEvidence:()=>Promise<unknown>=evidenceFor,readDraft:()=>ReturnType<typeof drafts.read>=read)=>{
          await current();if(hash(await readDraft())!==hash(source))throw new Conflict();
          const fresh=intentEvidenceInputSchema.parse(await checked(readEvidence));
          if(hash(fresh)!==hash(evidence))throw new Conflict();await current();
        };
        if(!plan.batches.length){await recheckSources();return output(coverage.plannedComplete?'no-sources':'scope-incomplete');}
        const content=source.content,described=await describeScopeOriginal({kind:'steer-scope-original/v1',configuration:execution,
          source:{revision:input.revision,revisionDigest:input.revisionDigest,scope:{organizationId:config.organizationId,productId:config.productId,repository:config.repository,
            draftId:input.draftId,sourceRevision:source.reference.sourceRevision,originalText:content.originalText,clarificationTurns:content.clarificationTurns,
            documents:content.documents?{brief:content.documents.brief,spec:content.documents.spec}:null}},evidence,profile});guard();
        const {original,manifest}=described;
        const recheck=async()=>{
          let conflict=false;
          try{
            // This exact store's policies check the current caller after every
            // grant, and keys retain both caller edges. The outer owner checks
            // entry/return. Final draft verification follows corpus closure;
            // admission and preservation remain OUTSIDE each fresh phase.
            await current();
            await withDraftReadSession<Awaited<ReturnType<typeof drafts.read>>>({scope:config,read:drafts.read},
              {draftId:input.draftId,revision:input.revision},async()=>{guard();},async borrowed=>{
                try{await withPreparationEvidence(
                  evidenceWindow?work=>Reflect.apply(evidenceWindow,deps,[input,current,work]):undefined,evidenceFor,
                  async readEvidence=>{await recheckSources(readEvidence,()=>read(borrowed));await authority(()=>deps.authorizePreparation(original));
                    await recheckSources(readEvidence,()=>read(borrowed));},track,guard);
                }catch(error){conflict=error instanceof Conflict;throw error;}
              });
            await current();
          }catch(error){if(conflict)throw new Conflict();throw error;}
        };
        const secured:Records={
          authorize:async c=>{if(!reference||hash(c.target)!==hash(reference))throw unavailable();await recordsAuthority(c.action,()=>r.authorize(c));},
          authorizeOriginal:async c=>{if(hash(c.original)!==hash(original))throw unavailable();await recordsAuthority(c.action,()=>r.authorizeOriginal(c));},
          authorizeReview:async c=>{if(hash(c.request)!==hash(manifest)&&(!reference||hash(c.request)!==hash(reference)))throw unavailable();await authority(()=>r.authorizeReview(c));},
          authorizeDraft:sourceAuthority,keyForDraft,
        };
        const operations=own(createScopeReviewOperationStore(scopedPools.execution,execution,{authorize:secured.authorizeReview}));
        await recheck();effectPossible=true;const admitted=await operations.admit(manifest);guard();
        if(admitted.outcome!=='ok')return output(admitted.outcome);
        reference=freeze({reviewId:admitted.value.reviewId,preparationDigest:manifest.preparationDigest});
        await recheck();const originals=own(createScopeReviewOriginalStore(scopedPools,config,secured));
        const preserved=await originals.putAndRead({...reference,original});guard();if(preserved.outcome!=='stored')return output(preserved.outcome);
        const recovered=preserved.recovered;
        if(hash(recovered.original)!==hash(original)||hash(recovered.manifest)!==hash(manifest)||recovered.latestDraftRevision!==input.revision||recovered.reviewExpired)throw unavailable();
        await recheck();if(Date.parse(execution.expiresAt)<=Date.now())throw unavailable();return output('prepared');
      });
      void work.finally(()=>{settled=true;release();}).catch(()=>{});
      try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(unavailable()),30000);})]);}
      catch(error){return output(effectPossible?'unknown':error instanceof Conflict?'conflict':'unavailable');}
      finally{finished=true;if(timer)clearTimeout(timer);for(const child of owned){child.close();children.delete(child);}}
    },
    close(){closed=true;children.forEach(child=>child.close());},
  } satisfies IntentScopePreparer&{close():void};
}
