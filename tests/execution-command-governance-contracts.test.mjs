import test from 'node:test';
import assert from 'node:assert/strict';
import { AutonomyPolicy } from '../src/security/autonomy-policy.mjs';
import { CommandRiskClassifier } from '../src/security/command-risk-classifier.mjs';

const policy = new AutonomyPolicy();

test('command governance allows reversible local development operations', () => {
  const read = policy.evaluate({ kind: 'process.run', readOnly: true, commandClass: 'git-read' }, { profile: 'workspace-autopilot', withinWorkspace: true, inManagedWorktree: true });
  assert.equal(read.decision, 'allow');
  const testRun = policy.evaluate({ kind: 'process.run', commandClass: 'test' }, { profile: 'workspace-autopilot', withinWorkspace: true, inManagedWorktree: true });
  assert.equal(testRun.decision, 'allow');
  const classification = new CommandRiskClassifier().classify({ command: 'node', args: ['--test', 'tests/app.test.mjs'] });
  assert.deepEqual(classification.categories, []);
});

test('command governance rejects or requires approval for dangerous external operations', () => {
  const destroy = policy.evaluate({ kind: 'database.destroy', reversible: false }, { profile: 'workspace-autopilot', withinWorkspace: true, inManagedWorktree: true });
  assert.equal(destroy.decision, 'ask'); assert.equal(destroy.hardStop, true);
  const outside = policy.evaluate({ kind: 'process.run', commandClass: 'arbitrary' }, { profile: 'workspace-autopilot', withinWorkspace: false, inManagedWorktree: false });
  assert.equal(outside.decision, 'ask');
  const classification = new CommandRiskClassifier().classify({ command: 'psql', args: ['-c', 'DROP DATABASE production'] });
  assert.ok(classification.categories.includes('dangerous-sql'));
  assert.ok(classification.requiredCapabilities.includes('database.mutate'));
});
