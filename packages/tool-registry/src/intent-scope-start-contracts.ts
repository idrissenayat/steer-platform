import {z} from 'zod';
import {intentScopeReadInputSchema} from './intent-scope-read-contracts.ts';

const uuid=z.uuid().length(36).refine(v=>v===v.toLowerCase()),digest=z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
export const intentScopeStartInputSchema=intentScopeReadInputSchema.extend({draftId:uuid,revision:z.number().int().min(1).max(1000),revisionDigest:digest});
export const scopeScheduleReceiptSchema=z.discriminatedUnion('outcome',[
  z.strictObject({outcome:z.literal('acknowledged'),workflowId:z.string().min(1).max(1000),runId:uuid,
    state:z.enum(['RUNNING','COMPLETED','FAILED','CANCELLED','TERMINATED','TIMED_OUT'])}),
  z.strictObject({outcome:z.enum(['unknown','unavailable'])}),
]);
export const intentScopeStartOutputSchema=intentScopeStartInputSchema.extend({kind:z.literal('steer-scope-start/v1'),receipt:scopeScheduleReceiptSchema,
  semanticReviewComplete:z.literal(false),authoritativeClearance:z.literal(false),executionAuthorized:z.literal(false),
  savedToGit:z.literal(false),gateSigned:z.literal(false),retryAuthorized:z.literal(false),
}).superRefine((v,ctx)=>{
  if(v.receipt.outcome==='acknowledged'&&v.receipt.workflowId!==`steer-scope/v1/${encodeURIComponent(v.organizationId)}/${v.reviewId}`)
    ctx.addIssue({code:'custom',message:'Invalid scope workflow binding.'});
});
export type IntentScopeStartInput=z.infer<typeof intentScopeStartInputSchema>;
export type IntentScopeStartOutput=z.infer<typeof intentScopeStartOutputSchema>;
export interface ScopeScheduler {
  /** Trusted reference only, with current authorization before every scheduling
   * boundary. A recovered start does not authorize a repeated model dispatch. */
  start(input:Readonly<{organizationId:string;reviewId:string;preparationDigest:string;expiresAt:string}>,revalidate:()=>Promise<void>):Promise<unknown>;
}
export interface IntentScopeStarter {
  readonly scope:Readonly<{organizationId:string;subject:string;productId:string;repository:string}>;
  start(input:IntentScopeStartInput,revalidate:()=>Promise<void>):Promise<unknown>;
}
