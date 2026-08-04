import test from 'node:test';
import assert from 'node:assert/strict';
import { runGate } from '../src/core/gates.mjs';
import { trustedEvidenceRecord } from './helpers/trusted-evidence.mjs';

const artifact=(type,state='draft',slot='default')=>({id:`${type}-${slot}`,type,state,slot});
const project=(overrides={})=>({id:'forge_policy',revision:8,semanticRevision:8,stage:'product-definition',assurance:'A1',intent:null,brief:null,research:[],ideas:[],scores:[],selectedIdeaId:null,selectionReason:null,decisions:[],artifacts:[artifact('product-thesis'),artifact('capability-map')],evidence:[],findings:[],risks:[],...overrides});

test('A0 may use draft product artifacts while A1 requires independent review state',()=>{
  assert.equal(runGate(project({assurance:'A0'})).status,'pass');
  assert.equal(runGate(project({assurance:'A1'})).status,'fail');
  assert.equal(runGate(project({assurance:'A1',artifacts:[artifact('product-thesis','review'),artifact('capability-map','review')]})).status,'pass');
});

test('A2 requires verified architecture and planning artifacts',()=>{
  const architecture=project({stage:'architecture',assurance:'A2',artifacts:[artifact('architecture-decision','review'),artifact('threat-model','review')]});
  assert.equal(runGate(architecture).status,'fail');
  architecture.artifacts=architecture.artifacts.map((item)=>({...item,state:'verified'}));
  assert.equal(runGate(architecture).status,'pass');
});

test('A1 verification requires current integration and rollback receipts in addition to baseline proof',()=>{
  const value=project({stage:'verification',assurance:'A1',artifacts:[]});
  value.evidence=['verification-report','security-review','ux-evidence'].map((type)=>trustedEvidenceRecord(type,value));
  assert.equal(runGate(value).status,'fail');
  value.evidence.push(trustedEvidenceRecord('integration-test',value),trustedEvidenceRecord('rollback-proof',value));
  assert.equal(runGate(value).status,'pass');
});

test('gate evaluations remain append-only while the newest fresh result is authoritative',async()=>{
  const { mkdtemp, rm }=await import('node:fs/promises');
  const { tmpdir }=await import('node:os');
  const path=(await import('node:path')).default;
  const { ProjectStore }=await import('../src/core/project-store.mjs');
  const { ForgeOrchestrator }=await import('../src/core/orchestrator.mjs');
  const root=await mkdtemp(path.join(tmpdir(),'forge-gate-history-'));
  try{
    const forge=new ForgeOrchestrator(new ProjectStore(root));
    const created=await forge.createProject({name:'Gate history'});
    await forge.runCurrentGate(created.id);
    await forge.runCurrentGate(created.id);
    const stored=await forge.getProject(created.id);
    assert.equal(stored.gates.length,2);
    assert.notEqual(stored.gates[0].id,stored.gates[1].id);
  }finally{await rm(root,{recursive:true,force:true});}
});
