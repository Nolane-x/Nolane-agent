import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const current=[
  'docs/ARCHITECTURE.md','docs/SECURITY-MODEL.md','docs/PROTOCOLS.md',
  'docs/SKILL-INTELLIGENCE.md','docs/SKILLS.md','docs/TESTING.md',
  'docs/PRODUCTION.md','docs/BENCHMARK-METHODOLOGY.md',
];

test('current technical documents describe v0.6 and the 128-technique kernel without stale v0.5 inventory',async()=>{
  for(const file of current){
    const body=await readFile(file,'utf8');
    assert.match(body,/v0\.6/i,`${file} must identify the current release`);
    assert.match(body,/128|Deterministic Skill Fabric|Skill Intelligence/i,`${file} must describe the current system`);
    assert.doesNotMatch(body,/^# ForgeOS v0\.5|\b62 deep techniques\b|\b62 evaluator/i,`${file} contains stale current-release claims`);
  }
});

test('changelog records the v0.6 trust, execution, learning, harness, security, context, and documentation surfaces',async()=>{
  const body=await readFile('CHANGELOG.md','utf8');
  assert.match(body,/## 0\.6\.0/);
  for(const pattern of [/Execution Graph/i,/Coverage Ledger/i,/Code Review Intelligence/i,/Continuous Learning/i,/Harness Runtime/i,/Agent Surface Security/i,/128 kernel/i,/Global Context Kernel v2/i,/22.*README/i])assert.match(body,pattern);
});
