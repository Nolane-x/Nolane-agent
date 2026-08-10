import { createServer as createNetServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHttpServer } from '../src/server/http-server.mjs';
import { PRODUCT } from '../src/core/constants.mjs';

async function availablePort() {
  const probe=createNetServer();
  await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve);});
  const port=probe.address().port;
  await new Promise((resolve)=>probe.close(resolve));
  return port;
}

const root=await mkdtemp(path.join(tmpdir(),'forgeos-smoke-'));
const port=await availablePort();
const base=`http://127.0.0.1:${port}`;
const server=createHttpServer({dataDir:root,publicBaseUrl:base,allowedOrigins:[base],allowAnonymousLocal:true});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});

const mcpHeaders=(extra={})=>({'content-type':'application/json','accept':'application/json, text/event-stream',origin:base,...extra});
const post=async(pathname,payload,headers={})=>{
  const response=await fetch(`${base}${pathname}`,{method:'POST',headers:{'content-type':'application/json',origin:base,...headers},body:JSON.stringify(payload)});
  const text=await response.text();
  const body=text?JSON.parse(text):null;
  if(!response.ok)throw new Error(`${pathname}: HTTP ${response.status}: ${text}`);
  return {response,body};
};

try{
  const health=await fetch(`${base}/health`).then((response)=>response.json());
  if(health.status!=='ok'||health.version!==PRODUCT.version)throw new Error('health check failed');

  const initialized=await post('/mcp',{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:PRODUCT.protocolTargets.mcp,capabilities:{},clientInfo:{name:'forgeos-smoke',version:PRODUCT.version}}},mcpHeaders());
  if(initialized.body.result?.serverInfo?.name!=='forge-os')throw new Error('MCP initialize failed');
  const sessionId=initialized.response.headers.get('mcp-session-id');
  if(!sessionId)throw new Error('MCP session ID missing');
  const sessionHeaders=mcpHeaders({'mcp-session-id':sessionId,'mcp-protocol-version':PRODUCT.protocolTargets.mcp});

  const ready=await post('/mcp',{jsonrpc:'2.0',method:'notifications/initialized'},sessionHeaders);
  if(ready.response.status!==202)throw new Error('MCP initialized notification was not accepted');
  const advertisedTools=[];let cursor=null;
  for(let page=0;page<20;page++){
    const tools=await post('/mcp',{jsonrpc:'2.0',id:2+page,method:'tools/list',params:cursor?{cursor}:{}},sessionHeaders);
    advertisedTools.push(...(tools.body.result?.tools??[]));
    const next=tools.body.result?.nextCursor;
    if(!next)break;
    if(next===cursor)throw new Error('MCP tools/list cursor did not advance');
    cursor=next;
  }
  if(advertisedTools.length<20||new Set(advertisedTools.map((tool)=>tool.name)).size!==advertisedTools.length)throw new Error('MCP tools/list returned an incomplete or duplicate surface');

  const created=await post('/mcp',{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'forge_project_create',arguments:{name:'Smoke Project',domain:'automation',assurance:'A1'}}},sessionHeaders);
  const projectId=created.body.result?.structuredContent?.project?.id;
  if(!projectId)throw new Error('MCP project creation failed');

  const card=await fetch(`${base}/.well-known/agent-card.json`,{headers:{origin:base}}).then((response)=>response.json());
  if(card.name!=='ForgeOS'||card.supportedInterfaces?.[0]?.protocolVersion!==PRODUCT.protocolTargets.a2a)throw new Error('A2A discovery failed');
  if(card.supportedInterfaces?.[0]?.url!==`${base}/a2a`)throw new Error('A2A Agent Card advertised the wrong public URL');

  const task=await post('/a2a',{jsonrpc:'2.0',id:4,method:'SendMessage',params:{message:{messageId:'message-smoke',role:'ROLE_USER',parts:[{data:{action:'project.get',input:{projectId}},mediaType:'application/json'}]}}},{'a2a-version':PRODUCT.protocolTargets.a2a});
  if(task.body.result?.task?.status?.state!=='TASK_STATE_COMPLETED')throw new Error('A2A task did not complete');
  const taskId=task.body.result.task.id;
  const fetched=await post('/a2a',{jsonrpc:'2.0',id:5,method:'GetTask',params:{id:taskId,historyLength:10}},{'a2a-version':PRODUCT.protocolTargets.a2a});
  if(fetched.body.result?.id!==taskId||fetched.body.result?.artifacts?.[0]?.parts?.[0]?.data?.project?.id!==projectId)throw new Error('A2A persisted task evidence is incomplete');

  const dashboardResponse=await fetch(`${base}/dashboard`);
  const dashboard=await dashboardResponse.text();
  if(!dashboardResponse.ok||!dashboard.includes('ForgeOS Studio')||!dashboard.includes('Smoke Project'))throw new Error('Forge Studio dashboard failed');

  const terminated=await fetch(`${base}/mcp`,{method:'DELETE',headers:{origin:base,'mcp-session-id':sessionId,'mcp-protocol-version':PRODUCT.protocolTargets.mcp}});
  if(terminated.status!==204)throw new Error('MCP session termination failed');

  console.log(JSON.stringify({status:'pass',version:PRODUCT.version,health:health.status,mcp:{protocol:initialized.body.result.protocolVersion,sessionLifecycle:true,toolCount:advertisedTools.length},projectId,a2a:{protocol:card.supportedInterfaces[0].protocolVersion,taskId,state:fetched.body.result.status.state,persisted:true},dashboard:true},null,2));
}finally{
  await new Promise((resolve)=>server.close(resolve));
  await rm(root,{recursive:true,force:true});
}
