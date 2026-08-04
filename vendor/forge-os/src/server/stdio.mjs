import { createInterface } from 'node:readline';
import path from 'node:path';
import { ProjectStore } from '../core/project-store.mjs';
import { ForgeOrchestrator } from '../core/orchestrator.mjs';
import { createPrincipal } from '../core/principals.mjs';
import { createMcpSession, handleMcpRpc } from './mcp.mjs';
import { SkillIntelligenceService } from '../intelligence/service.mjs';
import { V06RuntimeService } from '../v06/service.mjs';

const dataDir=process.env.FORGEOS_DATA_DIR??path.resolve('.forgeos-data');
const forge=new ForgeOrchestrator(new ProjectStore(dataDir));
const principal=createPrincipal({id:process.env.FORGEOS_STDIO_PRINCIPAL??'service:stdio',type:'service',roles:['stdio-host'],scopes:['*']});
const session=createMcpSession();
const intelligence=new SkillIntelligenceService();
const v06=new V06RuntimeService();
const input=createInterface({input:process.stdin,crlfDelay:Infinity,terminal:false});

for await (const line of input) {
  if(!line.trim())continue;
  let request;
  try{request=JSON.parse(line);}catch{
    process.stdout.write(`${JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}})}\n`);
    continue;
  }
  const result=await handleMcpRpc(request,{forge,intelligence,v06,principal,session,baseUrl:'stdio://forge-os',logger:(event)=>process.stderr.write(`${JSON.stringify(event)}\n`)});
  if(result!==null)process.stdout.write(`${JSON.stringify(result)}\n`);
}
