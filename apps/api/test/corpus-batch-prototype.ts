import { createHash } from 'node:crypto';
import { z } from 'zod';
import { candidateBundlePointerSchema, candidateBundleManifestSchema, candidatePointerReferenceSchema } from '@steer/tool-registry/candidate-bundle-contracts';
import { verifyScopeInventory } from '../../../packages/adapters/src/code-host/scope-inventory.ts';
import type { IntentCorpusAuthority } from '../../../packages/adapters/src/code-host/intent-corpus-evidence.ts';
import type { GitHubBinding } from '../../../packages/adapters/src/code-host/github.ts';

// TEST-ONLY protocol experiment. Explicit injected transport; no default network,
// credentials, startup installation, permission lease or production capability.
const oid = z.string().regex(/^[a-f0-9]{40}$/), maxBody = 131072, maxResponse = 2097152;
const fail = () => new Error('Synthetic corpus batch could not be verified.');
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
type File = { path: string; content: string; contentDigest: string; blobSha: string };
export function corpusBatchQuery(count: number) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 16) throw fail();
  const vars = Array.from({length:count}, (_,i) => `$o${i}: GitObjectID!`).join(', ');
  const fields = Array.from({length:count}, (_,i) => `b${i}: object(oid: $o${i}) { __typename ... on Blob { oid byteSize isBinary isTruncated text } }`).join(' ');
  return `query SteerImmutableCorpusBatch($owner: String!, $name: String!, ${vars}) { repository(owner: $owner, name: $name) { databaseId nameWithOwner ${fields} } }`;
}
export function partitionCorpusBatch<T extends {size:number}>(files: readonly T[]): T[][] {
  const groups:T[][]=[]; let bytes=4096;
  for(const file of files){
    if(!Number.isSafeInteger(file.size)||file.size<1||file.size>maxBody)throw fail();
    // Worst-case JSON string escaping, not an assumption that text is ASCII.
    const estimate=6*file.size+2048;
    if(!groups.length||groups.at(-1)!.length===16||bytes+estimate>maxResponse){groups.push([]);bytes=4096;}
    groups.at(-1)!.push(file);bytes+=estimate;
  }
  return groups;
}
async function json(response:Response){
  if(!response.ok||response.status>=300||!response.body)throw fail();
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;
  try{for(;;){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;
    if(bytes>maxResponse){await reader.cancel();throw fail();}chunks.push(next.value);}
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
  }finally{reader.releaseLock();}
}
export async function collectCorpusBatchPrototype(rawBinding:GitHubBinding, productId:string, transport:typeof fetch,
  authority:IntentCorpusAuthority, revalidate:()=>Promise<void>, signal:AbortSignal=new AbortController().signal,
  historicalRevision?:string){
  const binding=Object.freeze({...rawBinding}), bindingSnapshot=JSON.stringify(binding);
  const requestedRevision=historicalRevision===undefined?undefined:oid.parse(historicalRevision);
  if(binding.owner!=='synthetic'||binding.repository!=='fixture'||binding.repositoryId!==52||typeof transport!=='function')throw fail();
  const scope=Object.freeze({organizationId:binding.organizationId,productId,repository:`github:${binding.repositoryId}`,branch:binding.branch});
  const ports={authorize:authority.authorize,select:authority.select,authorizeSource:authority.authorizeSource};
  const repo=`/repos/${binding.owner}/${binding.repository}`, captured=new Map<string,File>();
  const waves:Array<{name:string;batches:number;paths:string[];bytes:number}>=[];
  let token:string|undefined,permissions:string|undefined,requests=0,sourcePolicyQueries=0;
  const guard=()=>{signal.throwIfAborted();
    if(JSON.stringify(rawBinding)!==bindingSnapshot||Object.entries(ports).some(([name,port])=>authority[name as keyof typeof ports]!==port))throw fail();};
  const sourceGrant=async(path:string,revision:string)=>{guard();sourcePolicyQueries++;
    const result=await ports.authorizeSource.call(authority,Object.freeze({...scope,revision,path}));guard();
    if(result!==undefined)throw fail();};
  const current=async()=>{guard();const p=await authority.authorize(scope);guard();
    if(typeof p.permissionsRevision!=='string'||!p.permissionsRevision||p.permissionsRevision.length>256
      ||(permissions!==undefined&&permissions!==p.permissionsRevision))throw fail();permissions=p.permissionsRevision;
    if(await revalidate()!==undefined)throw fail();guard();};
  const send=async(path:string,credential:string,body?:unknown)=>{guard();if(++requests>40)throw fail();
    return json(await transport(`https://api.github.com${path}`,{method:body?'POST':'GET',redirect:'error',cache:'no-store',
      signal:AbortSignal.any([signal,AbortSignal.timeout(10000)]),headers:{authorization:`Bearer ${credential}`,
        accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10','content-type':'application/json'},
      ...(body?{body:JSON.stringify(body)}:{})}));};
  const request=async(path:string,body?:unknown)=>{
    if(!token){const t=await send(`/app/installations/${binding.installationId}/access_tokens`,'synthetic-app-jwt',
      {repository_ids:[binding.repositoryId],permissions:{contents:'read'}});
      if(t.token!=='synthetic-read'||t.permissions.contents!=='read'||Object.entries(t.permissions).some(([k,v])=>!['contents','metadata'].includes(k)||v!=='read')
        ||t.repositories.length!==1||t.repositories[0].id!==binding.repositoryId||t.repositories[0].full_name!==`${binding.owner}/${binding.repository}`)throw fail();
      token=t.token;}
    return send(path,token!,body);};
  const io=async<T>(work:()=>Promise<T>)=>{await current();const result=await work();await current();return result;};
  const head=()=>request(`${repo}/git/ref/heads/${binding.branch}`).then(raw=>{
    if(raw.ref!==`refs/heads/${binding.branch}`||raw.object.type!=='commit')throw fail();return oid.parse(raw.object.sha);});
  const observedHead=await io(head),revision=requestedRevision??observedHead;
  const {tree,sizes}=await io(async()=>{
    const commit=await request(`${repo}/git/commits/${revision}`);if(commit.sha!==revision)throw fail();
    const treeOid=oid.parse(commit.tree.sha),raw=await request(`${repo}/git/trees/${treeOid}?recursive=1`);
    if(raw.sha!==treeOid||raw.truncated!==false||!Array.isArray(raw.tree)||raw.tree.length>10000)throw fail();
    const sizes=new Map<string,number>();
    const entries=raw.tree.filter((e:{path:string})=>/^(intent|items)(\/|$)/.test(e.path)).map((e:{path:string;sha:string;type:string;mode:string;size?:number})=>{
      if(e.size!==undefined){if(!Number.isSafeInteger(e.size)||e.size<0)throw fail();sizes.set(e.path,e.size);}
      return {path:e.path,objectSha:e.sha,mode:e.mode,type:e.type};});
    const tree=verifyScopeInventory({organizationId:scope.organizationId,repositoryId:binding.repositoryId,revision,treeSha:treeOid,entries});
    if(tree.unsupportedRootCount)throw fail();return {tree,sizes};
  });
  const byPath=new Map(tree.entries.map(e=>[e.path,e]));
  const selections:Array<{context:Parameters<IntentCorpusAuthority['select']>[0];value:unknown;root:string;candidate:boolean}>=[];
  for(const root of tree.roots){
    guard();const context=Object.freeze({...scope,revision,root:root.path,treeSha:root.objectSha}),raw=await authority.select(context);guard();
    const selected=z.object({organizationId:z.literal(scope.organizationId),productId:z.literal(productId),repository:z.literal(scope.repository),
      branch:z.literal(scope.branch),revision:z.literal(revision),root:z.literal(root.path),treeSha:z.literal(root.objectSha),
      selection:z.enum(['canonical','pre-pull-candidate','out-of-product']),authorityDigest:z.string().regex(/^[a-f0-9]{64}$/)}).parse(raw);
    selections.push({context,value:selected,root:root.path,candidate:selected.selection==='pre-pull-candidate'});
  }
  const selected=selections.filter(s=>(s.value as {selection:string}).selection!=='out-of-product');
  const readWave=async(name:string,rawPaths:string[])=>{
    const paths=[...new Set(rawPaths)].filter(p=>!captured.has(p));
    if(captured.size+paths.length>100)throw fail();
    const files=paths.map(path=>{const entry=byPath.get(path);if(!entry||entry.type!=='blob'||entry.mode!=='100644')throw fail();
      return {path,oid:entry.objectSha,size:sizes.get(path)??maxBody,hasSize:sizes.has(path)};});
    const batches=partitionCorpusBatch(files);let bytes=0;
    for(const batch of batches){
      for(const file of batch)await sourceGrant(file.path,revision);
      await current();const raw=await request('/graphql',{query:corpusBatchQuery(batch.length),variables:{owner:binding.owner,name:binding.repository,
        ...Object.fromEntries(batch.map((f,i)=>[`o${i}`,f.oid]))}});guard();
      if(!raw||Object.keys(raw).length!==1||!raw.data||Object.keys(raw.data).join()!=='repository')throw fail();
      const repository=raw.data.repository;
      if(!repository||repository.databaseId!==binding.repositoryId||repository.nameWithOwner!==`${binding.owner}/${binding.repository}`
        ||Object.keys(repository).sort().join()!==['databaseId','nameWithOwner',...batch.map((_,i)=>`b${i}`)].sort().join())throw fail();
      const staged=batch.map((f,i)=>{const value=z.strictObject({__typename:z.literal('Blob'),oid,byteSize:z.number().int().min(1).max(maxBody),
        isBinary:z.literal(false),isTruncated:z.literal(false),text:z.string().min(1).max(maxBody).refine(v=>!/[\uD800-\uDFFF]/u.test(v))}).parse(repository[`b${i}`]);
        const length=Buffer.byteLength(value.text),blob=createHash('sha1').update(`blob ${length}\0`).update(value.text).digest('hex');
        if(value.oid!==f.oid||blob!==f.oid||length!==value.byteSize||(f.hasSize&&length!==f.size)||!value.text.trim())throw fail();
        bytes+=length;return {path:f.path,content:value.text,contentDigest:hash(value.text),blobSha:blob};});
      for(const file of batch)await sourceGrant(file.path,revision);
      await current();for(const file of staged)captured.set(file.path,file);
    }
    waves.push({name,batches:batches.length,paths,bytes});
  };
  const pointerPaths:string[]=[],rootPaths:string[]=[];
  for(const s of selected){
    if(!s.candidate&&byPath.has(`${s.root}/CANDIDATE.json`))throw fail();
    for(const name of ['BRIEF','SPEC'])if(byPath.has(`${s.root}/${name}.md`))rootPaths.push(`${s.root}/${name}.md`);
      else if(name==='BRIEF'||!s.candidate)throw fail();
    if(byPath.has(`${s.root}/CANDIDATE.json`))pointerPaths.push(`${s.root}/CANDIDATE.json`);
    for(const e of tree.entries)if(e.path.startsWith(`${s.root}/proposals/`)&&e.type!=='tree'){
      const ref=candidatePointerReferenceSchema.parse({...scope,revision,itemId:s.root.slice(6),proposalId:e.path.slice(`${s.root}/proposals/`.length).replace(/\.json$/,'')});
      if(e.path!==`${s.root}/proposals/${ref.proposalId}.json`)throw fail();pointerPaths.push(e.path);}
    if(s.candidate&&!byPath.has(`${s.root}/CANDIDATE.json`))throw fail();
  }
  await readWave('roots-and-pointers',[...rootPaths,...pointerPaths]);
  const pointers=pointerPaths.map(path=>{const file=captured.get(path)!;if(Buffer.byteLength(file.content)>8000)throw fail();
    const value=candidateBundlePointerSchema.parse(JSON.parse(file.content)),root=path.split('/').slice(0,2).join('/');
    if(root!==`items/${value.itemId}`||Boolean(value.proposalTarget)!==path.includes('/proposals/'))throw fail();
    return {path,root,value,manifestPath:`${root}/${value.manifestPath}`};});
  await readWave('manifests',pointers.map(p=>p.manifestPath));
  const manifests=pointers.map(p=>{const file=captured.get(p.manifestPath)!;if(Buffer.byteLength(file.content)>32000||file.contentDigest!==p.value.manifestDigest)throw fail();
    const value=candidateBundleManifestSchema.parse(JSON.parse(file.content));
    if(value.organizationId!==scope.organizationId||value.productId!==productId||value.repository!==scope.repository||value.itemId!==p.value.itemId
      ||value.bundleId!==p.value.bundleId||JSON.stringify(value.target)!==JSON.stringify(p.value.proposalTarget)
      ||(p.value.proposalTarget&&Boolean(p.value.parentProposalDigest)!==Boolean(value.previousBundleDigest)))throw fail();
    return {...p,manifest:value};});
  await readWave('bundle-documents',manifests.flatMap(m=>Object.values(m.manifest.documents).map(d=>`${m.root}/${d.path}`)));
  const semantic:Array<File&{status:'canonical'|'candidate'|'amendment'}>=[];
  for(const s of selected)if(!s.candidate)for(const name of ['BRIEF','SPEC'])semantic.push({...captured.get(`${s.root}/${name}.md`)!,status:'canonical'});
  for(const m of manifests){
    for(const name of ['brief','spec','exam'] as const){const ref=m.manifest.documents[name],file=captured.get(`${m.root}/${ref.path}`)!;
      if(!file||file.contentDigest!==ref.contentDigest)throw fail();
      if(name!=='exam')semantic.push({...file,status:m.value.proposalTarget?'amendment':'candidate'});}
    if(!m.value.proposalTarget&&captured.get(`${m.root}/BRIEF.md`)!.contentDigest!==m.manifest.documents.brief.contentDigest)throw fail();
  }
  for(const s of selections){guard();if(JSON.stringify(await authority.select(s.context))!==JSON.stringify(s.value))throw fail();guard();}
  for(const path of captured.keys())await sourceGrant(path,revision);
  if(await io(head)!==observedHead)throw fail();guard();
  return {revision,semantic,waves,files:[...captured.values()],requests,sourcePolicyQueries,
    productionInstalled:false as const,semanticQualityVerified:false as const};
}
