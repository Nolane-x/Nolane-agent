import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

import { resolveSourceReconstructionPlan } from '../src/release/source-reconstruction.mjs';

async function write(root, relative, value) { const file=path.join(root,relative); await mkdir(path.dirname(file),{recursive:true}); await writeFile(file,value); }

test('source reconstruction requires Nolane-owned runtime metadata and a source artifact', async (t) => {
  const root=await mkdtemp(path.join(os.tmpdir(),'nolane-reconstruct-beta1-')); t.after(()=>rm(root,{recursive:true,force:true}));
  await write(root,'config/release-identity.json',JSON.stringify({schema:'nolane.agent.release-identity.v1',product:'Nolane Agent',version:'5.0.0-beta.1',channel:'beta',artifactPrefix:'NolaneAgent',vscodeArtifactPrefix:'NolaneAgent-VSCode'}));
  await write(root,'release/NolaneAgent-5.0.0-beta.1-source.zip','zip');
  await write(root,'release/release-manifest-5.0.0-beta.1.json',JSON.stringify({schema:'nolane.agent.release-manifest.v1',version:'5.0.0-beta.1',components:{},runtimeOwnership:{product:'Nolane Agent',runtime:'nolane-native',externalRuntimeBundled:false,externalExecutablePaths:0},artifacts:[{fileName:'NolaneAgent-5.0.0-beta.1-source.zip',sha256:createHash('sha256').update('zip').digest('hex'),bytes:3}]}));
  const plan=await resolveSourceReconstructionPlan({rootDirectory:root,version:'5.0.0-beta.1'});
  assert.equal(plan.runtimeOwnership.externalRuntimeBundled,false);
  assert.equal(plan.runtimeOwnership.runtime,'nolane-native');
  assert.equal(plan.runtimePurityVerified,true);
  assert.equal(plan.sourceArtifact,'NolaneAgent-5.0.0-beta.1-source.zip');
});

test('source reconstruction rejects manifests that bundle an external runtime', async (t) => {
  const root=await mkdtemp(path.join(os.tmpdir(),'nolane-reconstruct-nolane_native-')); t.after(()=>rm(root,{recursive:true,force:true}));
  await write(root,'config/release-identity.json',JSON.stringify({schema:'nolane.agent.release-identity.v1',product:'Nolane Agent',version:'5.0.0-beta.1',channel:'beta',artifactPrefix:'NolaneAgent',vscodeArtifactPrefix:'NolaneAgent-VSCode'}));
  await write(root,'release/release-manifest-5.0.0-beta.1.json',JSON.stringify({schema:'nolane.agent.release-manifest.v1',version:'5.0.0-beta.1',components:{externalRuntime:{}},runtimeOwnership:{product:'Nolane Agent',runtime:'nolane-native',externalRuntimeBundled:true,externalExecutablePaths:1},artifacts:[]}));
  await assert.rejects(()=>resolveSourceReconstructionPlan({rootDirectory:root,version:'5.0.0-beta.1'}),/runtime ownership must be verified/i);
});
