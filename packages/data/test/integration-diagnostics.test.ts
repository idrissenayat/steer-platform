import assert from 'node:assert/strict';
import test from 'node:test';

test('original preservation selection is explicit and cannot combine with another suite or delay flag',()=>{
  assert.deepEqual(parseIntegrationSelection(['--original-preservation']),{mode:'original-preservation'});
  for(const args of [['--original-preservation','extra'],['--original-preservation','--journey-runtime'],['--original-preservation','--query-delay-ms','1']])
    assert.throws(()=>parseIntegrationSelection(args));
});
import type {Pool} from 'pg';
import {createIntegrationDatabaseTrace,parseIntegrationSelection} from './integration-diagnostics.ts';

test('integration focus is explicit, bounded and distinct from the full suite',()=>{
  assert.deepEqual(parseIntegrationSelection(['--draft-read-phase']),{mode:'draft-read-phase'});
  for(const args of [['--draft-read-phase','extra'],['--draft-read-phase','--journey-runtime'],['--draft-read-phase','--query-delay-ms','1']])assert.throws(()=>parseIntegrationSelection(args));
  assert.deepEqual(parseIntegrationSelection([]),{mode:'full'});
  assert.deepEqual(parseIntegrationSelection(['--scope-runtime']),{mode:'scope-runtime'});
  assert.deepEqual(parseIntegrationSelection(['--scope-read']),{mode:'scope-read'});
  assert.throws(()=>parseIntegrationSelection(['--scope-read','extra']));
  assert.throws(()=>parseIntegrationSelection(['--scope-read','--scope-runtime']));
  assert.deepEqual(parseIntegrationSelection(['--development-history']),{mode:'development-history'});
  assert.deepEqual(parseIntegrationSelection(['--development-history-records']),{mode:'development-history-records'});
  assert.throws(()=>parseIntegrationSelection(['--development-history-records','extra']));
  assert.throws(()=>parseIntegrationSelection(['--development-history-records','--development-history']));
  assert.deepEqual(parseIntegrationSelection(['--development-start']),{mode:'development-start'});
  assert.throws(()=>parseIntegrationSelection(['--development-start','extra']));
  assert.deepEqual(parseIntegrationSelection(['--development-prepare']),{mode:'development-prepare'});
  assert.throws(()=>parseIntegrationSelection(['--development-prepare','extra']));
  assert.throws(()=>parseIntegrationSelection(['--development-prepare','--journey-runtime']));
  assert.deepEqual(parseIntegrationSelection(['--run-discovery']),{mode:'run-discovery'});
  assert.deepEqual(parseIntegrationSelection(['--admission-discovery']),{mode:'admission-discovery'});
  assert.throws(()=>parseIntegrationSelection(['--admission-discovery','extra']));
  assert.deepEqual(parseIntegrationSelection(['--candidate-save']),{mode:'candidate-save'});
  assert.deepEqual(parseIntegrationSelection(['--candidate-start']),{mode:'candidate-start'});
  assert.deepEqual(parseIntegrationSelection(['--candidate-journey']),{mode:'candidate-journey'});
  assert.deepEqual(parseIntegrationSelection(['--journey-runtime']),{mode:'journey-runtime'});
  assert.deepEqual(parseIntegrationSelection(['--journey-request-profile']),{mode:'journey-request-profile'});
  assert.deepEqual(parseIntegrationSelection(['--records-readset-feasibility']),{mode:'records-readset-feasibility'});
  assert.deepEqual(parseIntegrationSelection(['--combined-readset-feasibility']),{mode:'combined-readset-feasibility'});
  assert.deepEqual(parseIntegrationSelection(['--combined-readgraph-feasibility']),{mode:'combined-readgraph-feasibility'});
  assert.deepEqual(parseIntegrationSelection(['--combined-native-readgraph-feasibility']),{mode:'combined-native-readgraph-feasibility'});
  assert.deepEqual(parseIntegrationSelection(['--owned-records-readset']),{mode:'owned-records-readset'});
  assert.deepEqual(parseIntegrationSelection(['--owned-content-readset']),{mode:'owned-content-readset'});
  assert.deepEqual(parseIntegrationSelection(['--owned-history-readset']),{mode:'owned-history-readset'});
  assert.throws(()=>parseIntegrationSelection(['--owned-history-readset','--owned-content-readset']));
  assert.throws(()=>parseIntegrationSelection(['--owned-content-readset','--owned-records-readset']));
  assert.throws(()=>parseIntegrationSelection(['--owned-records-readset','extra']));
  assert.throws(()=>parseIntegrationSelection(['--owned-records-readset','--combined-native-readgraph-feasibility']));
  assert.throws(()=>parseIntegrationSelection(['--combined-native-readgraph-feasibility','extra']));
  assert.throws(()=>parseIntegrationSelection(['--combined-native-readgraph-feasibility','--combined-readgraph-feasibility']));
  assert.throws(()=>parseIntegrationSelection(['--combined-readgraph-feasibility','extra']));
  assert.throws(()=>parseIntegrationSelection(['--combined-readgraph-feasibility','--combined-readset-feasibility']));
  assert.throws(()=>parseIntegrationSelection(['--combined-readset-feasibility','extra']));
  assert.throws(()=>parseIntegrationSelection(['--combined-readset-feasibility','--records-readset-feasibility']));
  assert.throws(()=>parseIntegrationSelection(['--records-readset-feasibility','extra']));
  assert.throws(()=>parseIntegrationSelection(['--records-readset-feasibility','--journey-performance']));
  assert.throws(()=>parseIntegrationSelection(['--records-readset-feasibility','--journey-request-profile']));
  assert.throws(()=>parseIntegrationSelection(['--journey-request-profile','extra']));
  assert.throws(()=>parseIntegrationSelection(['--journey-request-profile','--journey-runtime']));
  assert.deepEqual(parseIntegrationSelection(['--journey-performance']),{mode:'journey-performance'});
  assert.throws(()=>parseIntegrationSelection(['--journey-performance','extra']));
  assert.throws(()=>parseIntegrationSelection(['--journey-performance','--journey-runtime']));
  assert.deepEqual(parseIntegrationSelection(['--journey-runtime-revision']),{mode:'journey-runtime-revision'});
  assert.throws(()=>parseIntegrationSelection(['--journey-runtime-revision','extra']));
  assert.throws(()=>parseIntegrationSelection(['--journey-runtime-revision','--journey-runtime']));
  assert.deepEqual(parseIntegrationSelection(['--journey-runtime-linked']),{mode:'journey-runtime-linked'});
  assert.throws(()=>parseIntegrationSelection(['--journey-runtime-linked','extra']));
  assert.throws(()=>parseIntegrationSelection(['--journey-runtime-linked','--journey-runtime-revision']));
  assert.deepEqual(parseIntegrationSelection(['--journey-runtime-amendment']),{mode:'journey-runtime-amendment'});
  assert.deepEqual(parseIntegrationSelection(['--journey-runtime-continuation']),{mode:'journey-runtime-continuation'});
  assert.throws(()=>parseIntegrationSelection(['--journey-runtime-continuation','extra']));
  assert.throws(()=>parseIntegrationSelection(['--journey-runtime-continuation','--journey-runtime-amendment']));
  assert.throws(()=>parseIntegrationSelection(['--journey-runtime-amendment','extra']));
  assert.throws(()=>parseIntegrationSelection(['--journey-runtime-amendment','--journey-runtime-linked']));
  assert.throws(()=>parseIntegrationSelection(['--journey-runtime','extra']));
  assert.throws(()=>parseIntegrationSelection(['--candidate-journey','extra']));
  assert.throws(()=>parseIntegrationSelection(['--candidate-start','extra']));
  assert.throws(()=>parseIntegrationSelection(['--candidate-save','extra']));
  assert.throws(()=>parseIntegrationSelection(['--run-discovery','extra']));
  assert.throws(()=>parseIntegrationSelection(['--development-history','extra']));
  assert.deepEqual(parseIntegrationSelection(['--scope-prepare']),{mode:'scope-prepare'});
  assert.deepEqual(parseIntegrationSelection(['--scope-start']),{mode:'scope-start'});
  for(const args of [['--scope-start','extra'],['--scope-start','--scope-runtime'],['--scope-start','--query-delay-ms','1']])assert.throws(()=>parseIntegrationSelection(args));
  for(const args of [['--scope-prepare','extra'],['--scope-prepare','--scope-runtime'],['--scope-prepare','--query-delay-ms','1']])assert.throws(()=>parseIntegrationSelection(args));
  for(const args of [['--scope-runtime','extra'],['--scope-runtime','--query-delay-ms','1']])assert.throws(()=>parseIntegrationSelection(args));
  for(const n of ['1','10','20'])assert.deepEqual(parseIntegrationSelection(['--clarification-repro',n]),{mode:'clarification-repro',iterations:Number(n),queryDelayMs:0});
  assert.deepEqual(parseIntegrationSelection(['--clarification-repro','1','--query-delay-ms','2']),{mode:'clarification-repro',iterations:1,queryDelayMs:2});
  for(const args of [['--focus'],['--clarification-repro'],['--clarification-repro','0'],['--clarification-repro','21'],['--clarification-repro','01'],['--clarification-repro','1e1'],['--clarification-repro','2','extra']])assert.throws(()=>parseIntegrationSelection(args));
  for(const v of ['-1','6','1.5','private'])assert.throws(()=>parseIntegrationSelection(['--clarification-repro','1','--query-delay-ms',v]));
  for(const n of ['1','10','20'])assert.deepEqual(parseIntegrationSelection(['--candidate-recovery-repro',n]),{mode:'candidate-recovery-repro',iterations:Number(n),queryDelayMs:0});
  assert.deepEqual(parseIntegrationSelection(['--candidate-recovery-repro','20','--query-delay-ms','5']),{mode:'candidate-recovery-repro',iterations:20,queryDelayMs:5});
  for(const args of [['--candidate-recovery-repro'],['--candidate-recovery-repro','0'],['--candidate-recovery-repro','21'],['--candidate-recovery-repro','01'],['--candidate-recovery-repro','1e1'],['--candidate-recovery-repro','2','extra'],['--candidate-recovery-repro','1','--journey-runtime'],['--candidate-recovery-repro','1','--query-delay-ms']])assert.throws(()=>parseIntegrationSelection(args));
  for(const v of ['-1','6','1.5','private'])assert.throws(()=>parseIntegrationSelection(['--candidate-recovery-repro','1','--query-delay-ms',v]));
});
test('database diagnostic ring preserves only bounded phases, durations and allowlisted codes',async()=>{
  const trace=createIntegrationDatabaseTrace();let released=0,queries=0;
  const privateValue='PRIVATE-SOURCE-KEY-ERROR-SQL';
  const client={query:async(sql:string)=>{queries++;if(sql.includes('fail'))throw Object.assign(new Error(privateValue),{code:sql==='fail-known'?'57014':privateValue});return {rows:[{privateValue}]};},release(){released++;}};
  const pool=trace.wrap({connect:async()=>client,query:async()=>({rows:[]})} as unknown as Pool),connection=await pool.connect();
  for(let i=0;i<40;i++)assert.equal((await connection.query(`SELECT '${privateValue}'`,[privateValue])).rows[0].privateValue,privateValue);
  await assert.rejects(connection.query('fail-known'));await assert.rejects(connection.query('fail-other'));connection.release();
  const summary=trace.summary();assert.equal(summary.calls,43);assert.equal(summary.failures,2);assert.equal(summary.events.length,32);
  assert.deepEqual(summary.events.slice(-2).map(e=>e.code),['57014','other']);assert.equal(released,1);assert.equal(queries,42);
  assert.equal(JSON.stringify(summary).includes(privateValue),false);assert.ok(summary.events.every(e=>Number.isSafeInteger(e.durationMs)&&e.durationMs>=0));
  summary.events.length=0;assert.equal(trace.summary().events.length,32);
  assert.equal(summary.counts.connect,1);assert.equal(summary.counts.query,42);
  trace.reset();assert.equal(trace.summary().calls,0);assert.deepEqual(trace.summary().events,[]);assert.ok(Object.values(trace.summary().counts).every(v=>v===0));
  for(const invalid of [-1,6,NaN,1.5])assert.throws(()=>createIntegrationDatabaseTrace(invalid));
});

const clockSql="SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS now";
test('clock diagnostics observe regressions without exposing absolute time or changing query results and errors',async()=>{
  const trace=createIntegrationDatabaseTrace(),privateValue='PRIVATE-CLOCK-QUERY-BODY';let result:unknown,error:Error|undefined;
  const client={query:async()=>{if(error)throw error;return result;},release(){}};
  const connection=await trace.wrap({connect:async()=>client} as unknown as Pool).connect();
  for(const now of [1788000000000,'1788000000003','1787999999998']){
    result={rows:[{now,privateValue}]};assert.equal(await connection.query(clockSql,[privateValue]),result);
  }
  assert.deepEqual(trace.summary().clock,{samples:3,regressions:1,maxBackwardMs:5,invalidSamples:0});
  for(const now of ['', '1e3', '-1', '01', ' 1', Number.MAX_SAFE_INTEGER+1, NaN, -1, null]){
    result={rows:[{now}]};assert.equal(await connection.query(clockSql),result);
  }
  result=Object.defineProperty({},'rows',{get(){throw new Error(privateValue);}});
  assert.equal(await connection.query('SELECT PRIVATE'),result); // Unrecognized SQL must not inspect rows.
  assert.equal(await connection.query(clockSql),result);assert.equal(trace.summary().clock.invalidSamples,10);
  error=new Error(privateValue);await assert.rejects(connection.query(clockSql),e=>e===error);
  const summary=trace.summary();assert.equal(summary.failures,1);
  assert.doesNotMatch(JSON.stringify(summary),/PRIVATE|178800000000|178799999999/);
  summary.clock.samples=999;assert.equal(trace.summary().clock.samples,3);connection.release();
});

test('clock diagnostics keep concurrent leases and reset generations separate and cap backward deltas',async()=>{
  const trace=createIntegrationDatabaseTrace();let now=0,released=0;
  const raw={query:async()=>({rows:[{now}]}),release(){assert.equal(this,raw);released++;}};
  const pool=trace.wrap({connect:async()=>raw} as unknown as Pool),one=await pool.connect(),two=await pool.connect();
  now=5000000;await one.query(clockSql);now=100;await two.query(clockSql); // A different lease is not a regression.
  assert.equal(trace.summary().clock.regressions,0);
  now=0;await one.query(clockSql);assert.deepEqual(trace.summary().clock,{samples:3,regressions:1,maxBackwardMs:3600000,invalidSamples:0});
  trace.reset();now=1;await two.query(clockSql);assert.deepEqual(trace.summary().clock,{samples:1,regressions:0,maxBackwardMs:0,invalidSamples:0});
  one.release();two.release();assert.equal(released,2);
  const next=await pool.connect();now=0;await next.query(clockSql);assert.equal(trace.summary().clock.regressions,0);next.release();
});

test('reset excludes late query completions and errors from the next diagnostic sample without hiding their results',async()=>{
  const trace=createIntegrationDatabaseTrace();let resolve!:(value:unknown)=>void,reject!:(error:Error)=>void;
  const client={query:()=>new Promise((yes,no)=>{resolve=yes;reject=no;}),release(){}};
  const connection=await trace.wrap({connect:async()=>client} as unknown as Pool).connect();
  const first=connection.query(clockSql),result={rows:[{now:1788000000000}]};trace.reset();resolve(result);
  assert.equal(await first,result);assert.equal(trace.summary().calls,0);assert.equal(trace.summary().clock.samples,0);
  const second=connection.query(clockSql),error=new Error('PRIVATE late error');trace.reset();reject(error);
  await assert.rejects(second,e=>e===error);assert.equal(trace.summary().calls,0);assert.equal(trace.summary().failures,0);
  const third=connection.query(clockSql);resolve({rows:[{now:1}]});await third;
  assert.equal(trace.summary().calls,1);assert.deepEqual(trace.summary().clock,{samples:1,regressions:0,maxBackwardMs:0,invalidSamples:0});connection.release();
});
