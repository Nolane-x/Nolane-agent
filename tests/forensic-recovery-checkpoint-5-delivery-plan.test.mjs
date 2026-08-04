import test from 'node:test';
import assert from 'node:assert/strict';
import { createCheckpoint5DeliveryPlan } from '../src/forensics/checkpoint-5-delivery-plan.mjs';

test('checkpoint 5 delivery plan includes trajectory, five specialist and truth artifacts', () => {
  const plan = createCheckpoint5DeliveryPlan();
  assert.equal(plan.prefix, 'NolaneAgent-5.0.0-beta.6-forensic-recovery-checkpoint.5');
  assert.equal(plan.baselineCommit, 'a435c7fa9d75b53fe526f5abb9f41ab71873f976');
  assert.ok(plan.evidenceFiles.includes('datasets/trajectories/repository-v1/episodes.jsonl'));
  assert.ok(plan.evidenceFiles.includes('datasets/trajectories/repository-v1/receipt.json'));
  for (const specialist of ['tool-router','context-scorer','test-selector','patch-ranker','risk-classifier']) {
    assert.ok(plan.evidenceFiles.includes(`models/specialists-repository/${specialist}/repository-v1/model.json`));
    assert.ok(plan.evidenceFiles.includes(`models/specialists-repository/${specialist}/repository-v1/benchmark.json`));
    assert.ok(plan.evidenceFiles.includes(`models/specialists-repository/${specialist}/repository-v1/dataset-receipt.json`));
  }
  assert.ok(plan.outputSuffixes.includes('repository-trajectory-receipt.json'));
  assert.ok(plan.outputSuffixes.includes('repository-specialist-suite-verification.json'));
  assert.ok(plan.outputSuffixes.includes('safe-decision-support.json'));
  assert.ok(plan.outputSuffixes.includes('unsafe-decision-support.json'));
});
