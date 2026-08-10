import test from 'node:test';
import assert from 'node:assert/strict';
import {runReleaseCli} from '../scripts/release-verify.mjs';

test('release verifier CLI exits zero immediately after a completed verified run', async()=>{
  const exits=[];
  await runReleaseCli({verify:async()=>({status:'pass'}),exit:(code)=>exits.push(code)});
  assert.deepEqual(exits,[0]);
});

test('release verifier CLI exits non-zero and exposes only the public error message on failure', async()=>{
  const exits=[];const errors=[];
  await runReleaseCli({verify:async()=>{throw new Error('verification failed');},exit:(code)=>exits.push(code),logError:(message)=>errors.push(message)});
  assert.deepEqual(exits,[1]);
  assert.deepEqual(errors,['verification failed']);
});
