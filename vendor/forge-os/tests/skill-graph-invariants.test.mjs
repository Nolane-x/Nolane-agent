import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSkillCatalog, getSkill, validateSkillCatalog } from '../src/skills/catalog.mjs';
import { planToArtifact, reachableArtifacts } from '../src/router/planner.mjs';
import { routeSkills } from '../src/router/router.mjs';

test('catalog has real producer-consumer edges and no unresolved required inputs', async () => {
  const catalog = await loadSkillCatalog();
  assert.equal(catalog.length, 250);
  assert.ok(catalog.every((skill) => skill.body === undefined), 'metadata loader must not preload skill bodies');
  const report = validateSkillCatalog(catalog);
  assert.deepEqual(report.errors, []);
  assert.ok(report.edgeCount >= 200, `only ${report.edgeCount} typed edges`);
  assert.equal(report.unresolvedInputs.length, 0);
  assert.equal(report.orphanOutputs.length, 0);
});

test('a typed path exists from confirmed intent to release dossier', async () => {
  const catalog = await loadSkillCatalog();
  const reachable = reachableArtifacts(catalog, ['confirmed-intent']);
  assert.ok(reachable.has('release-dossier'));
  const plan = planToArtifact(catalog, 'release-dossier', ['confirmed-intent'], { domain: 'saas', assurance: 'A2' });
  assert.ok(plan.steps.length >= 8);
  assert.equal(plan.target, 'release-dossier');
  assert.ok(plan.steps.some((step) => step.produces.includes('selected-concept')));
  assert.ok(plan.steps.some((step) => step.produces.includes('verified-build')));
  assert.ok(plan.steps.at(-1).produces.includes('release-dossier'));
});

test('selected skill body is loaded on demand only', async () => {
  const metadata = await loadSkillCatalog();
  const selected = await getSkill(metadata[0].name);
  assert.match(selected.body, /## Procedure/);
  assert.ok(selected.content.length > selected.description.length);
});

test('router prioritizes gate target and active security risk while excluding quarantine', () => {
  const catalog = [
    { name: 'product', contract: { status: 'stable', stages: ['verification'], domains: ['all'], assurance: ['A2'], consumes: ['verified-build'], produces: ['verification-report'], preconditions: [], requiredTools: [], optionalTools: [], conflicts: [], context: { estimatedTokens: 200 } } },
    { name: 'security', contract: { status: 'stable', stages: ['verification'], domains: ['all'], assurance: ['A2'], consumes: ['verified-build'], produces: ['security-review'], preconditions: [], requiredTools: [], optionalTools: [], conflicts: [], context: { estimatedTokens: 250 } } },
    { name: 'quarantined', contract: { status: 'quarantined', stages: ['verification'], domains: ['all'], assurance: ['A2'], consumes: ['verified-build'], produces: ['security-review'], preconditions: [], requiredTools: [], optionalTools: [], conflicts: [], context: { estimatedTokens: 10 } } },
  ];
  const routes = routeSkills(catalog, {
    stage: 'verification', domain: 'all', assurance: 'A2', artifacts: ['verified-build'], facts: {}, tools: [],
    targets: ['security-review'], findings: [{ severity: 'critical', category: 'security', status: 'open' }], utility: {},
  });
  assert.deepEqual(routes.map((route) => route.name), ['security','product']);
  assert.ok(routes[0].reasons.includes('target:security-review'));
  assert.ok(routes[0].reasons.includes('risk:security'));
});
