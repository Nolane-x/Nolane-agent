import { mkdtemp, readdir, stat, rm, writeFile } from 'node:fs/promises';
import { closeSync, openSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ARCHIVE_ACCEPTANCE_COMMANDS=Object.freeze([
  ['npm',['ci','--ignore-scripts']],
  ['npm',['test']],
  ['npm',['run','lint:syntax']],
  ['npm',['run','lint:json']],
  ['npm',['run','lint:docs']],
  ['npm',['run','lint:skills']],
  ['npm',['run','lint:adapters']],
  ['npm',['run','smoke']],
  ['npm',['run','adapter:tck']],
  ['npm',['run','generate:v06']],
  ['npm',['run','v06:audit']],
  ['npm',['run','skills:v2:audit']],
  ['npm',['run','skills:certification-audit']],
  ['npm',['run','test:mutation-critical']],
  ['npm',['run','router:benchmark']],
  ['npm',['run','context:benchmark']],
  ['npm',['run','federation:eval']],
  ['npm',['run','federation:audit']],
  ['npm',['run','release:verify']],
]);
function processGroupExists(child){
  if(!child.pid)return false;
  if(process.platform==='win32')return child.exitCode===null;
  try{process.kill(-child.pid,0);return true;}catch{return false;}
}
async function terminate(child){
  const signal=(name)=>{try{if(process.platform!=='win32'&&child.pid)process.kill(-child.pid,name);else if(child.exitCode===null)child.kill(name);}catch{}};
  if(!processGroupExists(child))return;
  signal('SIGTERM');
  await new Promise((resolve)=>setTimeout(resolve,100));
  if(processGroupExists(child))signal('SIGKILL');
}
export async function runAcceptanceCommand(command,args,cwd,env,{timeoutMs=300_000}={}){
  const logRoot=await mkdtemp(path.join(tmpdir(),'forgeos-command-'));const stdoutPath=path.join(logRoot,'stdout.log');const stderrPath=path.join(logRoot,'stderr.log');
  const stdoutFd=openSync(stdoutPath,'w');const stderrFd=openSync(stderrPath,'w');
  const childEnv={...process.env,...env};delete childEnv.NODE_TEST_CONTEXT;delete childEnv.NODE_CHANNEL_FD;const child=spawn(command,args,{cwd,env:childEnv,stdio:['ignore',stdoutFd,stderrFd],detached:process.platform!=='win32'});
  let timer;let timedOut=false;
  const completion=new Promise((resolve)=>{child.once('error',(error)=>resolve({code:127,error}));child.once('close',(code,signal)=>resolve({code:code??1,signal}));});
  const timeout=new Promise((resolve)=>{timer=setTimeout(async()=>{timedOut=true;await terminate(child);resolve({code:124,signal:'TIMEOUT'});},timeoutMs);timer.unref?.();});
  let result=await Promise.race([completion,timeout]);clearTimeout(timer);if(timedOut)result={code:124,signal:'TIMEOUT'};await terminate(child);closeSync(stdoutFd);closeSync(stderrFd);
  const stdout=readFileSync(stdoutPath,'utf8');const stderr=readFileSync(stderrPath,'utf8');rmSync(logRoot,{recursive:true,force:true});
  return {command:[command,...args],code:result.code,signal:result.signal??null,timedOut,stdout,stderr:result.error?`${stderr}${result.error.message}`:stderr};
}
async function extractedRoot(directory){const entries=(await readdir(directory,{withFileTypes:true})).filter(e=>e.name!=='.DS_Store');if(entries.length===1&&entries[0].isDirectory())return path.join(directory,entries[0].name);return directory;}
export async function verifyReleaseArchive(archive,{keep=false,commandTimeoutMs=300_000,onProgress=()=>{}}={}){
  const absolute=path.resolve(archive);await stat(absolute);
  const root=await mkdtemp(path.join(tmpdir(),'forgeos-archive-'));
  const extract=absolute.endsWith('.zip')?await runAcceptanceCommand('unzip',['-q',absolute,'-d',root],process.cwd(),{},{}):await runAcceptanceCommand('tar',['-xzf',absolute,'-C',root],process.cwd(),{},{});
  if(extract.code!==0)throw new Error(`Archive extraction failed: ${extract.stderr}`);
  const cwd=await extractedRoot(root);const results=[];
  for(let index=0;index<ARCHIVE_ACCEPTANCE_COMMANDS.length;index++){
    const [command,args]=ARCHIVE_ACCEPTANCE_COMMANDS[index];const label=[command,...args].join(' ');onProgress({phase:'start',index:index+1,total:ARCHIVE_ACCEPTANCE_COMMANDS.length,command:label});
    const started=Date.now();const result=await runAcceptanceCommand(command,args,cwd,{FORGEOS_RELEASE_OUTPUT:path.join(root,'verification')},{timeoutMs:commandTimeoutMs});results.push({...result,durationMs:Date.now()-started});onProgress({phase:'finish',index:index+1,total:ARCHIVE_ACCEPTANCE_COMMANDS.length,command:label,code:result.code,durationMs:Date.now()-started,timedOut:result.timedOut});if(result.code!==0)break;
  }
  const report={archive:absolute,root,cwd,gitDirectoryPresent:await stat(path.join(cwd,'.git')).then(()=>true).catch(()=>false),status:results.length===ARCHIVE_ACCEPTANCE_COMMANDS.length&&results.every(r=>r.code===0)?'pass':'fail',results:results.map(({command,code,signal,timedOut,durationMs,stdout,stderr})=>({command,code,signal,timedOut,durationMs,stdout:stdout.slice(-4000),stderr:stderr.slice(-4000)}))};
  await writeFile(path.join(root,'archive-acceptance.json'),`${JSON.stringify(report,null,2)}\n`);
  if(!keep&&report.status==='pass')await rm(root,{recursive:true,force:true});
  return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const archive=process.argv[2];if(!archive)throw new Error('Usage: node scripts/archive-acceptance.mjs <zip-or-tar.gz>');const report=await verifyReleaseArchive(archive,{keep:process.env.FORGEOS_KEEP_ACCEPTANCE==='1'});console.log(JSON.stringify(report,null,2));if(report.status!=='pass')process.exitCode=1;}
