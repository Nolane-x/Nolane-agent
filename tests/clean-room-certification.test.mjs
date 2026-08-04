import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { certifyPublishedSourceArchive } from '../src/release/clean-room-certification.mjs';

const execFileAsync = promisify(execFile);
const python = process.env.NOLANE_AGENT_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const forbiddenBrand = String.fromCharCode(104, 101, 114, 109, 101, 115);
async function write(root, relative, value) { const file = path.join(root, relative); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, value); return file; }

async function fixture({ includeForbiddenBrand = false } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-clean-room-beta1-'));
  await mkdir(path.join(root, 'scripts'), { recursive: true });
  await write(root, 'scripts/zip-artifacts.py', await (await import('node:fs/promises')).readFile(path.resolve('scripts/zip-artifacts.py')));
  const version = '5.0.0-beta.1';
  const files = new Map([
    ['package.json', Buffer.from(JSON.stringify({ name: 'nolane-agent', productName: 'Nolane Agent', version }))],
    ['package-lock.json', Buffer.from(JSON.stringify({ name: 'nolane-agent', version, lockfileVersion: 3, packages: { '': { name: 'nolane-agent', version } } }))],
    ['config/product-identity.json', Buffer.from(JSON.stringify({ schema: 'nolane.agent.product-identity.v1', product: 'Nolane Agent', packageName: 'nolane-agent', version }))],
    ['src/app.mjs', Buffer.from('export const ok=true;\n')],
    ['THIRD_PARTY_NOTICES.md', Buffer.from('Nolane Native is the only product runtime; neutral clean-room attribution is retained.\n')],
  ]);
  if (includeForbiddenBrand) files.set(`vendor/${forbiddenBrand}-agent/archive.zip`, Buffer.from(`forbidden ${forbiddenBrand} runtime`));
  const manifestFiles = [...files].filter(([relative]) => relative !== 'project-manifest.json').map(([relativePath, content]) => ({ relativePath, version, bytes: content.length, sha256: sha(content) }));
  const manifest = Buffer.from(JSON.stringify({ schema: 'nolane.agent.project-manifest.v1', product: 'Nolane Agent', version, files: manifestFiles }));
  files.set('project-manifest.json', manifest);
  const entries=[];
  for (const [relative, content] of files) { const source=await write(root, `input/${relative}`, content); entries.push({ source, archivePath: `NolaneAgent-${version}-source/${relative}` }); }
  const spec=await write(root,'spec.json',JSON.stringify({entries}));
  const archive=path.join(root,`NolaneAgent-${version}-source.zip`);
  await execFileAsync(python,[path.join(root,'scripts/zip-artifacts.py'),'create',spec,archive]);
  return { root, archive, version };
}

test('clean-room certification verifies a Nolane-owned source archive and its manifest', async (t) => {
  const f=await fixture(); t.after(()=>rm(f.root,{recursive:true,force:true}));
  const report=await certifyPublishedSourceArchive({ archivePath:f.archive, expectedVersion:f.version, probes:[] });
  assert.equal(report.status,'pass');
  assert.equal(report.runtimeOwnership.product,'Nolane Agent');
  assert.equal(report.runtimeOwnership.runtime,'nolane-native');
  assert.equal(report.runtimeOwnership.externalRuntimeBundled,false);
  assert.equal(report.runtimeOwnership.externalExecutablePaths,0);
  assert.match(report.runtimePurityReceiptSha256,/^[a-f0-9]{64}$/);
  assert.match(report.receiptSha256,/^[a-f0-9]{64}$/);
});

test('clean-room certification rejects forbidden external runtime branding inside source archives', async (t) => {
  const f=await fixture({includeForbiddenBrand:true}); t.after(()=>rm(f.root,{recursive:true,force:true}));
  await assert.rejects(()=>certifyPublishedSourceArchive({ archivePath:f.archive, expectedVersion:f.version, probes:[] }),/runtime purity|forbidden-brand/i);
});


test('clean-room certification resumes an interrupted exact-archive node-test cache', async (t) => {
  const f=await fixture(); t.after(()=>rm(f.root,{recursive:true,force:true}));
  const probe={id:'resumable-probe',command:process.execPath,args:[]};
  await assert.rejects(()=>certifyPublishedSourceArchive({
    archivePath:f.archive, expectedVersion:f.version, probes:[probe],
    runCommand:async ({cwd})=>{
      const marker=path.join(cwd,'release','.cache','node-test-suite','resume-marker.json');
      await mkdir(path.dirname(marker),{recursive:true});
      await writeFile(marker,'{"passed":true}\n');
      return {exitCode:1,stdout:'',stderr:'interrupted'};
    },
  }),/resumable-probe/);
  let resumed=false;
  const report=await certifyPublishedSourceArchive({
    archivePath:f.archive, expectedVersion:f.version, probes:[probe],
    runCommand:async ({cwd})=>{
      const marker=path.join(cwd,'release','.cache','node-test-suite','resume-marker.json');
      try { resumed=(await (await import('node:fs/promises')).readFile(marker,'utf8')).includes('passed'); } catch {}
      return {exitCode:resumed?0:1,stdout:'',stderr:''};
    },
  });
  assert.equal(report.status,'pass');
  assert.equal(resumed,true);
});
