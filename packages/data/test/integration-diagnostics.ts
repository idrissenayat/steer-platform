import type {Pool,PoolClient} from 'pg';
import {setTimeout as delay} from 'node:timers/promises';

/** Explicit command-line selection only. Focused evidence must never be reported
 * as the full integration suite, including when inherited environment is dirty. */
export function parseIntegrationSelection(args:readonly string[]) {
  if(!args.length)return {mode:'full' as const};
  if(![2,4].includes(args.length)||args[0]!=='--clarification-repro'||!/^([1-9]|1[0-9]|20)$/.test(args[1]!)
    ||(args.length===4&&(args[2]!=='--query-delay-ms'||! /^[0-5]$/.test(args[3]!))))
    throw new Error('Use no arguments for the full suite, or --clarification-repro 1-20 [--query-delay-ms 0-5].');
  return {mode:'clarification-repro' as const,iterations:Number(args[1]),queryDelayMs:args.length===4?Number(args[3]):0};
}
type Phase='connect'|'commit'|'rollback'|'observation-write'|'result-write'|'execution-write'|'query';
const codes=new Set(['23514','23505','42501','55P03','57014','57P01','53300']);
const phase=(sql:unknown):Phase=>{
  if(sql==='COMMIT')return 'commit';if(sql==='ROLLBACK')return 'rollback';
  if(typeof sql!=='string')return 'query';
  if(/^INSERT INTO steer_drafts\.development_observations/.test(sql))return 'observation-write';
  if(/^INSERT INTO steer_drafts\.development_results/.test(sql))return 'result-write';
  if(/^(INSERT INTO|UPDATE) steer_execution\.intent_steps/.test(sql))return 'execution-write';
  return 'query';
};
/** Test-only, bounded metadata. Never retain SQL, arguments, error text, targets,
 * timestamps, configuration, source, provider bodies or connection credentials. */
export function createIntegrationDatabaseTrace(queryDelayMs=0){
  if(!Number.isInteger(queryDelayMs)||queryDelayMs<0||queryDelayMs>5)throw new Error('Invalid synthetic query delay.');
  const events:Array<{phase:Phase;durationMs:number;code:string|null}>=[];
  let calls=0,failures=0,maxDurationMs=0;
  const counts:Record<Phase,number>={connect:0,commit:0,rollback:0,'observation-write':0,'result-write':0,'execution-write':0,query:0};
  const timed=async<T>(kind:Phase,run:()=>Promise<T>)=>{
    const start=performance.now();let code:string|null=null;
    try{if(queryDelayMs&&kind!=='connect')await delay(queryDelayMs);return await run();}catch(e){const c=(e as {code?:unknown})?.code;code=typeof c==='string'&&codes.has(c)?c:'other';failures++;throw e;}
    finally{const durationMs=Math.min(3600000,Math.max(0,Math.ceil(performance.now()-start)));calls++;maxDurationMs=Math.max(maxDurationMs,durationMs);
      counts[kind]++;events.push({phase:kind,durationMs,code});if(events.length>32)events.shift();}
  };
  return{
    wrap(pool:Pool):Pool{return new Proxy(pool,{get(target,key){
      if(key==='connect')return async()=>{const client=await timed('connect',()=>target.connect());
        return new Proxy(client,{get(c,k){if(k==='query')return (sql:string,values?:unknown[])=>timed(phase(sql),()=>c.query(sql,values));
          const v=Reflect.get(c,k,c);return typeof v==='function'?v.bind(c):v;}}) as PoolClient;};
      const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
    }});},
    summary(){return {calls,failures,maxDurationMs,counts:{...counts},events:events.map(e=>({...e}))};},
    reset(){calls=0;failures=0;maxDurationMs=0;events.length=0;for(const key of Object.keys(counts) as Phase[])counts[key]=0;},
  };
}
