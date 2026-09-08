import { z } from 'zod';
import { intentDraftScopeSchema } from './intent-draft-contracts.ts';

const digest=z.string().regex(/^[a-f0-9]{64}(?![\s\S])/),uuid=z.uuid().length(36).refine(v=>v===v.toLowerCase());
export const intentScopePrepareInputSchema=intentDraftScopeSchema.extend({draftId:uuid,revision:z.number().int().min(1).max(1000),
  revisionDigest:digest,scopeInputDigest:digest,sourceSnapshotDigest:digest,configurationRevision:z.string().min(1).max(200)});
const coverage=z.strictObject({inventoryComplete:z.boolean(),accessGapCount:z.number().int().min(0).max(1000000),
  inventoryCount:z.number().int().min(0).max(1000),plannedCount:z.number().int().min(0).max(256),
  gapCount:z.number().int().min(0).max(1000),batchCount:z.number().int().min(0).max(8),plannedComplete:z.boolean()}).superRefine((c,ctx)=>{
  if(c.plannedCount+c.gapCount!==c.inventoryCount||c.plannedComplete!==(c.inventoryComplete&&c.accessGapCount===0&&c.gapCount===0)
    ||(c.batchCount===0)!==(c.plannedCount===0)||c.batchCount>c.plannedCount||c.plannedCount>c.batchCount*32)
    ctx.addIssue({code:'custom',message:'Invalid scope preparation coverage.'});
});
/** Metadata only. Preparation preserves exact input; it neither starts a review
 * nor establishes completeness, uniqueness, disposition, budget or gate authority. */
export const intentScopePrepareOutputSchema=intentScopePrepareInputSchema.extend({kind:z.literal('steer-scope-prepare/v1'),
  outcome:z.enum(['prepared','no-sources','scope-incomplete','conflict','unknown','unavailable']),
  reference:z.strictObject({reviewId:uuid,preparationDigest:digest}).nullable(),coverage:coverage.nullable(),
  originalPreserved:z.boolean(),readyToRequestStart:z.boolean(),modelCallsStarted:z.literal(0),
  semanticReviewComplete:z.literal(false),authoritativeClearance:z.literal(false),executionAuthorized:z.literal(false),
  savedToGit:z.literal(false),gateSigned:z.literal(false),
}).superRefine((v,ctx)=>{
  const fail=()=>ctx.addIssue({code:'custom',message:'Invalid scope preparation receipt.'});
  if(v.originalPreserved!==(v.outcome==='prepared')||v.readyToRequestStart!==(v.outcome==='prepared'))fail();
  if(v.outcome==='prepared'&&(!v.reference||!v.coverage||v.coverage.batchCount===0))fail();
  if(v.reference&&!['prepared','unknown'].includes(v.outcome))fail();
  if(v.outcome==='no-sources'&&(!v.coverage||v.coverage.inventoryCount!==0||!v.coverage.plannedComplete))fail();
  if(v.outcome==='scope-incomplete'&&(!v.coverage||v.coverage.batchCount!==0||v.coverage.plannedComplete))fail();
});
export type IntentScopePrepareInput=z.infer<typeof intentScopePrepareInputSchema>;
export type IntentScopePrepareOutput=z.infer<typeof intentScopePrepareOutputSchema>;
export interface IntentScopePreparer {
  readonly scope:Readonly<{organizationId:string;subject:string;productId:string;repository:string;configurationRevision:string}>;
  prepare(input:IntentScopePrepareInput,revalidate:()=>Promise<void>):Promise<unknown>;
}
