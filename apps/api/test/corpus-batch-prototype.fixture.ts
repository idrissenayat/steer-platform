import assert from 'node:assert/strict';
import { nativeCandidateJourneyFixture } from './native-candidate-journey.fixture.ts';
import { scopeReviewFixture } from '../../../packages/tool-registry/test/intent-scope-review.fixture.ts';
import { createGitHubReader } from '@steer/adapters/github';
import { binding, now } from '../../../packages/adapters/test/github-brief-fixture.ts';
import { corpusBatchQuery, collectCorpusBatchPrototype } from './corpus-batch-prototype.ts';

/** GitHub-shaped synthetic wire replies backed by real disposable Git objects.
 * Local object reads inside this provider emulator are not HTTP attempts. */
export async function corpusBatchPrototypeFixture(t:{after(run:()=>void):void}){
  const fixtureBinding={...binding};
  const native=nativeCandidateJourneyFixture(t,true), source=await scopeReviewFixture(32);
  const evidence=await native.repositoryEvidence({...source.evidence,branch:native.branch});
  const priorPhysicalReads=native.git.calls.filter(c=>c.path.includes('/git/blobs/')).length;
  native.git.override((url,_init,raw)=>{
    if(!url.pathname.includes('/git/trees/'))return raw;
    const tree=raw as {tree:Array<{type:string;sha:string}>};
    return {...tree,tree:tree.tree.map(e=>({...e,...(e.type==='blob'?{size:Number(native.git.git(['cat-file','-s',e.sha]))}:{})}))};
  });
  const wire:Array<{kind:string;origin:'identity'|'repository'}>=[],queries:number[]=[];
  let override=(value:unknown):unknown=>value, afterQuery=()=>{};
  const repository:typeof fetch=async(input,init)=>{
    const url=new URL(String(input));assert.equal(url.origin,'https://api.github.com');
    if(url.pathname!=='/graphql'){
      wire.push({kind:url.pathname.includes('/access_tokens')?'token':url.pathname.includes('/git/ref/')?'head':url.pathname.includes('/git/commits/')?'commit':'tree',origin:'repository'});
      return native.git.transport(input,init);
    }
    wire.push({kind:'graphql-read',origin:'repository'});
    assert.equal(init?.method,'POST');assert.equal(new Headers(init?.headers).get('authorization'),'Bearer synthetic-read');
    assert.equal(init?.redirect,'error');assert.equal(init?.cache,'no-store');assert.ok(init?.signal);
    const {query,variables}=JSON.parse(String(init.body));
    const count=Object.keys(variables).length-2;assert.equal(query,corpusBatchQuery(count));
    assert.equal(variables.owner,binding.owner);assert.equal(variables.name,binding.repository);
    assert.deepEqual(Object.keys(variables).sort(),['owner','name',...Array.from({length:count},(_,i)=>`o${i}`)].sort());
    const blobs=Object.fromEntries(Array.from({length:count},(_,i)=>{
      const oid=variables[`o${i}`];assert.match(oid,/^[a-f0-9]{40}$/);const bytes=native.git.readBlob(oid);
      return [`b${i}`,{__typename:'Blob',oid,byteSize:bytes.length,isBinary:false,isTruncated:false,text:bytes.toString('utf8')}];
    }));
    queries.push(count);const value=override({data:{repository:{databaseId:binding.repositoryId,nameWithOwner:`${binding.owner}/${binding.repository}`,...blobs}}});
    afterQuery();return value instanceof Response?value:Response.json(value);
  };
  const identity=createGitHubReader(fixtureBinding,{appJwt:async()=>'synthetic-app-jwt',now:()=>now,fetch:async(input,init)=>{
    const url=new URL(String(input));wire.push({kind:url.pathname.includes('/access_tokens')?'token':'head',origin:'identity'});
    return native.git.transport(input,init);
  }});
  const state={caller:true,source:true,revision:'synthetic-grants-r1'};
  const grants:string[]=[],authority={...native.corpusAuthority,authorize:async()=>({permissionsRevision:state.revision}),
    authorizeSource:async(ref:{path:string})=>{grants.push(ref.path);if(!state.source)throw new Error('Synthetic source denied');}};
  const run=(signal?:AbortSignal)=>collectCorpusBatchPrototype(fixtureBinding,evidence.productId,repository,authority,async()=>{
    if(!state.caller)throw new Error('Synthetic caller denied');await identity.readHead();
  },signal);
  return {native,evidence,state,grants,queries,wire,run,authority,repository,binding:fixtureBinding,priorPhysicalReads,
    override:(f:typeof override)=>{override=f;},afterQuery:(f:typeof afterQuery)=>{afterQuery=f;}};
}
