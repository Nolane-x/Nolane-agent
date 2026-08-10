import {spawn} from 'node:child_process';
import {realpath} from 'node:fs/promises';
import path from 'node:path';
import {canonicalSha256} from '../core/canonical-json.mjs';

const within=(root,candidate)=>candidate===root||candidate.startsWith(`${root}${path.sep}`);
export class BrokeredProcessRunner{
  constructor({workspaceRoot,allowedCommands=[],allowedEnv=[],timeoutMs=30_000,maxOutputBytes=1_000_000}={}){
    if(!workspaceRoot)throw new TypeError('workspaceRoot is required');
    this.workspaceRoot=path.resolve(workspaceRoot);this.allowedCommands=new Set(allowedCommands.map(String));this.allowedEnv=new Set(allowedEnv.map(String));this.timeoutMs=timeoutMs;this.maxOutputBytes=maxOutputBytes;
  }
  async #cwd(relative='.'){
    const lexical=path.resolve(this.workspaceRoot,relative);if(!within(this.workspaceRoot,lexical))throw new Error('Working directory escapes workspace');
    const [rootReal,cwdReal]=await Promise.all([realpath(this.workspaceRoot),realpath(lexical)]);if(!within(rootReal,cwdReal))throw new Error('Working directory escapes workspace through symlink');return cwdReal;
  }
  async run({command,args=[],cwd='.',env={},signal}={}){
    command=String(command??'');if(!this.allowedCommands.has(command))throw new Error(`Command is not allowlisted: ${command}`);
    if(!Array.isArray(args)||args.some(item=>typeof item!=='string'))throw new TypeError('Command args must be strings');
    const resolvedCwd=await this.#cwd(cwd);const safeEnv={PATH:process.env.PATH??''};for(const key of this.allowedEnv)if(Object.hasOwn(env,key))safeEnv[key]=String(env[key]);
    const startedAt=new Date().toISOString();const started=Date.now();let stdout='';let stderr='';let outputBytes=0;let truncated=false;let timedOut=false;
    const child=spawn(command,args,{cwd:resolvedCwd,env:safeEnv,shell:false,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
    const append=(kind,chunk)=>{const text=chunk.toString('utf8');const available=Math.max(0,this.maxOutputBytes-outputBytes);const kept=Buffer.from(text).subarray(0,available).toString('utf8');outputBytes+=Buffer.byteLength(kept);if(Buffer.byteLength(text)>available)truncated=true;if(kind==='stdout')stdout+=kept;else stderr+=kept;};
    child.stdout.on('data',chunk=>append('stdout',chunk));child.stderr.on('data',chunk=>append('stderr',chunk));
    const kill=()=>{try{if(process.platform!=='win32')process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL');}catch{try{child.kill('SIGKILL');}catch{}}};
    const timeout=setTimeout(()=>{timedOut=true;kill();},this.timeoutMs);timeout.unref?.();
    const abort=()=>kill();if(signal?.aborted)abort();else signal?.addEventListener?.('abort',abort,{once:true});
    const result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signalName)=>resolve({code,signalName}));}).finally(()=>{clearTimeout(timeout);signal?.removeEventListener?.('abort',abort);});
    const payload={schemaVersion:1,status:timedOut?'timeout':result.code===0?'pass':'fail',command,args:[...args],cwd:path.relative(this.workspaceRoot,resolvedCwd)||'.',environmentKeys:Object.keys(safeEnv).filter(key=>key!=='PATH').sort(),startedAt,finishedAt:new Date().toISOString(),durationMs:Date.now()-started,exitCode:result.code,signal:result.signalName??null,timedOut,truncated,stdout,stderr,stdoutSha256:canonicalSha256(stdout),stderrSha256:canonicalSha256(stderr)};
    return Object.freeze({...payload,receiptSha256:canonicalSha256(payload)});
  }
}
