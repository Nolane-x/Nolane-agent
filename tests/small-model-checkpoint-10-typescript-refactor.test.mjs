import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { loadCheckpoint10TypeScriptPack } from '../src/small-model/checkpoint-10-typescript-pack.mjs';
import { Checkpoint10TypeScriptLab } from '../src/small-model/checkpoint-10-typescript-lab.mjs';
import { TypeScriptRefactorEngine } from '../src/small-model/typescript-refactor-engine.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function load(id){const pack=await loadCheckpoint10TypeScriptPack({root,id});const files=await Promise.all(pack.sourceFiles.map(async e=>({path:e.path,source:await readFile(path.join(root,pack.rootPath,e.path),'utf8'),sha256:e.sha256})));return{pack,files};}
test('TypeScript refactor engine renames public type through namespace type-only import and re-export chain',async()=>{const{files}=await load('transfer-c');const plan=new TypeScriptRefactorEngine().plan({files,target:{path:'src/model.ts',name:'CanonicalPayload'},replacement:'PromotedPayload',allowedPaths:files.map(e=>e.path)});assert.equal(plan.changedFiles>=5,true);const by=new Map(plan.files.map(e=>[e.path,e.output]));assert.match(by.get('src/namespace.ts'),/api\.PromotedPayload/);assert.match(by.get('src/alias.ts'),/PromotedPayload as Payload/);assert.match(by.get('src/model.ts'),/CanonicalPayload remains in comments/);assert.match(by.get('src/model.ts'),/'CanonicalPayload remains in strings'/);assert.match(by.get('src/model.ts'),/\{ CanonicalPayload: 'property-key' \}/);});
test('Checkpoint 10 TypeScript lab preserves best candidate and verifies disjoint transfer with rollback',async()=>{const lab=new Checkpoint10TypeScriptLab();const a=await lab.collect({root,pack:await loadCheckpoint10TypeScriptPack({root,id:'induction-a'})});const b=await lab.collect({root,pack:await loadCheckpoint10TypeScriptPack({root,id:'induction-b'})});const skill=lab.compile({missions:[a,b]});const transfer=await lab.verify({root,skill,heldOutPack:loadCheckpoint10TypeScriptPack({root,id:'transfer-c'})});assert.equal(transfer.status,'pass');assert.equal(transfer.repositoryDisjoint,true);assert.equal(transfer.rollbackRestoredAllHashes,true);assert.equal(transfer.trackedSourcesUnchanged,true);assert.equal(transfer.bestCandidatePreserved,true);});
