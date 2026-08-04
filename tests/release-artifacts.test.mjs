import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { packageReleaseArtifacts, verifyReleaseArtifacts } from '../src/release/release-artifacts.mjs';

const execFileAsync=promisify(execFile);
const python=process.env.NOLANE_AGENT_PYTHON || (process.platform==='win32'?'python':'python3');
async function write(root,relative,content){const file=path.join(root,relative);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,content);return file;}
async function makeZip(root,archive,entries){const spec=await write(root,`${path.basename(archive)}.json`,JSON.stringify({entries}));await execFileAsync(python,[path.join(root,'scripts/zip-artifacts.py'),'create',spec,archive]);}

async function fixture(){
  const root=await mkdtemp(path.join(os.tmpdir(),'nolane-release-beta1-'));
  await mkdir(path.join(root,'scripts'),{recursive:true}); await cp(path.resolve('scripts/zip-artifacts.py'),path.join(root,'scripts/zip-artifacts.py'));
  const version='5.0.0-beta.1';
  await write(root,'config/release-identity.json',JSON.stringify({schema:'nolane.agent.release-identity.v1',product:'Nolane Agent',version,channel:'beta',artifactPrefix:'NolaneAgent',vscodeArtifactPrefix:'NolaneAgent-VSCode'}));
  const files=[
    ['package.json',JSON.stringify({name:'nolane-agent',productName:'Nolane Agent',version})],
    ['package-lock.json',JSON.stringify({name:'nolane-agent',version,lockfileVersion:3,packages:{'':{name:'nolane-agent',version}}})],
    ['config/product-identity.json',JSON.stringify({schema:'nolane.agent.product-identity.v1',product:'Nolane Agent',packageName:'nolane-agent',version})],
    ['src/app.mjs','export const ok=true;\n'],
    ['THIRD_PARTY_NOTICES.md','Historical attribution only.\n'],
    [`docs/FEATURE-COMPLETENESS-AUDIT-${version}.md`,'# Audit\n'],
    [`docs/REMAINING-GAPS-${version}.md`,'# Gaps\n'],
    ['vendor/forge-os.manifest.json',JSON.stringify({schema:'forge.vendor-manifest.v1'})],
    ['vendor/forge-os/src/core/canonical-json.mjs','export const canonicalSha256=()=>"x";\n'],
    ['vendor/forge-os/src/core/orchestrator.mjs','export class ForgeOrchestrator{}\n'],
  ];
  for(const [r,c] of files) await write(root,r,c);
  const manifestFiles=files.map(([relativePath])=>({relativePath,version}));
  await write(root,'project-manifest.json',JSON.stringify({schema:'nolane.agent.project-manifest.v1',product:'Nolane Agent',version,files:manifestFiles}));
  await write(root,`release/remaining-gaps-${version}.json`,JSON.stringify({productVersion:version,totalOpen:5,summary:{external_gate:5},receiptSha256:'a'.repeat(64)}));
  for(const [r,c] of [['extensions/vscode/[Content_Types].xml','<Types/>'],['extensions/vscode/extension.vsixmanifest','<PackageManifest/>'],['extensions/vscode/extension/package.json',JSON.stringify({version})],['extensions/vscode/extension/dist/client.js','export {};'],['extensions/vscode/extension/dist/extension.js','export {};']]) await write(root,r,c);
  const winRoot=`NolaneAgent-${version}-electron-windows-x64`;
  const winBase=path.join(root,'fixtures/windows');
  const wf=[await write(root,'fixtures/windows/NolaneAgent.exe','exe'),await write(root,'fixtures/windows/app/src/app.mjs','app'),await write(root,'fixtures/windows/PORTABLE-MANIFEST.json','{}')];
  await makeZip(root,path.join(root,'release',`${winRoot}.zip`),wf.map(source=>({source,archivePath:`${winRoot}/${path.relative(winBase,source).replaceAll('\\','/')}`})));
  const uf=[await write(root,'fixtures/update/NolaneAgent.exe','exe'),await write(root,'fixtures/update/app/src/app.mjs','app'),await write(root,'fixtures/update/UPDATE-PAYLOAD-MANIFEST.json','{}')];
  await makeZip(root,path.join(root,'release',`NolaneAgent-${version}-update-payload.zip`),uf.map(source=>({source,archivePath:path.relative(path.join(root,'fixtures/update'),source).replaceAll('\\','/')})));
  return {root,version};
}

test('release artifacts contain source, portable Windows, update payload and VSIX with Nolane-owned runtime metadata',async(t)=>{
  const f=await fixture();t.after(()=>rm(f.root,{recursive:true,force:true}));
  const manifest=await packageReleaseArtifacts({rootDirectory:f.root,version:f.version});
  assert.equal(manifest.artifacts.length,4);
  assert.deepEqual(manifest.components,{});
  assert.equal(manifest.runtimeOwnership.externalRuntimeBundled,false);
  assert.equal(manifest.runtimeOwnership.externalExecutablePaths,0);
  assert.equal(manifest.runtimeOwnership.runtime,'nolane-native');
  assert.equal(manifest.artifacts.some(a=>/NolaneNative/i.test(a.fileName)),false);
  const report=await verifyReleaseArtifacts({rootDirectory:f.root,version:f.version});
  assert.equal(report.status,'pass');
  assert.equal(report.archives.length,4);
});

test('release verification rejects a source archive containing a NolaneNative path',async(t)=>{
  const f=await fixture();t.after(()=>rm(f.root,{recursive:true,force:true}));
  await packageReleaseArtifacts({rootDirectory:f.root,version:f.version});
  const release=path.join(f.root,'release');
  const bad=await write(f.root,'forbidden/nolane_native-agent-main.zip','bad');
  const source=`NolaneAgent-${f.version}-source.zip`;
  await makeZip(f.root,path.join(release,source),[{source:bad,archivePath:`NolaneAgent-${f.version}-source/vendor/nolane_native-agent/nolane_native-agent-main.zip`}]);
  await assert.rejects(()=>verifyReleaseArtifacts({rootDirectory:f.root,version:f.version}),/checksum mismatch|NolaneNative/i);
});


test('release verification rejects portable and update archives containing release-time NolaneNative audit modules',async(t)=>{
  const f=await fixture();t.after(()=>rm(f.root,{recursive:true,force:true}));
  await packageReleaseArtifacts({rootDirectory:f.root,version:f.version});
  const release=path.join(f.root,'release');
  const bad=await write(f.root,'forbidden/nolane-native-domain-classifier.mjs','audit-only');
  const winRoot=`NolaneAgent-${f.version}-electron-windows-x64`;
  const windowsArchive=path.join(release,`${winRoot}.zip`);
  const wf=[
    await write(f.root,'fixtures/windows2/NolaneAgent.exe','exe'),
    await write(f.root,'fixtures/windows2/app/src/app.mjs','app'),
    await write(f.root,'fixtures/windows2/PORTABLE-MANIFEST.json','{}'),
  ];
  await makeZip(f.root,windowsArchive,[
    ...wf.map(source=>({source,archivePath:`${winRoot}/${path.relative(path.join(f.root,'fixtures/windows2'),source).replaceAll('\\','/')}`})),
    {source:bad,archivePath:`${winRoot}/app/src/native-core/nolane-native-domain-classifier.mjs`},
  ]);
  const manifestPath=path.join(release,`release-manifest-${f.version}.json`);
  const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
  const artifact=manifest.artifacts.find((entry)=>entry.fileName===`${winRoot}.zip`);
  const bytes=await readFile(windowsArchive);
  artifact.bytes=(await stat(windowsArchive)).size;
  artifact.sha256=createHash('sha256').update(bytes).digest('hex');
  await writeFile(manifestPath,JSON.stringify(manifest,null,2));
  await writeFile(path.join(release,`SHA256SUMS-${f.version}.txt`),`${manifest.artifacts.map((entry)=>`${entry.sha256}  ${entry.fileName}`).join('\n')}\n`);
  await assert.rejects(()=>verifyReleaseArtifacts({rootDirectory:f.root,version:f.version}),/retired NolaneNative|forbidden/i);
});

test('release packaging ignores a VS Code build lock that disappears after manifest generation',async(t)=>{
  const f=await fixture();t.after(()=>rm(f.root,{recursive:true,force:true}));
  const lockRelative='extensions/vscode/.forge-vscode-build.lock/owner.json';
  await write(f.root,lockRelative,JSON.stringify({pid:123}));
  const manifestPath=path.join(f.root,'project-manifest.json');
  const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
  manifest.files.push({relativePath:lockRelative,version:f.version,status:'ready'});
  await writeFile(manifestPath,JSON.stringify(manifest,null,2));
  await rm(path.join(f.root,'extensions/vscode/.forge-vscode-build.lock'),{recursive:true,force:true});
  const result=await packageReleaseArtifacts({rootDirectory:f.root,version:f.version});
  assert.equal(result.artifacts.length,4);
  assert.equal(result.artifacts.some((entry)=>entry.fileName.includes('lock')),false);
});
