import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';

import {
  EXTERNAL_GATE_CLASSES,
  collectExternalGateEvidence,
  probeCredentialHelper,
  probeWindowsJobObjectLifecycle,
} from '../src/release/external-gate-evidence.mjs';

test('external gate inventory classifies all 56 checklist gates without promoting contracts to runtime proof', async (t) => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'nolane-external-gates-'));
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));
  const outputFile = path.join(outputDirectory, 'windows.json');

  const report = await collectExternalGateEvidence({
    rootDirectory: path.resolve('.'),
    version: '5.0.0-beta.6',
    outputFile,
    environment: {
      platform: 'win32', arch: 'x64', node: 'v22.12.0',
      githubActions: false, githubEventName: '', githubRepository: '', githubRef: '', runnerOs: 'Windows',
    },
    runtimeProbes: async () => ({
      treeSitter: { available: false, reason: 'not-installed' },
      podman: { available: false, reason: 'not-installed' },
      windowsJobObjects: { available: true, version: 'test' },
      macOsSandbox: { available: false, reason: 'wrong-platform' },
      osKeychain: { available: true, backend: 'windows-credential-manager' },
    }),
  });

  assert.equal(report.totalExternalGates, 56);
  assert.deepEqual(report.classSummary, {
    runner_os: 2,
    github_lifecycle: 8,
    managed_cloud: 35,
    native_runtime: 8,
    os_keychain: 1,
    provider_credentials: 2,
  });
  assert.equal(Object.keys(EXTERNAL_GATE_CLASSES).length, 56);
  assert.equal(report.gates.find((gate) => gate.id === '21.6').observation, 'observed');
  assert.equal(report.gates.find((gate) => gate.id === '25.6').observation, 'observed');
  assert.equal(report.gates.find((gate) => gate.id === '13.27').observation, 'runtime-unavailable');
  assert.equal(report.gates.find((gate) => gate.id === '22.24').observation, 'requires-managed-infrastructure');
  assert.equal(report.gates.find((gate) => gate.id === '26.39').observation, 'requires-provider-credentials');
  assert.equal(report.gates.some((gate) => gate.observation === 'verified_source_test'), false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.parse(await readFile(outputFile, 'utf8')).receiptSha256, report.receiptSha256);
});

test('GitHub runner evidence is bounded to the event actually observed', async () => {
  const report = await collectExternalGateEvidence({
    rootDirectory: path.resolve('.'),
    version: '5.0.0-beta.6',
    environment: {
      platform: 'linux', arch: 'x64', node: 'v22.12.0',
      githubActions: true, githubEventName: 'push', githubRepository: 'Nolane-x/Nolane-agent',
      githubRef: 'refs/heads/codex/external-gate-evidence', runnerOs: 'Linux',
    },
    runtimeProbes: async () => ({
      treeSitter: { available: true, version: '0.25.0' },
      podman: { available: true, version: '5.0.0' },
      windowsJobObjects: { available: false, reason: 'wrong-platform' },
      macOsSandbox: { available: false, reason: 'wrong-platform' },
      osKeychain: { available: false, reason: 'not-configured' },
    }),
  });

  assert.equal(report.gates.find((gate) => gate.id === '2.27').observation, 'observed');
  assert.equal(report.gates.find((gate) => gate.id === '26.38').observation, 'observed');
  assert.equal(report.gates.find((gate) => gate.id === '2.17').observation, 'not-observed');
  assert.equal(report.gates.find((gate) => gate.id === '1.8').observation, 'observed-on-linux');
});

test('credential helper proof performs a disposable round trip and reports no secret material', async () => {
  const calls = [];
  let stored = null;
  const result = await probeCredentialHelper({
    command: 'fake-helper',
    accessImpl: async () => {},
    clientFactory: () => ({
      async start() { calls.push('start'); return { protocolVersion: 1, backend: 'test-keychain' }; },
      async set(input) { calls.push('set'); stored = input.secret; return { present: true }; },
      async resolve() { calls.push('resolve'); return stored; },
      async delete() { calls.push('delete'); stored = null; return true; },
      async close() { calls.push('close'); },
    }),
  });

  assert.equal(result.available, true);
  assert.equal(result.roundTrip, true);
  assert.equal(result.cleanup, true);
  assert.equal(result.backend, 'test-keychain');
  assert.equal(JSON.stringify(result).includes(String(stored)), false);
  assert.deepEqual(calls, ['start', 'set', 'resolve', 'delete', 'close']);
});

test('Windows Job Object proof creates, attaches, terminates, and observes disposable child cleanup', async () => {
  const calls = [];
  const child = Object.assign(new EventEmitter(), { pid: 4242, exitCode: null, signalCode: null, kill() { calls.push('kill'); } });
  const result = await probeWindowsJobObjectLifecycle({
    platform: 'win32',
    helperPath: 'ForgeJobObject.exe',
    childFactory: () => child,
    driver: {
      async capabilities() { calls.push('capabilities'); return { available: true, version: 'test' }; },
      async create() { calls.push('create'); },
      async attach({ pid }) { calls.push(`attach:${pid}`); },
      async terminate() { calls.push('terminate'); child.exitCode = 1; child.emit('exit', 1, null); },
    },
  });

  assert.equal(result.available, true);
  assert.equal(result.lifecycle, true);
  assert.equal(result.childTerminated, true);
  assert.deepEqual(calls, ['capabilities', 'create', 'attach:4242', 'terminate']);
});
