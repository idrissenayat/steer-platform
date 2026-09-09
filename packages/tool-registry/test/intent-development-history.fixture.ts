import {createHash} from 'node:crypto';
import {developmentFixture} from './intent-development.fixture.ts';
import {verifyIntentDevelopmentHistoryOutput} from '../src/intent-development-history-contracts.ts';
export async function developmentHistoryFixture(){
  const f=await developmentFixture();
  const output=await verifyIntentDevelopmentHistoryOutput({...f.ready,kind:'steer-development-history/v1',historical:true,operationExpired:true,
    status:'complete',semanticQualityVerified:false,source:{...f.ready.source,latestRevision:2},
    results:f.ready.results.map((r,i)=>({...r,stepInputDigest:String(i+5).repeat(64),
      predecessorResultDigest:i?f.ready.results[0]!.resultDigest:null,outputDigest:createHash('sha256').update(JSON.stringify(r.result)).digest('hex')}))});
  return{...f,output};
}
