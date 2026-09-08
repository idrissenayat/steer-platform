import {parseCandidateSaveTarget} from './candidate-save-contracts.ts';

/** Reference-only Temporal values. Findings, documents and authority stay outside history. */
export interface ScopeTarget {organizationId:string;reviewId:string;preparationDigest:string}
export interface ScopeStepTarget extends ScopeTarget {batchId:string}
interface NoAuthority {semanticQualityVerified:false;authoritativeClearance:false;executionAuthorized:false;retryAuthorized:false;gateSigned:false}
export interface ScopePlanResult extends NoAuthority {
  kind:'steer-scope-plan/v1';reviewId:string;preparationDigest:string;
  outcome:'ready'|'superseded'|'expired'|'attention-required'|'busy';batchIds:readonly string[];
}
export interface ScopeStepResult extends NoAuthority {
  kind:'steer-scope-step-outcome/v1';reviewId:string;preparationDigest:string;batchId:string;
  outcome:'succeeded'|'superseded'|'attention-required'|'busy';resultDigest:string|null;
}
export interface ScopeWorkflowActivities {
  readScopePlan(target:ScopeTarget):Promise<ScopePlanResult>;
  reviewScopeBatch(target:ScopeStepTarget):Promise<ScopeStepResult>;
}
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)
  &&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const digest=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}(?![\s\S])/.test(v);
const flags=['semanticQualityVerified','authoritativeClearance','executionAuthorized','retryAuthorized','gateSigned'];
const denied=()=>new Error('Invalid scope workflow reference.');
export function parseScopeTarget(raw:unknown):ScopeTarget {
  if(!exact(raw,['organizationId','reviewId','preparationDigest']))throw denied();
  try{const t=parseCandidateSaveTarget({organizationId:raw.organizationId,operationId:raw.reviewId,inputDigest:raw.preparationDigest});
    return Object.freeze({organizationId:t.organizationId,reviewId:t.operationId,preparationDigest:t.inputDigest});
  }catch{throw denied();}
}
export function scopeWorkflowId(raw:unknown){const t=parseScopeTarget(raw);
  // Preparation drift cannot create another workflow identity for the same review.
  return `steer-scope/v1/${encodeURIComponent(t.organizationId)}/${t.reviewId}`;
}
export function parseScopeStepTarget(raw:unknown):ScopeStepTarget {
  if(!exact(raw,['organizationId','reviewId','preparationDigest','batchId'])||!digest(raw.batchId))throw denied();
  return Object.freeze({...parseScopeTarget({organizationId:raw.organizationId,reviewId:raw.reviewId,preparationDigest:raw.preparationDigest}),batchId:raw.batchId});
}
export function parseScopePlanResult(raw:unknown,target:ScopeTarget):ScopePlanResult {
  if(!exact(raw,['kind','reviewId','preparationDigest','outcome','batchIds',...flags])||raw.kind!=='steer-scope-plan/v1'
    ||raw.reviewId!==target.reviewId||raw.preparationDigest!==target.preparationDigest||flags.some(k=>raw[k]!==false)
    ||!['ready','superseded','expired','attention-required','busy'].includes(raw.outcome as string)
    ||!Array.isArray(raw.batchIds)||raw.batchIds.length>8||![...raw.batchIds].every(digest)||new Set(raw.batchIds).size!==raw.batchIds.length
    ||(raw.outcome==='ready'?raw.batchIds.length===0:raw.batchIds.length!==0))throw denied();
  return Object.freeze({kind:'steer-scope-plan/v1',reviewId:target.reviewId,preparationDigest:target.preparationDigest,
    outcome:raw.outcome as ScopePlanResult['outcome'],batchIds:Object.freeze([...raw.batchIds]),
    semanticQualityVerified:false,authoritativeClearance:false,executionAuthorized:false,retryAuthorized:false,gateSigned:false});
}
export function parseScopeStepResult(raw:unknown,target:ScopeStepTarget):ScopeStepResult {
  if(!exact(raw,['kind','reviewId','preparationDigest','batchId','outcome','resultDigest',...flags])||raw.kind!=='steer-scope-step-outcome/v1'
    ||raw.reviewId!==target.reviewId||raw.preparationDigest!==target.preparationDigest||raw.batchId!==target.batchId||flags.some(k=>raw[k]!==false)
    ||!['succeeded','superseded','attention-required','busy'].includes(raw.outcome as string)
    ||(raw.outcome==='succeeded'?!digest(raw.resultDigest):raw.outcome==='superseded'?raw.resultDigest!==null&&!digest(raw.resultDigest):raw.resultDigest!==null))throw denied();
  return Object.freeze({kind:'steer-scope-step-outcome/v1',reviewId:target.reviewId,preparationDigest:target.preparationDigest,batchId:target.batchId,
    outcome:raw.outcome as ScopeStepResult['outcome'],resultDigest:raw.resultDigest as string|null,
    semanticQualityVerified:false,authoritativeClearance:false,executionAuthorized:false,retryAuthorized:false,gateSigned:false});
}
