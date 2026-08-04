import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectStore } from '../src/core/project-store.mjs';
import { ForgeOrchestrator } from '../src/core/orchestrator.mjs';
import { createPrincipal } from '../src/core/principals.mjs';
import { callForgeTool } from '../src/server/tool-registry.mjs';

const owner=createPrincipal({id:'human:recovery-owner',type:'human',roles:['owner'],scopes:['*'],trustDomain:'org:recovery'});
const outsider=createPrincipal({id:'agent:recovery-outsider',type:'agent',roles:['worker'],scopes:['*'],trustDomain:'org:other'});

test('snapshot list, verification, and restore are public, checksum-bound, approval-gated operations', async (t) => {
  const root=await mkdtemp(path.join(tmpdir(),'forge-recovery-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const forge=new ForgeOrchestrator(new ProjectStore(root));
  let {project}=await callForgeTool('forge_project_create',{name:'Before',domain:'saas',assurance:'A1'},forge,{principal:owner});
  await callForgeTool('forge_intent_record',{projectId:project.id,intent:{goal:'Restore safely',audience:'Operators',success:['State can be recovered'],confirmed:true}},forge,{principal:owner});
  const snapshots=await callForgeTool('forge_snapshot_list',{projectId:project.id},forge,{principal:owner});
  assert.ok(snapshots.snapshots.length>=1);
  const target=snapshots.snapshots[0];
  const verified=await callForgeTool('forge_snapshot_verify',{projectId:project.id,revision:target.revision},forge,{principal:owner});
  assert.equal(verified.snapshot.valid,true);

  const approval=await callForgeTool('forge_approval_request',{projectId:project.id,action:`restore-snapshot:${target.revision}`},forge,{principal:owner});
  const restored=await callForgeTool('forge_project_restore',{projectId:project.id,revision:target.revision,approvalToken:approval.approval.token},forge,{principal:owner});
  assert.equal(restored.project.id,project.id);
  assert.equal(restored.project.access.ownerPrincipalId,owner.id);
  assert.ok(restored.project.history.some((entry)=>entry.type==='snapshot-restored'));
  await assert.rejects(()=>callForgeTool('forge_snapshot_list',{projectId:project.id},forge,{principal:outsider}),/Project access denied/);
});
