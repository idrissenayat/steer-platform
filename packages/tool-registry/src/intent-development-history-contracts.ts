import { z } from 'zod';
import { intentDevelopmentReadInputSchema, intentDevelopmentReadOutputSchema } from './intent-development-read-contracts.ts';

const digest=z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
export const intentDevelopmentHistoryInputSchema=intentDevelopmentReadInputSchema;
const retainedResult=intentDevelopmentReadOutputSchema.shape.results.element.extend({
  stepInputDigest:digest,predecessorResultDigest:digest.nullable(),outputDigest:digest,
});
/** Historical documents are not current candidates, saving consent or execution
 * checkpoints. Only parsed role output and inert lineage references leave the
 * server, never raw prompts, source packets, profiles or provider transcripts. */
export const intentDevelopmentHistoryOutputSchema=intentDevelopmentReadInputSchema.extend({
  kind:z.literal('steer-development-history/v1'),historical:z.literal(true),operationExpired:z.boolean(),
  source:intentDevelopmentReadOutputSchema.shape.source,
  status:z.enum(['pending','partial','complete','needs-clarification','attention-required']),
  steps:intentDevelopmentReadOutputSchema.shape.steps.unwrap(),results:z.array(retainedResult).max(2),
  savedToGit:z.literal(false),gateSigned:z.literal(false),executionAuthorized:z.literal(false),retryAuthorized:z.literal(false),
  semanticQualityVerified:z.literal(false),
}).superRefine((v,ctx)=>{
  const fail=()=>ctx.addIssue({code:'custom',message:'Inconsistent historical development.'});
  if(v.source.latestRevision<v.source.revision)fail();
  const roles=v.results.map(r=>r.result.role),architect=v.results.find(r=>r.result.role==='architect');
  if(new Set(roles).size!==roles.length||(roles.includes('test-agent')&&roles[0]!=='architect'))fail();
  for(const step of v.steps)if((step.state==='succeeded')!==roles.includes(step.role))fail();
  if(v.steps[1].state!=='pending'&&v.steps[0].state!=='succeeded')fail();
  const questions=architect?.result.role==='architect'&&architect.result.output.questions.length>0;
  if(questions&&v.steps[1].state!=='pending')fail();
  for(const r of v.results)if(r.predecessorResultDigest!==(r.result.role==='architect'?null:architect?.resultDigest))fail();
  const expected=v.steps.some(s=>['outcome-unknown','failed-known'].includes(s.state))?'attention-required'
    :questions?'needs-clarification':roles.length===2?'complete':roles.length===1?'partial':'pending';
  if(v.status!==expected)fail();
});
export type IntentDevelopmentHistoryInput=z.infer<typeof intentDevelopmentHistoryInputSchema>;
export type IntentDevelopmentHistoryOutput=z.infer<typeof intentDevelopmentHistoryOutputSchema>;
export async function verifyIntentDevelopmentHistoryOutput(raw:unknown){
  const value=intentDevelopmentHistoryOutputSchema.parse(raw);
  for(const r of value.results){
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(r.result)));
    if([...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('')!==r.outputDigest)
      throw new Error('Invalid historical output digest.');
  }
  return value;
}
export interface IntentDevelopmentHistoryReader {
  readonly scope:Readonly<Pick<IntentDevelopmentHistoryInput,'organizationId'|'productId'|'repository'>&{subject:string}>;
  read(input:IntentDevelopmentHistoryInput,revalidate:()=>Promise<void>):Promise<unknown>;
}
