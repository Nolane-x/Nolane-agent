import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildSectionIndex, loadSkillSections } from '../src/skills/v2/section-index.mjs';
import { createDefaultTokenAccountingRegistry } from '../src/context/token-accounting.mjs';

async function fixture(){
 const root=await mkdtemp(path.join(os.tmpdir(),'forge-section-v2-'));
 await mkdir(path.join(root,'sections'),{recursive:true});
 await writeFile(path.join(root,'SKILL.md'),'# Overview\nUse the smallest sufficient method.');
 await writeFile(path.join(root,'sections/procedure.md'),'# Procedure\n1. Establish a baseline.\n2. Apply one change.');
 await writeFile(path.join(root,'sections/examples.md'),'# Examples\nA large optional example.');
 return root;
}

test('section index records digest, bytes, and model-family token counts',async()=>{
 const root=await fixture();const registry=createDefaultTokenAccountingRegistry();
 const index=await buildSectionIndex(root,{registry,models:['gpt-5.6','claude-opus-4.2']});
 assert.deepEqual(index.sections.map(s=>s.id),['overview','procedure','examples']);
 assert.ok(index.sections.every(s=>/^[a-f0-9]{64}$/.test(s.sha256)&&s.bytes>0&&s.tokens['gpt-5.6']>0));
});

test('section loader loads only requested sections, verifies digest, and enforces token budget',async()=>{
 const root=await fixture();const registry=createDefaultTokenAccountingRegistry();const index=await buildSectionIndex(root,{registry,models:['gpt-5.6']});
 const loaded=await loadSkillSections(root,index,{sectionIds:['procedure'],model:'gpt-5.6',hardTokens:1000,registry});
 assert.deepEqual(loaded.sections.map(s=>s.id),['procedure']);assert.doesNotMatch(loaded.text,/large optional example/i);
 await writeFile(path.join(root,'sections/procedure.md'),'tampered');
  await assert.rejects(()=>loadSkillSections(root,index,{sectionIds:['procedure'],model:'gpt-5.6',hardTokens:1000,registry}),/digest/i);
});

test('section loader verifies canonical content across LF and CRLF worktrees',async()=>{
 const root=await fixture();const registry=createDefaultTokenAccountingRegistry();const index=await buildSectionIndex(root,{registry,models:['gpt-5.6']});
 await writeFile(path.join(root,'sections/procedure.md'),'# Procedure\r\n1. Establish a baseline.\r\n2. Apply one change.');
 const loaded=await loadSkillSections(root,index,{sectionIds:['procedure'],model:'gpt-5.6',hardTokens:1000,registry});
 assert.equal(loaded.sections[0].content,'# Procedure\n1. Establish a baseline.\n2. Apply one change.');
});
