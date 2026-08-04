import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { ConstructionContractRuntime } from '../src/construction/construction-contract-runtime.mjs';

const execFileAsync = promisify(execFile);
async function git(cwd, args) { return execFileAsync('git', args, { cwd, windowsHide: true }); }

async function makeRepo(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-construction-contract-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await git(root, ['init', '-q']);
  await git(root, ['config', 'user.email', 'test@example.invalid']);
  await git(root, ['config', 'user.name', 'Forge Test']);
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(path.join(root, 'src', 'api.mjs'), 'export function value() { return 1; }\n');
  await git(root, ['add', '.']);
  await git(root, ['commit', '-qm', 'baseline']);
  const { stdout } = await git(root, ['rev-parse', 'HEAD']);
  return { root, head: stdout.trim() };
}

test('contract-first vertical plan requires parse type and test checkpoints', async (t) => {
  const repo = await makeRepo(t);
  const runtime = new ConstructionContractRuntime({ workspaceRoot: repo.root, stateRoot: path.join(repo.root, '.forge-state') });
  const contract = runtime.compileContract({
    contractId: 'public-api-v1',
    types: [{ name: 'Result', shape: '{ ok: boolean }' }],
    interfaces: [{ name: 'Service', methods: ['run(): Result'] }],
    errors: [{ code: 'SERVICE_FAILED', recoverable: true }],
    states: [{ from: 'ready', event: 'run', to: 'completed' }],
    compatibility: { publicApi: 'backward-compatible', data: 'no-breaking-change' },
  });
  assert.equal(contract.status, 'ready');
  assert.match(contract.receiptSha256, /^[a-f0-9]{64}$/);

  assert.throws(() => runtime.createVerticalPlan({
    planId: 'plan-bad', contractReceiptSha256: contract.receiptSha256,
    slices: [{ sliceId: 'slice-1', taskIds: ['t1'], allowedFiles: ['src/api.mjs'], checkpoints: ['parse', 'test'] }],
  }), /parse, type, and test/);

  const plan = runtime.createVerticalPlan({
    planId: 'plan-1', contractReceiptSha256: contract.receiptSha256,
    slices: [
      { sliceId: 'slice-1', taskIds: ['t1', 't2'], allowedFiles: ['src/api.mjs'], contractIds: ['public-api-v1'], checkpoints: ['parse', 'type', 'test'] },
      { sliceId: 'slice-2', taskIds: ['t3'], allowedFiles: ['tests/api.test.mjs'], contractIds: ['public-api-v1'], checkpoints: ['parse', 'type', 'test'] },
    ],
  });
  assert.deepEqual(plan.slices.map((slice) => slice.status), ['ready', 'blocked']);
  assert.equal(plan.claims.checkpointAfterEverySlice, true);
});

test('replan revokes obsolete tasks and ownership conflicts fail closed', async (t) => {
  const repo = await makeRepo(t);
  const runtime = new ConstructionContractRuntime({ workspaceRoot: repo.root, stateRoot: path.join(repo.root, '.forge-state') });
  const contract = runtime.compileContract({ contractId: 'c', types: [], interfaces: [], errors: [], states: [], compatibility: { publicApi: 'internal-only' } });
  const plan = runtime.createVerticalPlan({ planId: 'p', contractReceiptSha256: contract.receiptSha256, slices: [{ sliceId: 's', taskIds: ['keep', 'remove'], allowedFiles: ['src/api.mjs'], contractIds: ['c'], checkpoints: ['parse', 'type', 'test'] }] });
  const replanReceipt = canonicalSha256({ planId: plan.planId, obsoleteTaskIds: ['remove'], reason: 'covered by keep' });
  const replanned = runtime.replan({ plan, obsoleteTaskIds: ['remove'], reason: 'covered by keep', verificationReceiptSha256: replanReceipt });
  assert.deepEqual(replanned.revokedTaskIds, ['remove']);
  assert.deepEqual(replanned.activeTaskIds, ['keep']);

  const ownership = runtime.bindOwnership({ milestoneId: 'm1', maxFilesPerOwner: 2, maxContractsPerOwner: 1, assignments: [
    { ownerId: 'agent-a', files: ['src/api.mjs'], contracts: ['c'] },
    { ownerId: 'agent-b', files: ['tests/api.test.mjs'], contracts: [] },
  ] });
  assert.equal(ownership.status, 'bound');
  assert.throws(() => runtime.bindOwnership({ milestoneId: 'm2', assignments: [
    { ownerId: 'a', files: ['src/api.mjs'], contracts: [] },
    { ownerId: 'b', files: ['src/api.mjs'], contracts: [] },
  ] }), /file ownership conflict/);
});

test('high-risk candidate launch creates two or three real isolated worktrees with one contract', async (t) => {
  const repo = await makeRepo(t);
  const stateRoot = path.join(repo.root, '.forge-state');
  const runtime = new ConstructionContractRuntime({ workspaceRoot: repo.root, stateRoot });
  const verificationContractSha256 = canonicalSha256({ checks: ['parse', 'type', 'test'] });
  const launched = await runtime.launchCandidates({ verificationContractSha256, candidates: [{ candidateId: 'a' }, { candidateId: 'b' }, { candidateId: 'c' }] });
  t.after(() => runtime.cleanupCandidates(launched));
  assert.equal(launched.candidates.length, 3);
  for (const candidate of launched.candidates) {
    assert.equal(candidate.verificationContractSha256, verificationContractSha256);
    assert.equal(candidate.isolated, true);
    assert.equal(candidate.headSha, repo.head);
    const { stdout } = await git(candidate.worktreePath, ['status', '--porcelain']);
    assert.equal(stdout.trim(), '');
    assert.equal((await readFile(path.join(candidate.worktreePath, 'src', 'api.mjs'), 'utf8')).includes('return 1'), true);
  }
  assert.notEqual(launched.candidates[0].worktreePath, launched.candidates[1].worktreePath);
});

test('state capsule restores exactly after a fresh runtime instance', async (t) => {
  const repo = await makeRepo(t);
  const stateRoot = path.join(repo.root, '.forge-state');
  const first = new ConstructionContractRuntime({ workspaceRoot: repo.root, stateRoot });
  const saved = await first.saveState({
    capsuleId: 'cap-1', missionId: 'mission-1', planId: 'plan-1', planRevision: 4, invariantRevision: 2,
    repositoryFingerprint: canonicalSha256({ root: repo.root, head: repo.head }), goal: 'finish feature', completedCriterionIds: ['c1'],
    decisionReceiptIds: ['d1'], changedSymbolIds: ['symbol:api'], verificationReceiptIds: ['v1'], residualRisks: ['none'],
    gitCheckpoint: repo.head, nextStepIds: ['step-2'],
  });
  assert.match(saved.receiptSha256, /^[a-f0-9]{64}$/);

  const second = new ConstructionContractRuntime({ workspaceRoot: repo.root, stateRoot });
  const restored = await second.restoreState('cap-1', {
    repositoryFingerprint: canonicalSha256({ root: repo.root, head: repo.head }), gitCheckpoint: repo.head,
    planRevision: 4, invariantRevision: 2,
  });
  assert.equal(restored.status, 'resumable');
  assert.deepEqual(restored.capsule.nextStepIds, ['step-2']);
  assert.equal(restored.exactMatch, true);
  await assert.rejects(() => second.restoreState('cap-1', {
    repositoryFingerprint: canonicalSha256({ root: repo.root, head: repo.head }), gitCheckpoint: '0'.repeat(40),
    planRevision: 4, invariantRevision: 2,
  }), /state capsule cannot resume exactly/);
});
