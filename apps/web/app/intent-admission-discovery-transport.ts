import { intentAdmissionInputSchema,intentAdmissionOutputSchema,type IntentAdmissionInput } from '@steer/tool-registry/intent-admission-discovery-contracts';

const failure=()=>new Error('Preparation diagnostics are unavailable. No retry was authorized.');
/** One fixed same-origin authenticated read. Never sends source documents,
 * credentials or generation commands; cancellation retains admission until drain. */
export function createIntentAdmissionDiscoveryTransport(origin:string,transport:typeof fetch=fetch){
  const url=new URL(origin);if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password)throw failure();
  let closed=false,active:AbortController|null=null;
  return{
    async discover(raw:IntentAdmissionInput){
      if(closed||active)throw failure();const input=intentAdmissionInputSchema.parse(raw),body=JSON.stringify(input);
      if(new TextEncoder().encode(body).length>16384)throw failure();
      const controller=new AbortController();active=controller;
      let reader:ReadableStreamDefaultReader<Uint8Array>|undefined,response:Response|undefined,complete=false,cleanup:Promise<unknown>|undefined;
      const cancel=()=>cleanup??=(reader?reader.cancel():response?.body?.cancel()??Promise.resolve()).catch(()=>{});
      let interrupt!:()=>void;
      const interrupted=new Promise<never>((_,reject)=>{interrupt=()=>{if(reader||response)void cancel();reject(failure());};});
      controller.signal.addEventListener('abort',interrupt,{once:true});const timer=setTimeout(()=>controller.abort(),40000);
      const work=(async()=>{
        try{
          response=await transport(`${origin}/v1/tools/intent.admissions.discover`,{method:'POST',body,
            credentials:'same-origin',mode:'same-origin',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal,
            headers:{accept:'application/json','content-type':'application/json'}});
          controller.signal.throwIfAborted();
          if(response.status!==200||response.redirected||!response.body||response.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json')throw failure();
          reader=response.body.getReader();const chunks:Uint8Array[]=[];let bytes=0,count=0;
          while(true){const next=await reader.read();controller.signal.throwIfAborted();if(next.done){complete=true;break;}
            bytes+=next.value.length;if(bytes>60000||++count>10000)throw failure();chunks.push(next.value);}
          const joined=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.length;}
          const value=await intentAdmissionOutputSchema.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(joined)));
          controller.signal.throwIfAborted();
          if(closed||(Object.keys(input) as Array<keyof typeof input>).some(k=>JSON.stringify(value[k])!==JSON.stringify(input[k])))throw failure();return value;
        }finally{if(!complete)await cancel();}
      })();
      void work.finally(()=>{if(active===controller)active=null;}).catch(()=>{});
      try{return await Promise.race([work,interrupted]);}catch{throw failure();}
      finally{clearTimeout(timer);controller.signal.removeEventListener('abort',interrupt);controller.abort();}
    },
    close(){closed=true;active?.abort();},
  };
}
