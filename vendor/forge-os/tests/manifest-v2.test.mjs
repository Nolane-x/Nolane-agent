import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildProjectManifest } from '../scripts/generate-manifest.mjs';

const packageVersion=JSON.parse(await readFile('package.json','utf8')).version;

test('workspace manifest derives version and uses evidence-specific statuses instead of blanket verified claims',async()=>{
  const manifest=await buildProjectManifest({includeUntracked:true});
  assert.equal(manifest.schemaVersion,2);
  assert.equal(manifest.version,packageVersion);
  assert.ok(manifest.source.commit);
  assert.ok(manifest.files.length>600);
  assert.equal(manifest.files.every((item)=>item.status==='verified'),false);
  assert.ok(manifest.files.some((item)=>item.status==='tested'));
  assert.ok(manifest.files.some((item)=>item.status==='validated'));
  assert.ok(manifest.files.some((item)=>item.status==='linted'));
  assert.ok(manifest.files.every((item)=>/^[a-f0-9]{64}$/.test(item.sha256)||item.relativePath==='project-manifest.json'));
});


test('workspace manifest can be rebuilt from a source archive without a Git directory',async()=>{
  const manifest=await buildProjectManifest({includeUntracked:true,useGit:false});
  assert.equal(manifest.version,packageVersion);
  assert.ok(manifest.files.length>600);
  assert.ok(manifest.source.commit);
  assert.equal(manifest.source.vcs,'archive');
  assert.equal(manifest.source.dirty,null);
});
