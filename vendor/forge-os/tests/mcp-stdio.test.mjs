import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

function readLines(stream) {
  let buffer=''; const queue=[]; const waiters=[];
  stream.setEncoding('utf8');
  stream.on('data',(chunk)=>{buffer+=chunk;let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);if(!line)continue;const value=JSON.parse(line);const waiter=waiters.shift();if(waiter)waiter(value);else queue.push(value);}});
  return ()=>queue.length?Promise.resolve(queue.shift()):new Promise((resolve)=>waiters.push(resolve));
}

test('stdio MCP bridge speaks newline-delimited JSON-RPC and no other stdout', async (t) => {
  const dir=await mkdtemp(path.join(tmpdir(),'forge-stdio-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const child=spawn(process.execPath,['src/server/stdio.mjs'],{cwd:process.cwd(),env:{...process.env,FORGEOS_DATA_DIR:dir},stdio:['pipe','pipe','pipe']});
  t.after(()=>child.kill('SIGTERM'));
  const next=readLines(child.stdout);
  const initialize={jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'stdio-test',version:'1'}}};
  child.stdin.write(`${JSON.stringify(initialize)}\n`);
  assert.equal((await next()).result.protocolVersion,'2025-11-25');
  child.stdin.write(`${JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})}\n`);
  child.stdin.write(`${JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list',params:{}})}\n`);
  const tools=await next();
  assert.ok(tools.result.tools.length>=20);
});
