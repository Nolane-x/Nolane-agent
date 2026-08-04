import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ForgeOsBridge } from '../src/forge/forgeos-bridge.mjs';

async function bridgeFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-studio-forgeos-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bridge = new ForgeOsBridge({ forgeOsRoot: path.resolve('vendor/forge-os'), dataDir: root });
  const project = await bridge.createProject({ name: 'Forge Studio', domain: 'developer-tools', assurance: 'A1' });
  return { bridge, project, root };
}

test('ForgeOsBridge creates authenticated projects and snapshots', async (t) => {
  const { bridge, project } = await bridgeFixture(t);
  assert.match(project.id, /^forge_/);
  assert.equal(project.name, 'Forge Studio');
  const snapshot = await bridge.snapshot(project.id);
  assert.equal(snapshot.project.id, project.id);
  assert.equal(snapshot.project.stage, 'intent');
  assert.ok(snapshot.intelligence.kernelTechniqueCount >= 100);
});

test('ForgeOsBridge routes deterministically and materializes only selected skill sections', async (t) => {
  const { bridge } = await bridgeFixture(t);
  const input = {
    query: 'Develop a secure feature with test-driven development',
    domains: ['software-testing', 'ai-agent-engineering'],
    taskClass: 'implementation',
    tools: ['filesystem', 'shell', 'git', 'node', 'planning'],
    model: 'gpt-5.6',
  };
  const first = await bridge.route(input);
  const second = await bridge.route(input);
  assert.equal(first.routePlanSha256, second.routePlanSha256);
  assert.ok(first.steps.length >= 1);
  assert.ok(first.steps.every((step) => step.sections.length > 0));

  const pack = await bridge.buildContextPack({
    ...input,
    task: 'Implement one tested vertical slice.',
    code: [{ id: 'large-code', text: 'export const x = 1;\n'.repeat(3000), priority: 10 }],
    references: [{ id: 'large-reference', text: 'reference '.repeat(5000), priority: 1 }],
    policy: {
      modelContextLimit: 8_000,
      hardInputLimit: 5_000,
      outputReserve: 1_500,
      safetyReserve: 500,
      budgets: { system: 500, task: 500, skills: 1_400, code: 1_200, artifacts: 200, memory: 300, toolOutput: 200, references: 200 },
    },
  });
  assert.equal(pack.routePlan.routePlanSha256, first.routePlanSha256);
  assert.ok(pack.skills.length >= 1);
  assert.ok(pack.skills.every((skill) => skill.sections.length <= 3));
  assert.ok(pack.compiled.accounting.totalInputTokens <= pack.compiled.budget.availableInput);
  assert.ok(pack.compiled.omissions.some((item) => ['large-code', 'large-reference'].includes(item.sourceId)));
  assert.match(pack.contextPackSha256, /^[a-f0-9]{64}$/);
});

test('ForgeOsBridge records unverified evidence and creates one-time approvals', async (t) => {
  const { bridge, project } = await bridgeFixture(t);
  const evidence = await bridge.recordEvidence(project.id, {
    type: 'research-note',
    title: 'Agent architecture investigation',
    summary: 'Inspected the code and recorded a non-authoritative note.',
    metadata: { source: 'local-analysis' },
  });
  assert.equal(evidence.status, 'unverified');
  assert.equal((await bridge.snapshot(project.id)).project.evidence.at(-1).id, evidence.id);

  const approval = await bridge.requestApproval(project.id, 'execute:git-commit');
  assert.match(approval.token, /^[A-Za-z0-9_-]+$/);
  assert.equal(approval.action, 'execute:git-commit');
});
