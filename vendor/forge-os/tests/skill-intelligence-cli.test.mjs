import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, symlink, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { runCli } from '../src/cli/forge.mjs';

function capture(){let out='';let err='';return{stdout:{write:v=>{out+=v;}},stderr:{write:v=>{err+=v;}},read:()=>({out,err})};}

test('forge doctor reports Skill Intelligence inventory and stable materialization readiness',async()=>{
 const io=capture();const code=await runCli(['doctor','--json'],{cwd:process.cwd(),...io});
 assert.equal(code,0,io.read().err);
 const report=JSON.parse(io.read().out);
 assert.equal(report.status,'pass');
 assert.equal(report.intelligence.techniques,128);
 assert.equal(report.intelligence.l0Techniques,32);
 assert.equal(report.intelligence.stableProceduralProviders,33);
 assert.equal(report.stableMaterialization.failed,0);
});

test('forge init creates a safe local profile without printing the secret value',async()=>{
 const cwd=await mkdtemp(path.join(os.tmpdir(),'forge-cli-init-'));const io=capture();
 const code=await runCli(['init','--json'],{cwd,...io});assert.equal(code,0,io.read().err);
 const result=JSON.parse(io.read().out);const secret=await readFile(path.join(cwd,'.forgeos','api-key'),'utf8');
 assert.ok(secret.trim().length>=40);assert.ok(!io.read().out.includes(secret.trim()));
 if(process.platform!=='win32')assert.equal((await stat(path.join(cwd,'.forgeos','api-key'))).mode&0o777,0o600);
 assert.equal(result.profile,'local');
});

test('forge skills search and inspect use v2 metadata without loading every body',async()=>{
 let io=capture();let code=await runCli(['skills','search','api contract','--json'],{cwd:process.cwd(),...io});assert.equal(code,0,io.read().err);
 const results=JSON.parse(io.read().out).results;assert.ok(results.some((item)=>item.id==='designing-api-contracts'));
 io=capture();code=await runCli(['skills','inspect','resolving-user-intent','--json'],{cwd:process.cwd(),...io});assert.equal(code,0,io.read().err);
 const skill=JSON.parse(io.read().out).skill;assert.equal(skill.kernelLevel,'L0');assert.equal(Object.hasOwn(skill,'body'),false);
});

test('forge route returns the same explainable RoutePlan as MCP',async()=>{
 const io=capture();const code=await runCli(['route','--query','Design a versioned API contract for a public SDK','--domain','api-integration','--tool','api-client','--json'],{cwd:process.cwd(),...io});
 assert.equal(code,0,io.read().err);const plan=JSON.parse(io.read().out).routePlan;
 assert.equal(plan.steps[0].techniqueId,'technique.designing-api-contracts');
 assert.ok(plan.exclusions.length>0);
});

test('forge sandbox status reports unavailable instead of claiming a local microVM',async()=>{
 const io=capture();const code=await runCli(['sandbox','status','--json'],{cwd:process.cwd(),...io});
 assert.equal(code,2,io.read().err);
 const result=JSON.parse(io.read().out);
 assert.equal(result.sandbox.state,'unavailable');
});


test('npm-style bin target executes the Forge CLI entry point on the current platform',async(t)=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'forge-cli-symlink-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const bin=path.join(root,'forge');const target=fileURLToPath(new URL('../src/cli/forge.mjs',import.meta.url));
 await symlink(target,bin);
 const command=process.platform==='win32'?process.execPath:bin;const args=process.platform==='win32'?[bin,'doctor']:['doctor'];
 const result=await new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd:process.cwd(),stdio:['ignore','pipe','pipe']});let out='',err='';child.stdout.on('data',chunk=>out+=chunk);child.stderr.on('data',chunk=>err+=chunk);child.once('error',reject);child.on('close',code=>resolve({code,out,err}));});
 assert.equal(result.code,0,result.err);assert.match(result.out,/"status": "pass"/);assert.match(result.out,/"techniques": 128/);
});
