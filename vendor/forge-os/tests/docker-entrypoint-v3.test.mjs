import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';

test('Docker entrypoint creates an authenticated ephemeral development key instead of exposing an insecure server', async () => {
  const child=spawn(process.execPath,['scripts/docker-entrypoint.mjs'],{env:{...process.env,FORGEOS_DRY_RUN:'1',FORGEOS_API_KEY:''},stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
  const [code]=await once(child,'exit');
  assert.equal(code,0,stderr);
  const result=JSON.parse(stdout);
  assert.equal(result.host,'0.0.0.0');
  assert.ok(result.apiKey.length>=43);
  assert.equal(result.generated,true);
});

test('Dockerfile uses the guarded entrypoint and env example matches runtime origin name', async()=>{
  const docker=await readFile('Dockerfile','utf8');
  const env=await readFile('.env.example','utf8');
  assert.match(docker,/scripts\/docker-entrypoint\.mjs/);
  assert.match(env,/FORGEOS_ALLOWED_ORIGINS=/);
  assert.doesNotMatch(env,/FORGEOS_ALLOW_ORIGIN=/);
});
