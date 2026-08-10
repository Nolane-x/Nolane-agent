import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { assertTaskActionAllowed, normalizeTaskContract } from '../src/orchestration/task-contract.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

function valid(overrides = {}) {
  return {
    objective: 'Reduce API latency below 200 ms at p95.',
    successCriteria: [{ id: 'latency', description: 'p95 is below 200 ms', verification: { command: 'npm', args: ['test'] } }],
    scope: { allowedPaths: ['src/**', 'tests/**'], deniedPaths: ['secrets/**'] },
    allowedCommands: ['npm', 'node'],
    networkPolicy: { mode: 'allowlist', domains: ['registry.npmjs.org'], ports: [443] },
    testCriteria: ['npm test'],
    performanceCriteria: ['p95 < 200ms'],
    securityCriteria: ['No secret in diff'],
    compatibilityCriteria: ['Node.js 22'],
    outputContract: { kind: 'source-and-report', requiredArtifacts: ['verification-report.md'] },
    allowCommit: true,
    allowDeploy: false,
    allowInternet: true,
    autonomy: 'workspace-autopilot',
    tokenBudget: 100000,
    deadline: '2027-01-01T00:00:00.000Z',
    riskLevel: 'medium',
    stopConditions: ['budget-exhausted', 'verification-failed'],
    ...overrides,
  };
}

test('normalizeTaskContract produces an immutable, content-addressed measurable contract', () => {
  const contract = normalizeTaskContract(valid());
  assert.equal(contract.schema, 'forge.task-contract.v1');
  assert.match(contract.contractSha256, /^[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(contract), true);
  assert.deepEqual(contract.scope.allowedPaths, ['src/**', 'tests/**']);
  assert.throws(() => normalizeTaskContract(valid({ successCriteria: [] })), /successCriteria/i);
  assert.throws(() => normalizeTaskContract(valid({ objective: 'Do stuff' })), /measurable/i);
  assert.throws(() => normalizeTaskContract(valid({ networkPolicy: { mode: 'allowlist', domains: [], ports: [] } })), /allowlist/i);
});

test('task contract blocks scope expansion, undeclared commands, network, commit, deploy, and output drift', () => {
  const contract = normalizeTaskContract(valid());
  assert.doesNotThrow(() => assertTaskActionAllowed(contract, { kind: 'file.write', path: 'src/api.mjs' }));
  assert.doesNotThrow(() => assertTaskActionAllowed(contract, { kind: 'process.run', command: 'npm' }));
  assert.doesNotThrow(() => assertTaskActionAllowed(contract, { kind: 'network.request', url: 'https://registry.npmjs.org/pkg' }));
  assert.throws(() => assertTaskActionAllowed(contract, { kind: 'file.write', path: 'docs/unplanned.md' }), /scope/i);
  assert.throws(() => assertTaskActionAllowed(contract, { kind: 'process.run', command: 'curl' }), /command/i);
  assert.throws(() => assertTaskActionAllowed(contract, { kind: 'network.request', url: 'https://example.com' }), /network/i);
  assert.doesNotThrow(() => assertTaskActionAllowed(contract, { kind: 'git.commit' }));
  assert.throws(() => assertTaskActionAllowed(normalizeTaskContract(valid({ allowCommit: false })), { kind: 'git.commit' }), /commit/i);
  assert.throws(() => assertTaskActionAllowed(contract, { kind: 'deploy' }), /deploy/i);
  assert.throws(() => assertTaskActionAllowed(contract, { kind: 'output.publish', artifact: 'other.bin' }), /output/i);
});


test('StudioStore normalizes a supplied task contract and binds task paths to its scope', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-task-contract-store-'));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const task = store.createTask({ projectId: project.id, title: 'Latency', objective: valid().objective, metadata: { taskContract: valid() } });
  assert.equal(task.metadata.taskContract.schema, 'forge.task-contract.v1');
  assert.deepEqual(task.allowedPaths, ['src/**', 'tests/**']);
  assert.deepEqual(task.deniedPaths, ['secrets/**']);
  assert.throws(() => store.createTask({ projectId: project.id, title: 'Mismatch', objective: 'Implement a different measurable objective with 2 tests.', metadata: { taskContract: valid() } }), /objective/i);
});
