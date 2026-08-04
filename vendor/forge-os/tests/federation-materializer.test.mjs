import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compileCapabilityExecutionBundle } from '../src/federation/resolver.mjs';
import { materializeCapabilityBundle } from '../src/federation/materializer.mjs';

const capability={capabilityId:'ui-design.audit-accessibility',title:'Audit accessibility',domain:'ui-design',discipline:'audit-accessibility',phase:'verification',ordinal:1,riskClass:'medium',consumes:['ui'],produces:['report'],evidence:['receipt'],requiredTools:[],mcpCapabilities:[],qualityDimensions:['accessibility'],dependencies:[],conflictTags:[],knowledgePackId:'knowledge-pack.ui-design',providerPolicy:{minimumTrust:60,allowLinkOnly:true,preferLocal:true},contextBudget:1200};

async function fixture(){
  const root=await mkdtemp(path.join(os.tmpdir(),'forge-materialize-'));
  await mkdir(path.join(root,'skills/ui-audit'),{recursive:true});
  await writeFile(path.join(root,'skills/ui-audit/SKILL.md'),'---\nname: ui-audit\ndescription: Use when auditing UI\n---\n# UI Audit\nVerify keyboard and contrast.');
  await mkdir(path.join(root,'knowledge/packs'),{recursive:true});
  await writeFile(path.join(root,'knowledge/packs/ui-design.json'),JSON.stringify({id:'knowledge-pack.ui-design',title:'UI Design Knowledge',loadingPolicy:{mode:'reference-only'},sources:[{id:'w3c-wcag',title:'WCAG',url:'https://www.w3.org/WAI/WCAG22/',revision:'2.2',license:{spdx:'W3C-Document',mode:'link-only'}}]}));
  const providers=[
    {providerId:'skill.local',providerDigest:'1'.repeat(64),contentDigest:'a'.repeat(64),capabilityId:capability.capabilityId,kind:'skill',status:'stable',sourceId:'forgeos-local',sourceCoordinate:'release:v0.4.0#skills/ui-audit/SKILL.md',title:'UI audit',trust:{score:98,blockers:[]},license:{spdx:'MIT',mode:'vendor-allowed'},compatibility:{agents:['*'],tools:[]},estimatedTokens:100,conflicts:[],material:{type:'local-agent-skill',path:'skills/ui-audit/SKILL.md',bodyLoadedByDefault:false}},
    {providerId:'knowledge.local',providerDigest:'2'.repeat(64),contentDigest:'b'.repeat(64),capabilityId:capability.capabilityId,kind:'knowledge',status:'stable',sourceId:'forgeos-local',sourceCoordinate:'release:v0.4.0#knowledge/packs/ui-design.json',title:'UI knowledge',trust:{score:94,blockers:[]},license:{spdx:'MIT',mode:'link-only'},compatibility:{agents:['*'],tools:[]},estimatedTokens:80,conflicts:[],material:{type:'knowledge-pack-reference',path:'knowledge/packs/ui-design.json',capabilityId:capability.capabilityId,remoteContentVendored:false}},
  ];
  return{root,providers};
}

test('materializer verifies bundle/provider digests and loads only bounded safe text plus knowledge references',async()=>{
  const {root,providers}=await fixture();
  const bundle=compileCapabilityExecutionBundle(capability,{agent:'codex',tools:[],allowExternal:false,activeProviders:[],assurance:'A2'},providers);
  const pack=await materializeCapabilityBundle(bundle,{providers,root,maxBytes:20_000});
  assert.equal(pack.bundleSha256,bundle.bundleSha256);
  assert.deepEqual(pack.materials.map((item)=>item.providerId),['skill.local','knowledge.local']);
  assert.match(pack.materials[0].documents[0].content,/Verify keyboard/);
  assert.equal(pack.materials[1].references[0].id,'w3c-wcag');
  assert.equal(pack.materials[1].remoteContentVendored,false);
  assert.ok(pack.materials.every((item)=>!('scripts' in item)));
  assert.match(pack.contextPackSha256,/^[a-f0-9]{64}$/);
  assert.ok(pack.estimatedTokens<=bundle.context.budgetTokens);
});

test('materializer rejects tampered bundle, candidate providers, digest mismatch, traversal, and budget overflow',async()=>{
  const {root,providers}=await fixture();
  const bundle=compileCapabilityExecutionBundle(capability,{agent:'codex',tools:[],allowExternal:false,activeProviders:[],assurance:'A2'},providers);
  await assert.rejects(()=>materializeCapabilityBundle({...bundle,bundleSha256:'0'.repeat(64)},{providers,root}),/bundle digest/i);
  await assert.rejects(()=>materializeCapabilityBundle(bundle,{providers:[{...providers[0],status:'candidate'},providers[1]],root}),/stable provider/i);
  await assert.rejects(()=>materializeCapabilityBundle(bundle,{providers:[{...providers[0],providerDigest:'9'.repeat(64)},providers[1]],root}),/provider digest/i);
  await assert.rejects(()=>materializeCapabilityBundle(bundle,{providers:[{...providers[0],material:{...providers[0].material,path:'../secret'}},providers[1]],root}),/safe relative path/i);
  await assert.rejects(()=>materializeCapabilityBundle(bundle,{providers,root,maxBytes:10}),/materialization byte budget/i);
});

test('materializer rejects a local provider path that escapes the repository through a symlink', async () => {
  const { symlink } = await import('node:fs/promises');
  const {root,providers}=await fixture();
  const outside=await mkdtemp(path.join(os.tmpdir(),'forge-materialize-outside-'));
  await writeFile(path.join(outside,'SKILL.md'),'# Escaped skill');
  await symlink(path.join(outside,'SKILL.md'),path.join(root,'skills/ui-audit/ESCAPE.md'));
  const escaped={...providers[0],material:{...providers[0].material,path:'skills/ui-audit/ESCAPE.md'}};
  const bundle=compileCapabilityExecutionBundle(capability,{agent:'codex',tools:[],allowExternal:false,activeProviders:[],assurance:'A2'},[escaped,providers[1]]);
  await assert.rejects(()=>materializeCapabilityBundle(bundle,{providers:[escaped,providers[1]],root}),/symlink|repository root|material path/i);
});
