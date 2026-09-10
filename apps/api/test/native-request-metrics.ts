/** Synthetic fixture diagnostics only. Return counts, never request paths,
 * identities, headers, bodies, tokens, repository names or commit references. */
const empty=()=>({head:0,commit:0,tree:0,blob:0,token:0,mutation:0,other:0});
type Counts=ReturnType<typeof empty>;
const kind=(call:{path:string;method:string;corpusQuery?:boolean}):keyof Counts=>call.method==='POST'&&/^\/app\/installations\/[^/]+\/access_tokens$/.test(call.path)?'token'
      :call.method==='POST'&&call.path==='/graphql'?(call.corpusQuery?'blob':'mutation')
      :call.method==='GET'&&/\/git\/ref\/heads\//.test(call.path)?'head'
      :call.method==='GET'&&/\/git\/commits\//.test(call.path)?'commit'
      :call.method==='GET'&&/\/git\/trees\//.test(call.path)?'tree'
      :call.method==='GET'&&/\/git\/blobs\//.test(call.path)?'blob':'other';
export function summarizeNativeRequests(calls:readonly {path:string;method:string;corpusQuery?:boolean}[],from=0){
  if(!Number.isSafeInteger(from)||from<0||from>calls.length)throw new Error('Invalid diagnostic range.');
  const counts=empty();for(const call of calls.slice(from))counts[kind(call)]++;
  return Object.freeze(counts);
}

/** Fixed synthetic transport ownership, not a guess from the shared repo URL.
 * No request/response content is retained, and delegation preserves references,
 * promises, error identity and the underlying transport's own validation. */
export function createNativeRequestMeter(transport:typeof fetch){
  const counts=empty();
  const measured:typeof fetch=(input,init)=>{
    let category:keyof Counts='other';
    try{
      // Count a batch of immutable blob reads as one blob provider attempt, not
      // a write. Retain only the boolean; never retain query variables or bodies.
      let corpusQuery=false;
      if(typeof init?.body==='string')try{corpusQuery=/^query SteerCorpusArtifactBatch\(/.test(JSON.parse(init.body).query);}catch{}
      category=kind({path:new URL(input instanceof Request?input.url:String(input)).pathname,
        method:init?.method??(input instanceof Request?input.method:'GET'),corpusQuery});
    }catch{}
    counts[category]++;return transport(input,init);
  };
  return {transport:measured,snapshot:()=>Object.freeze({...counts})};
}

export function subtractNativeRequests(total:Readonly<Counts>,part:Readonly<Counts>){
  const result=empty();
  for(const key of Object.keys(result) as Array<keyof Counts>){
    if(!Number.isSafeInteger(total[key])||!Number.isSafeInteger(part[key])||part[key]<0||total[key]<part[key])
      throw new Error('Invalid diagnostic partition.');
    result[key]=total[key]-part[key];
  }
  return Object.freeze(result);
}
