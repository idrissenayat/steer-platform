import assert from 'node:assert/strict';
import test from 'node:test';
import type {Pool} from 'pg';
import {createIntegrationDatabaseTrace,parseIntegrationSelection} from './integration-diagnostics.ts';

test('integration focus is explicit, bounded and distinct from the full suite',()=>{
  assert.deepEqual(parseIntegrationSelection([]),{mode:'full'});
  assert.deepEqual(parseIntegrationSelection(['--scope-runtime']),{mode:'scope-runtime'});
  assert.deepEqual(parseIntegrationSelection(['--development-history']),{mode:'development-history'});
  assert.deepEqual(parseIntegrationSelection(['--run-discovery']),{mode:'run-discovery'});
  assert.deepEqual(parseIntegrationSelection(['--admission-discovery']),{mode:'admission-discovery'});
  assert.throws(()=>parseIntegrationSelection(['--admission-discovery','extra']));
  assert.deepEqual(parseIntegrationSelection(['--candidate-save']),{mode:'candidate-save'});
  assert.deepEqual(parseIntegrationSelection(['--candidate-start']),{mode:'candidate-start'});
  assert.throws(()=>parseIntegrationSelection(['--candidate-start','extra']));
  assert.throws(()=>parseIntegrationSelection(['--candidate-save','extra']));
  assert.throws(()=>parseIntegrationSelection(['--run-discovery','extra']));
  assert.throws(()=>parseIntegrationSelection(['--development-history','extra']));
  for(const args of [['--scope-runtime','extra'],['--scope-runtime','--query-delay-ms','1']])assert.throws(()=>parseIntegrationSelection(args));
  for(const n of ['1','10','20'])assert.deepEqual(parseIntegrationSelection(['--clarification-repro',n]),{mode:'clarification-repro',iterations:Number(n),queryDelayMs:0});
  assert.deepEqual(parseIntegrationSelection(['--clarification-repro','1','--query-delay-ms','2']),{mode:'clarification-repro',iterations:1,queryDelayMs:2});
  for(const args of [['--focus'],['--clarification-repro'],['--clarification-repro','0'],['--clarification-repro','21'],['--clarification-repro','01'],['--clarification-repro','1e1'],['--clarification-repro','2','extra']])assert.throws(()=>parseIntegrationSelection(args));
  for(const v of ['-1','6','1.5','private'])assert.throws(()=>parseIntegrationSelection(['--clarification-repro','1','--query-delay-ms',v]));
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
