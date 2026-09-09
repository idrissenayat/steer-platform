/** Synthetic fixture diagnostics only. Return counts, never request paths,
 * identities, headers, bodies, tokens, repository names or commit references. */
export function summarizeNativeRequests(calls:readonly {path:string;method:string}[],from=0){
  if(!Number.isSafeInteger(from)||from<0||from>calls.length)throw new Error('Invalid diagnostic range.');
  const counts={head:0,commit:0,tree:0,blob:0,token:0,mutation:0,other:0};
  for(const call of calls.slice(from)){
    const key=call.method==='POST'&&/^\/app\/installations\/[^/]+\/access_tokens$/.test(call.path)?'token'
      :call.method==='POST'&&call.path==='/graphql'?'mutation'
      :call.method==='GET'&&/\/git\/ref\/heads\//.test(call.path)?'head'
      :call.method==='GET'&&/\/git\/commits\//.test(call.path)?'commit'
      :call.method==='GET'&&/\/git\/trees\//.test(call.path)?'tree'
      :call.method==='GET'&&/\/git\/blobs\//.test(call.path)?'blob':'other';
    counts[key]++;
  }
  return Object.freeze(counts);
}
