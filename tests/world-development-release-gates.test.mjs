import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function exists(relative) { try { await access(path.resolve(relative)); return true; } catch { return false; } }

test('2.29 release gates prove bounded world models and developmental learning without autonomous promotion', async (t) => {
  for (const relative of [
    'src/release/world-model-portfolio-verifier.mjs',
    'src/release/developmental-agent-learning-verifier.mjs',
    'scripts/verify-world-model-portfolio.mjs',
    'scripts/verify-developmental-agent-learning.mjs',
    'scripts/measure-world-development.mjs',
    'docs/world-development-measurement-2.29.0.json',
    'docs/feature-audit-2.29.0.json',
    'docs/LIMITATIONS-2.29.0.md',
  ]) assert.equal(await exists(relative), true, `${relative} is missing`);
  const matrix = await readFile('src/release/full-release-matrix.mjs', 'utf8');
  assert.match(matrix, /id: 'world-model-portfolio'/);
  assert.match(matrix, /id: 'developmental-agent-learning'/);
  const audit = JSON.parse(await readFile('docs/feature-audit-2.29.0.json', 'utf8'));
  assert.equal(audit.totalItems, 1150);
  assert.deepEqual(audit.summary, { verified_source_test: 936, partial: 112, external_gate: 59, not_implemented: 43 });
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-229-world-gates-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const [{ verifyWorldModelPortfolio }, { verifyDevelopmentalAgentLearning }] = await Promise.all([
    import('../src/release/world-model-portfolio-verifier.mjs'),
    import('../src/release/developmental-agent-learning-verifier.mjs'),
  ]);
  const world = await verifyWorldModelPortfolio({ rootDirectory: path.resolve('.'), version: '2.29.0', outputFile: path.join(output, 'world.json') });
  const development = await verifyDevelopmentalAgentLearning({ rootDirectory: path.resolve('.'), version: '2.29.0', outputFile: path.join(output, 'development.json') });
  assert.equal(world.status, 'pass');
  assert.equal(world.measurement.worldModel.modelSelected, true);
  assert.equal(world.measurement.worldModel.simulationChosen, true);
  assert.equal(world.measurement.worldModel.realProbeFallback, true);
  assert.equal(world.measurement.counterfactual.unreliablePruned, true);
  assert.equal(world.measurement.counterfactual.cacheInvalidated, true);
  assert.equal(world.measurement.counterfactual.noCommitBoundary, true);
  assert.equal(development.status, 'pass');
  assert.equal(development.measurement.selfModel.unverifiedRejected, true);
  assert.equal(development.measurement.selfModel.toolTrustUpdated, true);
  assert.equal(development.measurement.development.zpdSelected, true);
  assert.equal(development.measurement.development.noveltyBlocked, true);
  assert.equal(development.measurement.development.stageAdvancedWithHeldOut, true);
  assert.equal(development.measurement.development.productionPromotionAllowed, false);
});
