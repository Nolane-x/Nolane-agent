import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { ConstructionContractRuntime } from '../src/construction/construction-contract-runtime.mjs';
import { SemanticChangeSafetyRuntime } from '../src/construction/semantic-change-safety-runtime.mjs';

const execFileAsync = promisify(execFile);
const SOURCE_HASH = canonicalSha256('source');
const citation = (pathValue, line = 1) => ({ path: pathValue, line, sourceHash: SOURCE_HASH });
async function git(cwd, args) { return execFileAsync('git', args, { cwd, windowsHide: true }); }
async function makeRepo(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-semantic-safety-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await git(root, ['init', '-q']); await git(root, ['config', 'user.email', 'test@example.invalid']); await git(root, ['config', 'user.name', 'Forge Test']);
  await mkdir(path.join(root, 'src'), { recursive: true }); await writeFile(path.join(root, 'src', 'api.mjs'), 'export function run(value = 1) { return value; }\n');
  await git(root, ['add', '.']); await git(root, ['commit', '-qm', 'baseline']);
  return root;
}

test('semantic API diff covers signature type error default event and side effect', () => {
  const runtime = new SemanticChangeSafetyRuntime();
  const report = runtime.diffApi({
    before: [{ symbolId: 'run', signature: 'run(value?: number): number', type: 'function', errors: ['E_OLD'], defaultValue: '1', events: ['done'], sideEffects: ['read:file'], citation: citation('src/api.mjs') }],
    after: [{ symbolId: 'run', signature: 'run(value: string): string', type: 'function', errors: ['E_NEW'], defaultValue: null, events: ['complete'], sideEffects: ['write:file'], citation: citation('src/api.mjs', 2) }],
  });
  assert.deepEqual([...report.dimensionsChanged].sort(), ['default','errors','events','side-effects','signature'].sort());
  assert.equal(report.breaking, true);
  assert.equal(report.changes[0].symbolId, 'run');
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});

test('blast radius requires cited caller test schema and runtime evidence', () => {
  const runtime = new SemanticChangeSafetyRuntime();
  const report = runtime.blastRadius({
    changedSymbolIds: ['symbol:run'],
    callerEdges: [{ from: 'symbol:caller', to: 'symbol:run', citation: citation('src/caller.mjs') }],
    testEdges: [{ from: 'test:run', to: 'symbol:run', citation: citation('tests/run.test.mjs') }],
    schemaEdges: [{ from: 'schema:jobs', to: 'symbol:run', citation: citation('schema.sql') }],
    runtimeEdges: [{ from: 'request:/run', to: 'symbol:run', citation: citation('runtime.receipt.json') }],
  });
  assert.deepEqual(report.impacted.callers, ['symbol:caller']);
  assert.deepEqual(report.impacted.tests, ['test:run']);
  assert.deepEqual(report.impacted.schemas, ['schema:jobs']);
  assert.deepEqual(report.impacted.runtime, ['request:/run']);
  assert.equal(report.uncitedEdgesRejected, 0);
  const rejected = runtime.blastRadius({ changedSymbolIds: ['symbol:run'], callerEdges: [{ from: 'bad', to: 'symbol:run' }] });
  assert.equal(rejected.uncitedEdgesRejected, 1);
  assert.equal(rejected.complete, false);
});

test('existing abstraction and migration impact fail closed', () => {
  const runtime = new SemanticChangeSafetyRuntime({ duplicateThreshold: 0.7 });
  const duplicate = runtime.detectExistingAbstraction({
    proposedName: 'normalizeUser', proposedBehavior: 'trim lowercase validate email',
    symbols: [
      { symbolId: 'normalizeEmail', name: 'normalizeEmail', behavior: 'trim lowercase validate email', citation: citation('src/email.mjs') },
      { symbolId: 'hashPassword', name: 'hashPassword', behavior: 'salt hash password', citation: citation('src/password.mjs') },
    ],
  });
  assert.equal(duplicate.allowCreate, false);
  assert.equal(duplicate.matches[0].symbolId, 'normalizeEmail');

  const blocked = runtime.migrationImpact({ schemaChanges: ['jobs.status enum'], configChanges: ['QUEUE_MODE'], migrations: [] });
  assert.equal(blocked.status, 'blocked');
  assert.ok(blocked.requirements.includes('forward-migration'));
  assert.ok(blocked.requirements.includes('rollback-plan'));
  const ready = runtime.migrationImpact({ schemaChanges: ['jobs.status enum'], configChanges: ['QUEUE_MODE'], migrations: ['20260731_jobs_status.sql'], rollbackPlan: { steps: ['restore enum', 'restore config'], verificationReceiptSha256: canonicalSha256('rollback') } });
  assert.equal(ready.status, 'ready');
});

test('candidate comparison runs the same verification contract in real isolated worktrees', async (t) => {
  const root = await makeRepo(t);
  const contractRuntime = new ConstructionContractRuntime({ workspaceRoot: root, stateRoot: path.join(root, '.forge-state') });
  const contract = canonicalSha256({ checks: ['parse', 'test'] });
  const set = await contractRuntime.launchCandidates({ verificationContractSha256: contract, candidates: [{ candidateId: 'small' }, { candidateId: 'large' }] });
  t.after(() => contractRuntime.cleanupCandidates(set));
  await writeFile(path.join(set.candidates[0].worktreePath, 'src', 'api.mjs'), 'export function run(value = 1) { return value + 1; }\n');
  await writeFile(path.join(set.candidates[1].worktreePath, 'src', 'api.mjs'), 'export function run(value = 1) { const next = value + 1; return next; }\n');

  const runtime = new SemanticChangeSafetyRuntime();
  const comparison = await runtime.compareCandidates({
    verificationContractSha256: contract,
    candidates: set.candidates,
    verifyCandidate: async ({ candidateId, worktreePath }) => ({
      verificationContractSha256: contract, status: 'pass', verifiedCriteriaScore: 10, requiredCriteriaScore: 10,
      criticalInvariantFailures: 0, regressionFailures: 0, semanticFootprint: candidateId === 'small' ? 1 : 3,
      changedLines: candidateId === 'small' ? 1 : 2, tokenCost: 5, rssMbSeconds: 2, editCost: 1,
      receiptSha256: canonicalSha256({ candidateId, worktreePath }),
    }),
  });
  assert.equal(comparison.selectedCandidateId, 'small');
  assert.equal(comparison.candidates.every((item) => item.isolated && item.cleanBase), true);
});

test('public API security and multi-module contract changes require independent review', () => {
  const runtime = new SemanticChangeSafetyRuntime();
  const denied = runtime.reviewGate({ executorId: 'agent-a', changeKinds: ['public-api'], risk: 0.9 });
  assert.equal(denied.status, 'blocked');
  const deniedSame = runtime.reviewGate({ executorId: 'agent-a', changeKinds: ['security'], risk: 0.9, reviewReceipt: { reviewerId: 'agent-a', providerId: 'provider-b', status: 'approved', receiptSha256: canonicalSha256('review') } });
  assert.equal(deniedSame.status, 'blocked');
  const approved = runtime.reviewGate({ executorId: 'agent-a', executorProviderId: 'provider-a', changeKinds: ['multi-module-contract'], risk: 0.9, reviewReceipt: { reviewerId: 'agent-b', providerId: 'provider-b', status: 'approved', receiptSha256: canonicalSha256('review') } });
  assert.equal(approved.status, 'approved');
  assert.equal(approved.independent, true);
});
