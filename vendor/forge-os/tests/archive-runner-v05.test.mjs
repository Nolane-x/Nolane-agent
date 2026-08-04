import test from 'node:test';
import assert from 'node:assert/strict';
import {runAcceptanceCommand} from '../scripts/archive-acceptance.mjs';

test('archive runner captures nested command output through files and exits cleanly',async()=>{
  const result=await runAcceptanceCommand(process.execPath,['-e','console.log("nested-ok")'],process.cwd(),{},{timeoutMs:2_000});
  assert.equal(result.code,0);
  assert.equal(result.timedOut,false);
  assert.match(result.stdout,/nested-ok/);
});

test('archive runner terminates a command that exceeds its per-step deadline',async()=>{
  const result=await runAcceptanceCommand(process.execPath,['-e','setInterval(()=>{},1000)'],process.cwd(),{},{timeoutMs:75});
  assert.equal(result.code,124);
  assert.equal(result.timedOut,true);
  assert.equal(result.signal,'TIMEOUT');
});
