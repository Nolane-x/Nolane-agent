import test from 'node:test';
import assert from 'node:assert/strict';

import { AUTONOMY_PROFILES, AutonomyPolicy } from '../src/security/autonomy-policy.mjs';

const policy = new AutonomyPolicy();

test('guided mode asks before state-changing actions but allows bounded reads', () => {
  assert.equal(policy.evaluate({ kind: 'fs.read', path: 'src/app.mjs' }, { profile: 'guided', withinWorkspace: true }).decision, 'allow');
  assert.equal(policy.evaluate({ kind: 'fs.patch', path: 'src/app.mjs' }, { profile: 'guided', withinWorkspace: true }).decision, 'ask');
  assert.equal(policy.evaluate({ kind: 'process.run', commandClass: 'test' }, { profile: 'guided', withinWorkspace: true }).decision, 'ask');
});

test('workspace autopilot automatically allows reversible worktree actions and bounded development commands', () => {
  for (const action of [
    { kind: 'fs.patch', path: 'src/app.mjs', reversible: true },
    { kind: 'fs.write', path: 'tests/app.test.mjs', reversible: true },
    { kind: 'process.run', commandClass: 'test' },
    { kind: 'process.run', commandClass: 'build' },
    { kind: 'process.run', commandClass: 'dependency-install', network: 'allowlisted' },
    { kind: 'git.operation', operation: 'commit', reversible: true },
  ]) {
    const result = policy.evaluate(action, { profile: 'workspace-autopilot', withinWorkspace: true, inManagedWorktree: true });
    assert.equal(result.decision, 'allow', `${action.kind}:${action.commandClass ?? action.operation ?? action.path}`);
  }
});

test('autopilot profiles keep irreversible, secret, external, and out-of-scope actions behind hard stops', () => {
  const cases = [
    [{ kind: 'deploy', environment: 'production' }, { withinWorkspace: true, inManagedWorktree: true }],
    [{ kind: 'credential.export' }, { withinWorkspace: true, inManagedWorktree: true }],
    [{ kind: 'purchase', amount: 1 }, { withinWorkspace: true, inManagedWorktree: true }],
    [{ kind: 'message.send', target: 'third-party' }, { withinWorkspace: true, inManagedWorktree: true }],
    [{ kind: 'database.destroy', environment: 'production' }, { withinWorkspace: true, inManagedWorktree: true }],
    [{ kind: 'fs.delete', path: '../outside', reversible: false }, { withinWorkspace: false, inManagedWorktree: false }],
  ];
  for (const profile of ['workspace-autopilot', 'sandbox-autopilot']) {
    for (const [action, context] of cases) {
      const result = policy.evaluate(action, { profile, ...context });
      assert.notEqual(result.decision, 'allow', `${profile}:${action.kind}`);
      assert.equal(result.hardStop, true, `${profile}:${action.kind}`);
    }
  }
});

test('workspace autopilot never treats an outbound web fetch as a read-only operation', () => {
  const result = policy.evaluate(
    { kind: 'web.fetch' },
    { profile: 'workspace-autopilot', withinWorkspace: true, inManagedWorktree: true },
  );
  assert.equal(result.decision, 'ask');
  assert.equal(result.category, 'unknown-action');
});

test('sandbox autopilot requires sandbox containment and exports immutable profile descriptors', () => {
  assert.equal(policy.evaluate({ kind: 'process.run', commandClass: 'arbitrary' }, { profile: 'sandbox-autopilot', inSandbox: true }).decision, 'allow');
  assert.equal(policy.evaluate({ kind: 'process.run', commandClass: 'arbitrary' }, { profile: 'sandbox-autopilot', inSandbox: false }).decision, 'ask');
  assert.deepEqual(Object.keys(AUTONOMY_PROFILES), ['guided', 'workspace-autopilot', 'sandbox-autopilot']);
  assert.ok(Object.isFrozen(AUTONOMY_PROFILES));
  assert.ok(Object.isFrozen(AUTONOMY_PROFILES['workspace-autopilot']));
});
