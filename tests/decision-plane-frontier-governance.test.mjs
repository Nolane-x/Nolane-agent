import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DecisionPlane } from '../src/decision/decision-plane.mjs';

const H=(c)=>c.repeat(64);

test('DecisionPlane integrates frontier governance lazily without direct app imports', async () => {
  const plane=new DecisionPlane({frontierGovernance:{clock:()=>1000,selfHealing:{adapter:{resetToBaseline:async()=>({status:'clean',receiptSha256:H('1')}),createWorktree:async()=>({status:'created',worktreeId:'wt',receiptSha256:H('2')})}}}});
  assert.equal(plane.snapshot().lifecycle.frontierGovernanceLoaded,false);
  plane.registerFrontierRepository({repositoryId:'backend',version:'1.0.0',fingerprintSha256:H('3'),owner:'platform',role:'backend'});
  assert.equal(plane.snapshot().lifecycle.frontierGovernanceLoaded,true);
  assert.equal(plane.frontierGovernanceSnapshot().lifecycle.workspaceLoaded,true);
  const app=await readFile(new URL('../src/app.mjs',import.meta.url),'utf8');
  assert.equal(/frontier-governance-plane|cross-repository-workspace-map|self-improvement-constitution/.test(app),false);
  const snapshot=plane.snapshot();
  assert.equal(snapshot.frontierGovernance.claims.productionPolicyPromotionAllowed,false);
  assert.equal(snapshot.claims.frontierSuperiorityClaimAllowed,false);
  plane.close();
});
