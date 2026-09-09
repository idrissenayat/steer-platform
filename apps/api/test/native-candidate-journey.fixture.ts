import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createGitHubReader } from '@steer/adapters/github';
import { createIntentCorpusEvidence } from '@steer/adapters/intent-corpus-evidence';
import { createVerifiedCandidateSaveDestination } from '../src/runtime.ts';
import { planCandidateBundle } from '@steer/tool-registry/candidate-bundle-contracts';
import { intentEvidenceInputSchema } from '@steer/tool-registry/intent-evidence-contracts';
import { candidateInput } from '../../../packages/tool-registry/test/candidate-read-fixture.ts';
import { fixture, binding, now } from '../../../packages/adapters/test/github-brief-fixture.ts';

const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
/** Native Git, actual corpus/catalog/byte readers, synthetic governed policy.
 * Preparation happens before encrypted SQL original admission. No real network,
 * credential, user repository, live lifecycle authority or write grant exists. */
export function nativeCandidateJourneyFixture(t:{after(run:()=>void):void}, save=false) {
  const git=fixture(t,save?'candidate-bundle':'brief'), proposalId=randomUUID();
  const state={allowed:true,sourceAllowed:true,continuationAllowed:true,proofs:0,moveAtProof:0,policyRevision:'synthetic-policy-r1'};
  let originalTarget='', priorManifest='', proposalManifest='', pointerDigest='';
  const reader=(organizationId:string)=>createGitHubReader({...binding,organizationId},
    {appJwt:async()=>'synthetic-app-jwt',fetch:git.transport,now:()=>now});
  const check=async()=>{if(!state.allowed)throw new Error('PRIVATE synthetic destination policy denied');};
  const sourceCheck=async()=>{await check();if(!state.sourceAllowed)throw new Error('PRIVATE synthetic source denied');};
  const policy=()=>{
    state.proofs++;
    if(state.moveAtProof===state.proofs)git.add([{path:'synthetic-head-move.md',content:'Competing synthetic change'}]);
    return {permissionsRevision:state.policyRevision,evidenceDigest:hash(state.policyRevision),
      evaluatedAt:new Date().toISOString(),validThrough:new Date(Date.now()+60000).toISOString()};
  };
  const corpusAuthority:Parameters<typeof createIntentCorpusEvidence>[2]={
    authorize:async()=>({permissionsRevision:'synthetic-corpus-grants-r1'}),authorizeSource:async()=>{},
    select:async context=>({...context,selection:context.root==='items/0002-existing'?'pre-pull-candidate':'canonical',authorityDigest:'e'.repeat(64)}),
  };
  async function repositoryEvidence(raw:ReturnType<typeof intentEvidenceInputSchema.parse>) {
    assert.equal(originalTarget,'','A fixture may seed immutable history only once');
    const input=intentEvidenceInputSchema.parse(raw);
    const files=input.inventory.map(ref=>({path:ref.path.replace(/^intent\/(\d{4})\//,'items/$1-existing/'),
      content:input.documents.find(doc=>doc.sourceId===ref.sourceId)!.content}));
    git.add(files);
    const documents={brief:files.find(f=>f.path==='items/0002-existing/BRIEF.md')!.content,
      spec:files.find(f=>f.path==='items/0002-existing/SPEC.md')!.content,exam:'# Synthetic prior candidate Exam\nNOT RUN'};
    const prior=await planCandidateBundle({...candidateInput,organizationId:input.organizationId,productId:input.productId,
      branch:binding.branch,itemId:'0002-existing',expectedHead:git.head(),documents});
    git.add(prior.files.map(({path,content})=>({path,content})));priorManifest=prior.manifestDigest;
    originalTarget=git.head();
    const proposal=await planCandidateBundle({...candidateInput,organizationId:input.organizationId,productId:input.productId,
      branch:binding.branch,itemId:'0001-existing',expectedHead:originalTarget,purpose:'amendment',bundleId:randomUUID(),operationId:randomUUID(),
      amendment:{proposalId,target:{itemId:'0001-existing',revision:originalTarget},parentProposalDigest:null}});
    git.add(proposal.files.map(({path,content})=>({path,content})));proposalManifest=proposal.manifestDigest;
    pointerDigest=hash(proposal.files.find(f=>f.path===`items/0001-existing/proposals/${proposalId}.json`)!.content);
    const scope={organizationId:input.organizationId,productId:input.productId,repository:input.repository,branch:binding.branch};
    const collector=createIntentCorpusEvidence(reader(input.organizationId),{...scope,retrievalConfigurationRevision:'synthetic-native-corpus-r1'},corpusAuthority);
    try {
      const collected=await collector.collect({...scope,scopeInputDigest:input.scopeInputDigest},async()=>{});
      assert.equal(collected.evidence.inventoryComplete,true);assert.equal(collected.coverage.unresolvedCount,0);
      assert.equal(collected.coverage.sourceGapCount,0);assert.equal(collected.evidence.documents.length,input.documents.length+2);
      assert.equal(collected.evidence.inventory.filter(s=>s.status==='amendment').length,2);
      assert.equal(collected.evidence.inventory.filter(s=>s.status==='candidate').length,2);
      assert.equal(collected.evidence.head,git.head());return collected.evidence;
    } finally {collector.close();}
  }
  function destination(config:{organizationId:string;subject:string;productId:string;repository:string;branch:string;configurationRevision:string}) {
    const {organizationId,subject,productId,repository,branch,configurationRevision}=config;
    return createVerifiedCandidateSaveDestination(reader(organizationId),{organizationId,subject,productId,repository,branch,configurationRevision,
      itemIds:['0260-booking','0001-existing','0002-existing','0003-existing']}, {
      newItem:{authorize:check,authorizeSource:sourceCheck,verify:async context=>({...context,...policy(),kind:'steer-new-candidate-destination-authority/v1',lifecycle:'absent-item'})},
      existingItem:{authorize:check,authorizeSource:sourceCheck,verify:async context=>({...context,...policy(),
        kind:'steer-existing-candidate-destination-authority/v1',lifecycle:context.itemId==='0002-existing'?'candidate-not-pulled':'existing-target-proposal-only',relationship:null,
        ...(context.proposalContinuity&&state.continuationAllowed?{proposalContinuation:'eligible-unchanged-target'}:{})})},
    });
  }
  return {git,state,repositoryEvidence,destination,reader,corpusAuthority,branch:binding.branch,proposalId,
    parents:()=>({originalTarget,priorManifest,proposalManifest,pointerDigest})};
}
