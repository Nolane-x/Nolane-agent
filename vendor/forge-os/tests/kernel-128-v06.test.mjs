import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import path from 'node:path';
const json=(file)=>readFile(file,'utf8').then(JSON.parse);

test('v0.6 kernel index contains exactly 32 L0 and 96 L1 distinct techniques',async()=>{
 const [l0,l1,catalog]=await Promise.all([json('skills-v2/kernel-index.json'),json('skills-v2/l1-index.json'),json('skills-v2/catalog.json')]);
 assert.equal(l0.count,32);assert.equal(l1.count,96);
 const ids=[...l0.skills.map(x=>x.id),...l1.skills.map(x=>x.id)];assert.equal(new Set(ids).size,128);
 for(const id of ids)assert.ok(catalog.some(x=>x.id===id),`missing ${id} from catalog`);
});

test('all generated L1 candidates have precise triggers, anti-triggers, six public cases, sections, and no silent promotion',async()=>{
 const index=await json('skills-v2/l1-index.json');
 for(const entry of index.skills.filter(x=>x.source==='generated-v06')){
  const root=entry.path;const manifest=await json(path.join(root,'manifest.json'));const cases=await json(path.join(root,'evaluators/cases.json'));const body=await readFile(path.join(root,'SKILL.md'),'utf8');
  assert.equal(manifest.kernelLevel,'L1');assert.equal(manifest.maturity,'candidate');assert.ok(manifest.identity.description.startsWith('Use when '));assert.ok(manifest.identity.antiTriggers.length>=2);assert.ok(manifest.procedure.steps.length>=3);assert.ok(manifest.verification.executableChecks.length>=2);assert.equal(cases.length,6);assert.ok(body.split(/\s+/).length<500);assert.ok(manifest.executionProgram.hardPipeline.length>=4);
 }
});

test('L1 mechanisms are sourced from method-specific contracts rather than identical generated procedures',async()=>{
 const index=await json('skills-v2/l1-index.json');const signatures=[];
 for(const entry of index.skills.filter(x=>x.source==='generated-v06')){const manifest=await json(path.join(entry.path,'manifest.json'));signatures.push(JSON.stringify(manifest.procedure.steps.map(x=>x.action)));}
 assert.equal(new Set(signatures).size,signatures.length);
});
