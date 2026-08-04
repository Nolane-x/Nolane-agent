import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {BrokeredProcessRunner} from '../src/execution/brokered-process-runner.mjs';

test('brokered runner executes allowlisted argv without shell and emits bounded receipt',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'forge-runner-'));
 const runner=new BrokeredProcessRunner({workspaceRoot:root,allowedCommands:[process.execPath],allowedEnv:['SAFE_VALUE'],maxOutputBytes:1024,timeoutMs:2000});
 const result=await runner.run({command:process.execPath,args:['-e','process.stdout.write(process.env.SAFE_VALUE)'],env:{SAFE_VALUE:'ok',SECRET:'hidden'},cwd:'.'});
 assert.equal(result.status,'pass');
 assert.equal(result.stdout,'ok');
 assert.equal(result.environmentKeys.includes('SECRET'),false);
 assert.match(result.receiptSha256,/^[a-f0-9]{64}$/);
});

test('brokered runner rejects command, cwd escape, and symlink escape before spawn',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'forge-runner-'));
 const outside=await mkdtemp(path.join(os.tmpdir(),'forge-outside-'));
 const runner=new BrokeredProcessRunner({workspaceRoot:root,allowedCommands:[process.execPath]});
 await assert.rejects(()=>runner.run({command:'/bin/sh',args:['-c','echo pwned']}),/not allowlisted/i);
 await assert.rejects(()=>runner.run({command:process.execPath,args:['-e','0'],cwd:'../'}),/escapes workspace/i);
 await writeFile(path.join(outside,'x'),'x');
 await mkdir(path.join(root,'nested'));
 await import('node:fs/promises').then(({symlink})=>symlink(outside,path.join(root,'nested','link'),'dir'));
 await assert.rejects(()=>runner.run({command:process.execPath,args:['-e','0'],cwd:'nested/link'}),/escapes workspace/i);
});

test('brokered runner terminates timed out process and records failure receipt',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'forge-runner-'));
 const runner=new BrokeredProcessRunner({workspaceRoot:root,allowedCommands:[process.execPath],timeoutMs:80,maxOutputBytes:1024});
 const result=await runner.run({command:process.execPath,args:['-e','setInterval(()=>{},1000)']});
 assert.equal(result.status,'timeout');
 assert.equal(result.timedOut,true);
 assert.match(result.receiptSha256,/^[a-f0-9]{64}$/);
});
