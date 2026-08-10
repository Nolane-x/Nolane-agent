import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

function run(args,{env}={}){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{env:{...process.env,...env},stdio:['ignore','pipe','pipe']});let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);child.on('error',reject);child.on('exit',code=>resolve({code,out,err}));});}

test('Docker entrypoint accepts API key from a mounted secret file without printing it',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'forge-secret-'));const file=path.join(root,'api-key');await writeFile(file,'mounted-secret-value\n',{mode:0o600});
  const result=await run(['scripts/docker-entrypoint.mjs'],{env:{FORGEOS_DRY_RUN:'1',FORGEOS_API_KEY:'',FORGEOS_API_KEY_FILE:file}});
  assert.equal(result.code,0,result.err);const config=JSON.parse(result.out);assert.equal(config.apiKey,'mounted-secret-value');assert.equal(config.generated,false);assert.doesNotMatch(result.err,/mounted-secret-value/);
});

test('production Compose and Kubernetes manifests are fail-closed single-node deployments',async()=>{
  const compose=await readFile('deploy/docker-compose.production.yml','utf8');
  for(const pattern of [/FORGEOS_STORAGE_BACKEND:\s*sqlite/,/FORGEOS_API_KEY_FILE/,/read_only:\s*true/,/no-new-privileges:true/,/healthcheck:/,/forgeos-data:/])assert.match(compose,pattern);
  const stateful=await readFile('deploy/kubernetes/forgeos-statefulset.yaml','utf8');
  for(const pattern of [/kind: StatefulSet/,/replicas:\s*1/,/runAsNonRoot:\s*true/,/readOnlyRootFilesystem:\s*true/,/readinessProbe:/,/livenessProbe:/,/volumeClaimTemplates:/,/FORGEOS_STORAGE_BACKEND/])assert.match(stateful,pattern);
  const network=await readFile('deploy/kubernetes/forgeos-network-policy.yaml','utf8');assert.match(network,/kind: NetworkPolicy/);assert.match(network,/policyTypes:[\s\S]*Ingress[\s\S]*Egress/);
  const docs=await readFile('deploy/PRODUCTION.md','utf8');assert.match(docs,/single-node/i);assert.match(docs,/PostgreSQL[\s\S]*not a drop-in/i);
});
