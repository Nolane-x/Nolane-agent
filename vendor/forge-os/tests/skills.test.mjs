import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSkillCatalog, getSkill, validateSkillCatalog } from '../src/skills/catalog.mjs';

test('catalog contains 146 core and 104 domain skills', async () => {
  const catalog = await loadSkillCatalog();
  assert.equal(catalog.length, 250);
  assert.equal(new Set(catalog.map((x) => x.name)).size, 250);
  assert.equal(catalog.filter((x) => x.contract.kind === 'core').length, 146);
  assert.equal(catalog.filter((x) => x.contract.kind === 'domain').length, 104);
});

test('every skill is portable, connected, gated, and context-bounded', async () => {
  const report = validateSkillCatalog(await loadSkillCatalog());
  assert.deepEqual(report.errors, []);
  assert.equal(report.coreCount, 146);
  assert.equal(report.domainCount, 104);
});

test('root ForgeOS router skill is discoverable and contains the graph protocol', async () => {
  const skill = await getSkill('using-forge-os');
  assert.match(skill.body, /Skill Graph Router/);
  assert.match(skill.body, /Artifact Handoff/);
  assert.equal(skill.contract.pack, 'kernel');
});


test('skill cells contain method-specific protocols, verification questions, evidence packets, and complete handoffs', async () => {
  const catalog = await loadSkillCatalog(undefined, { includeBody: true });
  const flagship = catalog.filter((skill) => skill.contract.method?.source === 'flagship');
  assert.ok(flagship.length >= 28, `only ${flagship.length} flagship skills`);
  for (const skill of catalog) {
    assert.doesNotMatch(skill.body, /Apply the specific discipline/i, skill.name);
    assert.match(skill.body, /## Method-Specific Protocol/, skill.name);
    assert.match(skill.body, /## Verification Questions/, skill.name);
    assert.match(skill.body, /## Evidence Packet/, skill.name);
    assert.match(skill.body, /## Escalation and Invalidation/, skill.name);
    assert.ok(skill.contract.procedure.length >= 9, skill.name);
    assert.ok(skill.contract.method?.verification?.length >= 3, skill.name);
    assert.ok(skill.contract.method?.evidence?.length >= 2, skill.name);
    assert.ok(skill.contract.handoff?.requiredFields?.length >= 8, skill.name);
    assert.ok(skill.contract.reference?.startsWith('skills/references/'), skill.name);
  }
});
