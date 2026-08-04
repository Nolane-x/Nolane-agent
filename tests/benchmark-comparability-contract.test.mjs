import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBenchmarkSuite } from '../src/benchmark/benchmark-schema.mjs';
import { ComparabilityContract } from '../src/benchmark/comparability-contract.mjs';
import { ContaminationGuard } from '../src/benchmark/contamination-guard.mjs';

const sha = (c) => c.repeat(64);

function suiteV2() {
  return validateBenchmarkSuite({
    schemaVersion: 2,
    id: 'frontier-real-repos', version: 3, title: 'Real repository suite',
    distribution: { id: 'dist-2026-07', version: 2, fingerprint: sha('a'), public: true },
    environment: { machineFingerprint: sha('b'), platform: 'linux-x64', runtime: 'node-v22.16.0' },
    tasks: [{
      id: 'bug-auth-1', version: 2, category: 'bug', split: 'public', objective: 'Fix auth expiry.',
      repository: { sourceId: 'local:fixture-auth', commit: sha('c'), contentFingerprint: sha('d') },
      permissions: { network: 'deny', filesystem: 'workspace', shell: 'bounded' },
      budgets: { timeoutMs: 60_000, maxTokens: 12_000, maxCostUsd: 1, maxRssMb: 2048, maxProcesses: 8 },
      verify: [{ command: 'node', args: ['--test'], timeoutMs: 30_000 }],
      artifactPolicy: { retain: ['patch', 'verification', 'logs'], maxBytes: 1_000_000 },
    }],
  });
}

test('benchmark schema v2 locks repository distribution environment permissions and resource budgets', () => {
  const suite = suiteV2();
  assert.equal(suite.schemaVersion, 2);
  assert.equal(suite.tasks[0].category, 'bug');
  assert.equal(suite.tasks[0].repository.commit, sha('c'));
  assert.equal(suite.tasks[0].budgets.maxRssMb, 2048);
  assert.equal(suite.tasks[0].permissions.network, 'deny');
});

test('comparability contract rejects model, machine, budget, or permission mismatch', () => {
  const task = suiteV2().tasks[0];
  const base = { providerKind: 'real', modelDigest: sha('e'), machineFingerprint: sha('b'), platform: 'linux-x64', runtime: 'node-v22.16.0', budgets: task.budgets, permissions: task.permissions };
  const service = new ComparabilityContract();
  assert.equal(service.verify({ task, systems: [{ system: 'Forge', ...base }, { system: 'Codex', ...base }] }).status, 'pass');
  const mismatch = service.verify({ task, systems: [{ system: 'Forge', ...base }, { system: 'Codex', ...base, modelDigest: sha('f') }] });
  assert.equal(mismatch.status, 'reject');
  assert.ok(mismatch.reasons.includes('model-mismatch'));
});

test('contamination guard blocks hidden case fingerprints exposed to a system', () => {
  const guard = new ContaminationGuard();
  const report = guard.assess({
    caseId: 'hidden-1', split: 'private-held-out', caseFingerprint: sha('1'),
    exposedFingerprints: [sha('1')], disclosures: [{ system: 'Forge', status: 'none-known' }],
  });
  assert.equal(report.status, 'block');
  assert.ok(report.reasons.includes('hidden-case-fingerprint-exposed'));
  assert.equal(report.claims.contaminationProvenAbsent, false);
});
