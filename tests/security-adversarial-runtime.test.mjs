import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SandboxEscapeAdversarialSuite } from '../src/security/sandbox-escape-adversarial-suite.mjs';
import { ExtendedFailureScenarioLab } from '../src/verification/extended-failure-scenario-lab.mjs';

const sha = (c) => c.repeat(64);
const signed = (extra = {}) => ({ ...extra, receiptSha256: sha('a') });

test('sandbox escape suite detects traversal and symlink escape and records adapter escape attempts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-sandbox-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'forge-outside-'));
  await writeFile(path.join(outside, 'secret.txt'), 'outside');
  await mkdir(path.join(root, 'inside'));
  await symlink(outside, path.join(root, 'inside', 'link'));
  const suite = new SandboxEscapeAdversarialSuite();
  const report = await suite.run({
    root,
    scenarios: ['path-traversal', 'encoded-traversal', 'symlink-escape', 'child-process-escape', 'environment-leakage', 'socket-escape', 'credential-escape'],
    adapter: {
      async attempt({ scenario }) { return signed({ scenario, blocked: true, escaped: false, details: `${scenario}-blocked` }); },
    },
  });
  assert.equal(report.status, 'pass');
  assert.equal(report.results.length, 7);
  assert.ok(report.results.every((result) => result.blocked && !result.escaped));
  assert.equal(report.claims.destructiveHostEscapeAttempted, false);
});

test('extended failure lab requires bounded cleanup, resume, and criterion reverification', async () => {
  const lab = new ExtendedFailureScenarioLab({ clock: (() => { let n = 100; return () => ++n; })() });
  const report = await lab.run({
    taskId: 't1', criterionId: 'c1', scenario: 'fd-exhaustion',
    checkpointAdapter: { save: async () => signed({ checkpointId: 'cp1', sourceHash: sha('b') }), resume: async () => signed({ status: 'pass', checkpointId: 'cp1' }) },
    faultAdapter: { inject: async () => signed({ status: 'injected', reversible: true }), clear: async () => signed({ status: 'pass' }) },
    operation: async () => signed({ status: 'failed', irreversibleActions: 0 }),
    recoveryAdapter: { recover: async () => signed({ status: 'pass', strategy: 'close-idle-fds' }) },
    verify: async () => signed({ status: 'pass', criterionId: 'c1' }),
  });
  assert.equal(report.status, 'pass');
  assert.equal(report.scenario, 'fd-exhaustion');
  assert.equal(report.claims.directHostFaultInjected, false);
});
