import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECKPOINT_7_HELDOUT_PACKS } from '../src/small-model/checkpoint-7-heldout-pack.mjs';
import { BestCandidateLedger } from '../src/small-model/best-candidate-ledger.mjs';
import { MissionTrajectoryEngine } from '../src/small-model/mission-trajectory-engine.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GO_AVAILABLE = spawnSync(process.env.GO_BINARY || 'go', ['version'], {
  stdio: 'ignore',
  windowsHide: true,
}).status === 0;
const GO_SKIP = GO_AVAILABLE ? undefined : 'Go executable is unavailable on this host';

test('best candidate ledger never replaces a verified candidate with a regression', () => {
  const ledger = new BestCandidateLedger({ missionId: 'm1' });
  const first = ledger.consider({ candidateId: 'c1', sourceSha256: 'a'.repeat(64), verified: true, score: 5, stepId: 's1' });
  const regression = ledger.consider({ candidateId: 'c2', sourceSha256: 'b'.repeat(64), verified: false, score: 10, stepId: 's2' });
  assert.equal(first.accepted, true);
  assert.equal(regression.accepted, false);
  assert.equal(ledger.best().candidateId, 'c1');
  assert.equal(ledger.snapshot().regressionsRejected, 1);
});

test('mission trajectory executes baseline mutation failure repair recovery and preserves source', { skip: GO_SKIP }, async () => {
  const engine = new MissionTrajectoryEngine({ trainingRepositoryIds: ['nolane-root', 'go-launcher', 'python-sdk'] });
  for (const pack of CHECKPOINT_7_HELDOUT_PACKS) {
    const result = await engine.run({ root, pack });
    assert.equal(result.status, 'verified-recovery');
    assert.ok(result.steps.length >= 7);
    assert.deepEqual(result.steps.map((step) => step.phase), ['inspect','baseline-test','mutate','mutation-test','repair','recovery-test','final-integrity']);
    assert.equal(result.steps[1].verifier.valid, true);
    assert.equal(result.steps[3].actualEffect.exitCode, pack.expected.mutationExitCode);
    assert.equal(result.steps[5].actualEffect.exitCode, 0);
    assert.equal(result.bestCandidate.sourceSha256, pack.sourceSha256);
    assert.equal(result.bestCandidatePreserved, true);
    assert.equal(result.trackedSourceUnchanged, true);
    assert.equal(result.workspaceRemoved, true);
    assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
  }
});

test('mission trajectory fails closed when observed verifier outcome differs from the declaration', async () => {
  const pack = structuredClone(CHECKPOINT_7_HELDOUT_PACKS[0]);
  pack.expected.mutationExitCode = 2;
  const engine = new MissionTrajectoryEngine({ trainingRepositoryIds: [] });
  await assert.rejects(() => engine.run({ root, pack }), /verifier outcome|expected exit/i);
});
