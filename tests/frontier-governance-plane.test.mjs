import test from 'node:test';
import assert from 'node:assert/strict';
import { FrontierGovernancePlane } from '../src/runtime/frontier-governance-plane.mjs';

const H=(c)=>c.repeat(64);

test('frontier governance plane lazily loads only invoked services and keeps snapshots private', async () => {
  const plane = new FrontierGovernancePlane({ selfHealing:{ adapter:{ resetToBaseline:async()=>({status:'clean',receiptSha256:H('1')}), createWorktree:async()=>({status:'created',worktreeId:'wt',receiptSha256:H('2')}) } }, clock:()=>1_000 });
  const before=plane.snapshot();
  assert.deepEqual(before.lifecycle,{closed:false,workspaceLoaded:false,plannerLoaded:false,commitChainLoaded:false,sentinelLoaded:false,survivalLoaded:false,selfHealingLoaded:false,lineageLoaded:false,constitutionLoaded:false});
  plane.registerRepository({repositoryId:'backend',version:'1.0.0',fingerprintSha256:H('3'),owner:'platform',role:'backend'});
  assert.equal(plane.snapshot().lifecycle.workspaceLoaded,true);
  assert.equal(plane.snapshot().lifecycle.constitutionLoaded,false);
  const json=JSON.stringify(plane.snapshot());
  assert.equal(json.includes('resetToBaseline'),false);
  assert.equal(json.includes('createWorktree'),false);
  assert.equal(plane.snapshot().claims.autonomousMergeAllowed,false);
  plane.close();
  assert.equal(plane.snapshot().lifecycle.closed,true);
});
