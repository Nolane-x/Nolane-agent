import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProjectStore } from '../src/core/project-store.mjs';
import { ForgeOrchestrator } from '../src/core/orchestrator.mjs';
import { createPrincipal } from '../src/core/principals.mjs';
import { BlobStore } from '../src/storage/blob-store.mjs';
import { CommandEvidenceProvider, EvidenceProviderRegistry } from '../src/evidence/providers.mjs';
import { evidenceAppliesTo } from '../src/core/proof.mjs';

const worker=createPrincipal({id:'agent:worker',type:'agent',roles:['worker'],trustDomain:'team:build'});
const security=createPrincipal({id:'human:security',type:'human',roles:['security-reviewer'],scopes:['*'],trustDomain:'team:security'});

async function fixture(t){
  const root=await mkdtemp(path.join(os.tmpdir(),'forge-trusted-evidence-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const registry=new EvidenceProviderRegistry({blobStore:new BlobStore(path.join(root,'.blobs'))});
  registry.register(new CommandEvidenceProvider({id:'local-command',version:'1.0.0',recipes:{
    pass:{evidenceTypes:['feature-test','finding-resolution','artifact-verification'],command:[process.execPath,'-e','process.stdout.write("verified payload\\n")']},
    fail:{evidenceTypes:['feature-test'],command:[process.execPath,'-e','process.stderr.write("failure\\n");process.exit(7)']},
  }}));
  const store=new ProjectStore(path.join(root,'projects'));
  const forge=new ForgeOrchestrator(store,{evidenceProviders:registry});
  const project=await forge.createProject({name:'Trusted evidence'});
  return {root,store,forge,project,registry};
}

test('caller cannot submit a passing evidence record or choose its digest',async(t)=>{
  const {forge,project}=await fixture(t);
  assert.throws(()=>forge.addEvidence(project.id,{type:'feature-test',title:'forged',status:'pass',summary:'fake',sha256:'a'.repeat(64),method:{kind:'command'}},{principal:worker}),/trusted provider|requestEvidence/i);
  const state=await forge.addEvidence(project.id,{type:'research-note',title:'unverified note',status:'unverified',summary:'A note is not proof.'},{principal:worker});
  assert.equal(state.evidence.at(-1).status,'unverified');
});

test('trusted command provider derives status and content digest from actual execution',async(t)=>{
  const {forge,project,registry}=await fixture(t);
  const state=await forge.requestEvidence(project.id,{providerId:'local-command',recipeId:'pass',type:'feature-test',title:'Feature tests',subject:{}},{principal:worker});
  const receipt=state.evidence.at(-1);
  assert.equal(receipt.status,'pass');
  assert.equal(receipt.producer.type,'service');
  assert.equal(receipt.producer.trustDomain,'evidence-provider:local-command');
  assert.equal(receipt.method.providerId,'local-command');
  assert.equal(receipt.receipt.trusted,true);
  assert.match(receipt.sha256,/^[a-f0-9]{64}$/);
  assert.equal(await registry.blobStore.verify(receipt.sha256),true);
  assert.equal(evidenceAppliesTo(receipt,state),true);
  const failed=await forge.requestEvidence(project.id,{providerId:'local-command',recipeId:'fail',type:'feature-test',title:'Failing tests',subject:{}},{principal:worker});
  assert.equal(failed.evidence.at(-1).status,'fail');
});

test('provider authorization rejects an evidence type outside its allowlist',async(t)=>{
  const {forge,project}=await fixture(t);
  await assert.rejects(()=>forge.requestEvidence(project.id,{providerId:'local-command',recipeId:'pass',type:'signed-provenance',title:'Not allowed',subject:{}},{principal:worker}),/not authorized|evidence type/i);
});

test('critical finding requires trusted proof and independent authorized closer',async(t)=>{
  const {forge,project}=await fixture(t);
  let state=await forge.addFinding(project.id,{title:'Critical isolation break',category:'security',severity:'critical',description:'Cross tenant access'},{principal:worker});
  const finding=state.findings.at(-1);
  state=await forge.requestEvidence(project.id,{providerId:'local-command',recipeId:'pass',type:'finding-resolution',title:'Isolation regression',subject:{findingId:finding.id}},{principal:worker});
  const evidenceId=state.evidence.at(-1).id;
  await assert.rejects(()=>forge.closeFinding(project.id,finding.id,{resolution:'self closed',evidence:[evidenceId]},{principal:worker}),/security-reviewer|independent/i);
  const closed=await forge.closeFinding(project.id,finding.id,{resolution:'independent verification completed',evidence:[evidenceId]},{principal:security});
  assert.equal(closed.findings.at(-1).status,'closed');
});


function pidExists(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === 'EPERM'; }
}
async function waitForProcessExit(pid, timeoutMs = 1500) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!pidExists(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return !pidExists(pid);
}

test('trusted command provider reaps descendant processes after a successful recipe', { skip: process.platform === 'win32' }, async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-evidence-descendant-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const pidFile = path.join(root, 'child.pid');
  const program = [
    "const {spawn}=require('node:child_process')",
    "const fs=require('node:fs')",
    "const child=spawn(process.execPath,['-e','setTimeout(()=>{},60000)'],{stdio:'ignore'})",
    "fs.writeFileSync(process.argv[1],String(child.pid))",
    "child.unref()",
  ].join(';');
  const provider = new CommandEvidenceProvider({
    id: 'descendant-check',
    recipes: {
      pass: { evidenceTypes: ['feature-test'], command: [process.execPath, '-e', program, pidFile] },
    },
  });
  await provider.execute({ request: { recipeId: 'pass', type: 'feature-test' } });
  const descendantPid = Number((await readFile(pidFile, 'utf8')).trim());
  t.after(() => { try { process.kill(descendantPid, 'SIGKILL'); } catch {} });
  assert.equal(await waitForProcessExit(descendantPid), true, `descendant process ${descendantPid} survived trusted recipe completion`);
});
