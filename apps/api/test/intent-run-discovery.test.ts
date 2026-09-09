import assert from 'node:assert/strict';
import test from 'node:test';
import {runDiscoveryFixture} from '../../../packages/tool-registry/test/intent-run-discovery.fixture.ts';
import {createApi} from '../src/app.ts';
import {createMcpEndpoint,mcpProtocolVersion} from '../src/mcp.ts';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
test('retained run discovery shares one no-store human HTTP and MCP contract without model or execution access',async()=>{
  const f=runDiscoveryFixture(),principal={organizationId:f.input.organizationId,subject:'human',type:'human',hats:[],toolGrants:['intent.runs.discover'],expiresAt:new Date(Date.now()+60000).toISOString()};
  const dependencies={authenticate:async()=>principal,services:{intentRunDiscovery:{scope:{...f.input,subject:'human'},discover:async(_input:unknown,current:()=>Promise<void>)=>{await current();return f.output;}}}};
  const app=createApi(dependencies),endpoint=createMcpEndpoint('https://steer.test',dependencies);
  const client=new Client({name:'synthetic-development-history',version:'1'},{versionNegotiation:{mode:{pin:mcpProtocolVersion}}});
  try{
    const response=await app.request('/v1/tools/intent.runs.discover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(f.input)});
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),f.output);
    await client.connect(new StreamableHTTPClientTransport(new URL('https://steer.test/mcp'),{protocolVersion:mcpProtocolVersion,
      requestInit:{headers:{authorization:'Bearer synthetic'}},fetch:(url,init)=>endpoint.fetch(new Request(url,init))}));
    assert.equal((await client.listTools()).tools.find(t=>t.name==='intent.runs.discover')?.annotations?.readOnlyHint,true);
    const result=await client.callTool({name:'intent.runs.discover',arguments:f.input});assert.ok(!result.isError);assert.deepEqual(result.structuredContent,{result:f.output});
    principal.toolGrants=[];assert.equal((await client.callTool({name:'intent.runs.discover',arguments:f.input})).isError,true);
  }finally{await client.close();await endpoint.shutdown();}
});
