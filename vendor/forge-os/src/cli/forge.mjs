#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SkillIntelligenceService } from '../intelligence/service.mjs';
import { V06RuntimeService } from '../v06/service.mjs';
import { createRemoteMicroVmSandboxFromEnv } from '../execution/remote-microvm-sandbox.mjs';

const PACKAGE_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
function option(argv,name,{multiple=false}={}){const values=[];for(let i=0;i<argv.length;i++)if(argv[i]===name&&argv[i+1]&&!argv[i+1].startsWith('--'))values.push(argv[i+1]);return multiple?values:values.at(-1);}
function has(argv,name){return argv.includes(name);}
function print(io,value,json=true){io.stdout.write(json?`${JSON.stringify(value,null,2)}\n`:`${String(value)}\n`);}
function error(io,message){io.stderr.write(`${message}\n`);return 1;}
export async function runCli(argv,{cwd=process.cwd(),stdout=process.stdout,stderr=process.stderr,sourceRoot=PACKAGE_ROOT}={}){
 const io={stdout,stderr};const json=has(argv,'--json');const [command,subcommand]=argv;
 try{
  if(command==='init'){
   const root=path.join(cwd,'.forgeos');await mkdir(root,{recursive:true,mode:0o700});const secret=randomBytes(36).toString('base64url');
   await writeFile(path.join(root,'api-key'),`${secret}\n`,{mode:0o600});await writeFile(path.join(root,'config.json'),`${JSON.stringify({schemaVersion:1,profile:'local',storage:'sqlite-wal',dataDir:'.forgeos/data',apiKeyFile:'.forgeos/api-key',createdAt:new Date().toISOString()},null,2)}\n`,{mode:0o600});
   print(io,{status:'initialized',profile:'local',configPath:path.join(root,'config.json'),apiKeyPath:path.join(root,'api-key'),secretPrinted:false},true);return 0;
  }
  const service=new SkillIntelligenceService({root:sourceRoot});
  const v06=new V06RuntimeService({root:sourceRoot});
  if(command==='sandbox'&&subcommand==='status'){
   const sandbox=await createRemoteMicroVmSandboxFromEnv().probe();
   print(io,{sandbox},true);return sandbox.state==='ready'?0:sandbox.state==='unavailable'?2:1;
  }
  if(command==='v06'&&subcommand==='status'){print(io,{status:await v06.status()},true);return 0;}
  if(command==='profile'&&subcommand==='plan'){
   const profile=argv[2];const target=option(argv,'--target')??'generic';if(!profile||profile.startsWith('--'))return error(io,'profile plan requires a profile');print(io,{plan:v06.compileHarnessProfile({profile,target,capabilities:{mcp:!has(argv,'--no-mcp'),hooks:has(argv,'--hooks')}})},true);return 0;
  }
  if(command==='security'&&subcommand==='scan'){
   const file=option(argv,'--file');if(!file)return error(io,'security scan requires --file');const {readFile}=await import('node:fs/promises');const surface=JSON.parse(await readFile(path.resolve(cwd,file),'utf8'));const report=v06.scanAgentSurface(surface);print(io,{report},true);return report.status==='blocked'?2:0;
  }
  if(command==='doctor'){
   const intelligence=await service.status();const stableMaterialization=await service.auditStableMaterialization();const nodeMajor=Number(process.versions.node.split('.')[0]);const report={status:nodeMajor>=22&&stableMaterialization.failed===0?'pass':'fail',node:{version:process.versions.node,supported:nodeMajor>=22},intelligence:{outcomes:intelligence.outcomeCount,techniques:intelligence.techniqueCount,l0Techniques:intelligence.l0TechniqueCount,evaluators:intelligence.evaluatorCount,providers:intelligence.providerCount,stableProceduralProviders:intelligence.stableProceduralProviders,candidateProceduralProviders:intelligence.candidateProceduralProviders,graphSha256:intelligence.graphSha256},stableMaterialization};print(io,report,true);return report.status==='pass'?0:1;
  }
  if(command==='skills'&&subcommand==='search'){
   const query=argv.slice(2).filter((value)=>!value.startsWith('--')&&value!==option(argv,'--limit')).join(' ').trim();if(!query)return error(io,'skills search requires a query');const results=await service.search(query,{limit:Number(option(argv,'--limit')??20)});print(io,{query,results},true);return 0;
  }
  if(command==='skills'&&subcommand==='inspect'){
   const skillId=argv[2];if(!skillId||skillId.startsWith('--'))return error(io,'skills inspect requires a skill ID');print(io,{skill:await service.inspect(skillId)},true);return 0;
  }
  if(command==='route'){
   const query=option(argv,'--query');if(!query)return error(io,'route requires --query');const routePlan=await service.route({query,domains:option(argv,'--domain',{multiple:true}),tools:option(argv,'--tool',{multiple:true}),model:option(argv,'--model')??'gpt-5.6',assurance:option(argv,'--assurance')??'A1',operation:option(argv,'--operation')??'planning',taskClass:option(argv,'--task-class')??'generic'});print(io,{routePlan},true);return routePlan.blockers.length?2:0;
  }
  print(io,{name:'ForgeOS CLI',commands:['init','doctor','sandbox status','v06 status','profile plan <profile> --target <host>','security scan --file <surface.json>','skills search <query>','skills inspect <id>','route --query <text>']},true);return command?1:0;
 }catch(cause){return error(io,cause?.message??String(cause));}
}
function isDirectEntry(argvPath){if(!argvPath)return false;try{return realpathSync(argvPath)===realpathSync(fileURLToPath(import.meta.url));}catch{return path.resolve(argvPath)===fileURLToPath(import.meta.url);}}
if(isDirectEntry(process.argv[1]))process.exitCode=await runCli(process.argv.slice(2));
