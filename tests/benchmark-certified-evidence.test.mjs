import test from 'node:test';
import assert from 'node:assert/strict';
import { BenchmarkRunner } from '../src/benchmark/benchmark-runner.mjs';
import { BenchmarkScorer } from '../src/benchmark/benchmark-scorer.mjs';
import { RunEvidenceJournal } from '../src/benchmark/run-evidence-journal.mjs';
import { classifyBenchmarkFailure } from '../src/benchmark/failure-taxonomy.mjs';

const sha = (c) => c.repeat(64);

test('runner records certified resource correction and artifact evidence without raw commands', async () => {
  const runner = new BenchmarkRunner({
    workspaceFactory: async () => '/tmp/bench-workspace',
    processRunner: async ({ kind }) => kind === 'agent' ? {
      exitCode: 0, durationMs: 100, stdout: 'ok', stderr: '', patch: 'diff',
      usage: { tokens: 1000, costUsd: 0.1 },
      adapterVersion: '1.2.3', providerKind: 'real', modelDigest: sha('a'), environmentManifestHash: sha('b'),
      resources: { peakRssBytes: 256 * 1024 * 1024, rssMbSeconds: 512, processCount: 3 },
      corrections: { cycles: 2, revertedLines: 4, humanInterventions: 1 },
      firstPatchPassed: false, retainedPatch: true, verifiedCriteria: 3, totalCriteria: 4, regressions: 0,
      commandFingerprints: [sha('c')], artifacts: [{ kind: 'patch', sha256: sha('d') }],
    } : { exitCode: 0, durationMs: 10, stdout: 'pass', stderr: '' },
  });
  const task = { id: 't1', version: 1, objective: 'Fix bug', budgets: { timeoutMs: 1000, maxTokens: 2000, maxCostUsd: 1, maxRssMb: 512, maxProcesses: 4 }, verify: [{ command: 'node', args: [], timeoutMs: 1000 }] };
  const run = await runner.runTask({ system: 'Forge', adapter: { command: 'forge', args: [], env: {}, version: '1.2.3', providerKind: 'real', modelDigest: sha('a') }, task, seed: 1 });
  assert.equal(run.resources.peakRssMb, 256);
  assert.equal(run.corrections.cycles, 2);
  assert.equal(run.keepRateEligible, true);
  assert.equal(run.firstPatchPassed, false);
  assert.equal(Object.hasOwn(run, 'rawCommand'), false);
  assert.equal(run.artifacts[0].sha256, sha('d'));
});

test('evidence journal signs bounded normalized run evidence and classifies failures', () => {
  const journal = new RunEvidenceJournal();
  const entry = journal.record({ system: 'Forge', taskId: 't1', verified: false, agentExitCode: 137, budgetExceeded: false, resources: { peakRssMb: 1024 }, stderr: 'secret=do-not-store' });
  assert.equal(entry.failureClass, 'resource-exhaustion');
  assert.equal(JSON.stringify(entry).includes('do-not-store'), false);
  assert.equal(classifyBenchmarkFailure({ verified: false, budgetExceeded: true }).code, 'budget-exceeded');
});

test('scorer reports verified criteria regressions resource correction keep rate variance and confidence', () => {
  const scorer = new BenchmarkScorer();
  const runs = [
    { system: 'Forge', taskId: 'a', verified: true, durationMs: 100, verifiedCriteria: 4, totalCriteria: 4, regressions: 0, resources: { peakRssMb: 100, rssMbSeconds: 200, processCount: 2 }, corrections: { cycles: 0, revertedLines: 0, humanInterventions: 0 }, firstPatchPassed: true, retainedPatch: true, usage: { tokens: 100, costUsd: 0.1 } },
    { system: 'Forge', taskId: 'b', verified: false, durationMs: 300, verifiedCriteria: 2, totalCriteria: 4, regressions: 1, resources: { peakRssMb: 200, rssMbSeconds: 600, processCount: 4 }, corrections: { cycles: 2, revertedLines: 5, humanInterventions: 1 }, firstPatchPassed: false, retainedPatch: false, usage: { tokens: 300, costUsd: 0.3 } },
  ];
  const score = scorer.scoreSystem(runs);
  assert.equal(score.passAt1, 0.5);
  assert.equal(score.verifiedCriteria, 0.75);
  assert.equal(score.regressionRate, 0.5);
  assert.equal(score.peakRssMb, 150);
  assert.equal(score.correctionCycles, 1);
  assert.equal(score.keepRate, 0.5);
  assert.ok(score.latencyVariance > 0);
});
