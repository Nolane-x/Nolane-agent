import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateSkillContractV2 } from '../src/skills/v2/contracts.mjs';

const ROOT=path.resolve('.');
const loadJson=async(file)=>JSON.parse(await readFile(path.join(ROOT,file),'utf8'));

test('L0 kernel index contains 32 curated techniques with conservative maturity',async()=>{
 const {skills:index,count}=await loadJson('skills-v2/kernel-index.json');
 assert.equal(count,32);
 assert.equal(index.length,32);
 assert.equal(index.filter((item)=>item.maturity==='stable').length,3);
 assert.equal(index.filter((item)=>item.maturity==='candidate').length,29);
 assert.equal(new Set(index.map((item)=>item.id)).size,32);
});

test('every L0 package validates, is hybrid, and has compact overview plus evaluator evidence',async()=>{
 const {skills:index}=await loadJson('skills-v2/kernel-index.json');
 for(const entry of index){
  const base=path.join(ROOT,entry.path);
  const manifest=await loadJson(path.join(entry.path,'manifest.json'));
  assert.equal(validateSkillContractV2(manifest).id,entry.id,entry.id);
  assert.equal(manifest.kernelLevel,'L0',entry.id);
  assert.equal(manifest.executionProgram.executionMode,'hybrid',entry.id);
  assert.ok(manifest.identity.antiTriggers.length>=2,entry.id);
  assert.ok(manifest.verification.evaluatorIds.length>=1,entry.id);
  const overview=await readFile(path.join(base,'SKILL.md'),'utf8');
  const wordCount=overview.trim().split(/\s+/u).length;
  assert.ok(wordCount<=250,`${entry.id} overview has ${wordCount} words`);
  const cases=JSON.parse(await readFile(path.join(base,'evaluators/cases.json'),'utf8'));
  const baseline=JSON.parse(await readFile(path.join(base,'evaluators/baseline.json'),'utf8'));
  assert.ok(cases.length>=2,entry.id);
  assert.equal(baseline.status,'red-baseline-recorded',entry.id);
 }
});

test('Capability Graph v2 contains all 32 L0 techniques exactly once',async()=>{
 const graph=await loadJson('capabilities-v2/graph.json');
 const l0=graph.techniques.filter((item)=>item.kernelLevel==='L0');
 assert.equal(l0.length,32);
 assert.equal(new Set(l0.map((item)=>item.skillId)).size,32);
});
