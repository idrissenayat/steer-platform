import { intentDevelopmentHistoryInputSchema,verifyIntentDevelopmentHistoryOutput,type IntentDevelopmentHistoryInput } from '@steer/tool-registry/intent-development-history-contracts';

const failure=()=>new Error('Original agent documents are unavailable. Your editor is unchanged.');
/** One fixed same-origin authenticated read. Never sends source documents,
 * credentials or generation commands; cancellation retains admission until drain. */
export function createIntentDevelopmentHistoryTransport(origin:string,transport:typeof fetch=fetch){
  const url=new URL(origin);if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password)throw failure();
  let closed=false,active:AbortController|null=null;
  return{
    async read(raw:IntentDevelopmentHistoryInput){
      if(closed||active)throw failure();const input=intentDevelopmentHistoryInputSchema.parse(raw),body=JSON.stringify(input);
      if(new TextEncoder().encode(body).length>16384)throw failure();
      const controller=new AbortController();active=controller;
      let reader:ReadableStreamDefaultReader<Uint8Array>|undefined,response:Response|undefined,complete=false,cleanup:Promise<unknown>|undefined;
      const cancel=()=>cleanup??=(reader?reader.cancel():response?.body?.cancel()??Promise.resolve()).catch(()=>{});
      let interrupt!:()=>void;
      const interrupted=new Promise<never>((_,reject)=>{interrupt=()=>{if(reader||response)void cancel();reject(failure());};});
      controller.signal.addEventListener('abort',interrupt,{once:true});const timer=setTimeout(()=>controller.abort(),40000);
      const work=(async()=>{
        try{
          response=await transport(`${origin}/v1/tools/intent.development.history`,{method:'POST',body,
            credentials:'same-origin',mode:'same-origin',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal,
            headers:{accept:'application/json','content-type':'application/json'}});
          controller.signal.throwIfAborted();
          if(response.status!==200||response.redirected||!response.body||response.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json')throw failure();
          reader=response.body.getReader();const chunks:Uint8Array[]=[];let bytes=0,count=0;
          while(true){const next=await reader.read();controller.signal.throwIfAborted();if(next.done){complete=true;break;}
            bytes+=next.value.length;if(bytes>600000||++count>10000)throw failure();chunks.push(next.value);}
          const joined=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.length;}
          const value=await verifyIntentDevelopmentHistoryOutput(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(joined)));
          controller.signal.throwIfAborted();
          if(closed||(Object.keys(input) as Array<keyof typeof input>).some(k=>value[k]!==input[k]))throw failure();return value;
        }finally{if(!complete)await cancel();}
      })();
      void work.finally(()=>{if(active===controller)active=null;}).catch(()=>{});
      try{return await Promise.race([work,interrupted]);}catch{throw failure();}
      finally{clearTimeout(timer);controller.signal.removeEventListener('abort',interrupt);controller.abort();}
    },
    close(){closed=true;active?.abort();},
  };
}
