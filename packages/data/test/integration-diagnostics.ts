import type {Pool,PoolClient} from 'pg';
import {setTimeout as delay} from 'node:timers/promises';

/** Explicit command-line selection only. Focused evidence must never be reported
 * as the full integration suite, including when inherited environment is dirty. */
export function parseIntegrationSelection(args:readonly string[]) {
  if(!args.length)return {mode:'full' as const};
  if(args.length===1&&args[0]==='--scope-runtime')return {mode:'scope-runtime' as const};
  if(args.length===1&&args[0]==='--development-history')return {mode:'development-history' as const};
  if(args.length===1&&args[0]==='--development-history-records')return {mode:'development-history-records' as const};
  if(args.length===1&&args[0]==='--development-start')return {mode:'development-start' as const};
  if(args.length===1&&args[0]==='--development-prepare')return {mode:'development-prepare' as const};
  if(args.length===1&&args[0]==='--run-discovery')return {mode:'run-discovery' as const};
  if(args.length===1&&args[0]==='--admission-discovery')return {mode:'admission-discovery' as const};
  if(args.length===1&&args[0]==='--candidate-save')return {mode:'candidate-save' as const};
  if(args.length===1&&args[0]==='--candidate-start')return {mode:'candidate-start' as const};
  if(args.length===1&&args[0]==='--candidate-journey')return {mode:'candidate-journey' as const};
  if(args.length===1&&args[0]==='--journey-runtime')return {mode:'journey-runtime' as const};
  if(args.length===1&&args[0]==='--journey-performance')return {mode:'journey-performance' as const};
  if(args.length===1&&args[0]==='--journey-runtime-revision')return {mode:'journey-runtime-revision' as const};
  if(args.length===1&&args[0]==='--journey-runtime-linked')return {mode:'journey-runtime-linked' as const};
  if(args.length===1&&args[0]==='--journey-runtime-amendment')return {mode:'journey-runtime-amendment' as const};
  if(args.length===1&&args[0]==='--journey-runtime-continuation')return {mode:'journey-runtime-continuation' as const};
  if(![2,4].includes(args.length)||!['--clarification-repro','--candidate-recovery-repro'].includes(args[0]!)||!/^([1-9]|1[0-9]|20)$/.test(args[1]!)
    ||(args.length===4&&(args[2]!=='--query-delay-ms'||! /^[0-5]$/.test(args[3]!))))
    throw new Error('Use no arguments for the full suite, --scope-runtime, --development-history, --development-history-records, --development-start, --development-prepare, --run-discovery, --admission-discovery, --candidate-save, --candidate-start, --candidate-journey, --journey-runtime, --journey-performance, --journey-runtime-revision, --journey-runtime-linked, --journey-runtime-amendment, --journey-runtime-continuation, or --clarification-repro / --candidate-recovery-repro 1-20 [--query-delay-ms 0-5].');
  return {mode:args[0]==='--candidate-recovery-repro'?'candidate-recovery-repro' as const:'clarification-repro' as const,iterations:Number(args[1]),queryDelayMs:args.length===4?Number(args[3]):0};
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
const clockQuery="SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS now";
/** Test-only, bounded metadata. Reports contain no SQL, arguments, error text,
 * targets, absolute timestamps, configuration, source, bodies or credentials.
 * Only a last clock value per lease is held privately to derive capped deltas;
 * release clears it and reset invalidates its sequence. Observing a result never
 * replaces it or grants work. */
export function createIntegrationDatabaseTrace(queryDelayMs=0){
  if(!Number.isInteger(queryDelayMs)||queryDelayMs<0||queryDelayMs>5)throw new Error('Invalid synthetic query delay.');
  const events:Array<{phase:Phase;durationMs:number;code:string|null}>=[];
  let calls=0,failures=0,maxDurationMs=0,generation=0;
  const clock={samples:0,regressions:0,maxBackwardMs:0,invalidSamples:0};
  const counts:Record<Phase,number>={connect:0,commit:0,rollback:0,'observation-write':0,'result-write':0,'execution-write':0,query:0};
  const timed=async<T>(kind:Phase,run:()=>Promise<T>)=>{
    const start=performance.now(),startedGeneration=generation;let code:string|null=null;
    try{if(queryDelayMs&&kind!=='connect')await delay(queryDelayMs);return await run();}catch(e){const c=(e as {code?:unknown})?.code;code=typeof c==='string'&&codes.has(c)?c:'other';if(startedGeneration===generation)failures++;throw e;}
    finally{if(startedGeneration===generation){const durationMs=Math.min(3600000,Math.max(0,Math.ceil(performance.now()-start)));calls++;maxDurationMs=Math.max(maxDurationMs,durationMs);
      counts[kind]++;events.push({phase:kind,durationMs,code});if(events.length>32)events.shift();}}
  };
  return{
    wrap(pool:Pool):Pool{return new Proxy(pool,{get(target,key){
      if(key==='connect')return async()=>{const client=await timed('connect',()=>target.connect());
        let lastClock:number|undefined,clockGeneration=generation;
        const observeClock=(sql:string,result:unknown)=>{
          if(sql!==clockQuery)return;
          if(clockGeneration!==generation){lastClock=undefined;clockGeneration=generation;}
          try{
            const rows=(result as {rows?:Array<{now?:unknown}>})?.rows,value=rows?.length===1?rows[0]?.now:undefined;
            const next=typeof value==='number'?value:typeof value==='string'&&/^(0|[1-9][0-9]{0,15})$/.test(value)?Number(value):NaN;
            if(!Number.isSafeInteger(next)||next<0)throw new Error();
            clock.samples++;
            if(lastClock!==undefined&&next<lastClock){clock.regressions++;clock.maxBackwardMs=Math.max(clock.maxBackwardMs,Math.min(3600000,lastClock-next));}
            lastClock=next;
          }catch{clock.invalidSamples++;lastClock=undefined;}
        };
        return new Proxy(client,{get(c,k){if(k==='query')return (sql:string,values?:unknown[])=>{
            const queryGeneration=generation;return timed(phase(sql),async()=>{
              const result=await c.query(sql,values);if(queryGeneration===generation)observeClock(sql,result);return result;
            });
          };
          if(k==='release')return (...args:Parameters<PoolClient['release']>)=>{lastClock=undefined;return Reflect.apply(c.release,c,args);};
          const v=Reflect.get(c,k,c);return typeof v==='function'?v.bind(c):v;}}) as PoolClient;};
      const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
    }});},
    summary(){return {calls,failures,maxDurationMs,counts:{...counts},events:events.map(e=>({...e})),clock:{...clock}};},
    reset(){calls=0;failures=0;maxDurationMs=0;events.length=0;generation++;for(const key of Object.keys(counts) as Phase[])counts[key]=0;
      clock.samples=0;clock.regressions=0;clock.maxBackwardMs=0;clock.invalidSamples=0;},
  };
}
