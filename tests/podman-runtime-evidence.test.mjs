import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { PodmanSandboxDriver } from '../src/sandbox/podman-sandbox-driver.mjs';

const execFileAsync = promisify(execFile);
const enabled = process.env.NOLANE_RUNTIME_PODMAN_GATE === '1';

function runPodman(args) {
  return execFileAsync('podman', args, { timeout: 30_000, maxBuffer: 256_000, windowsHide: true });
}

async function inspectPodman(containerId) {
  const { stdout = '' } = await runPodman(['inspect', containerId, '--format', 'json']);
  const [result] = JSON.parse(String(stdout));
  if (!result) throw new Error('Podman did not return an inspection record');
  return result;
}

function sandboxId() {
  const suffix = `${process.env.GITHUB_RUN_ID ?? Date.now()}-${process.pid}`.replace(/[^A-Za-z0-9_.-]+/g, '-');
  return `runtime-${suffix}`.slice(0, 120);
}

test('real Podman executes the bounded sandbox contract', { skip: !enabled }, async (context) => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'nolane-podman-runtime-'));
  const driver = new PodmanSandboxDriver();
  let containerId = null;
  let primaryError = null;
  try {
    const capabilities = await driver.capabilities();
    assert.equal(capabilities.available, true);
    const sandbox = await driver.create({
      id: sandboxId(),
      image: 'docker.io/library/busybox:1.36',
      workspaceRoot,
      limits: { cpuPercent: 100, memoryBytes: 134_217_728, processCount: 32 },
      command: ['/bin/true'],
      allowNetwork: false,
    });
    containerId = sandbox.containerId;
    assert.equal(sandbox.network, 'none');
    for (const option of ['--network=none', '--read-only', '--cap-drop=all', '--security-opt=no-new-privileges', '--pids-limit=32', '--cpus=1', '--memory=134217728']) {
      assert.ok(sandbox.argv.includes(option), `missing Podman isolation option: ${option}`);
    }

    assert.deepEqual(await driver.start(containerId), { containerId, state: 'started' });
    const inspected = await inspectPodman(containerId);
    assert.equal(inspected.State?.Status, 'exited');
    assert.equal(inspected.HostConfig?.NetworkMode, 'none');
    assert.equal(inspected.HostConfig?.ReadonlyRootfs, true);
    assert.equal(Number(inspected.HostConfig?.PidsLimit), 32);
    assert.equal(Number(inspected.HostConfig?.Memory), 134_217_728);
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    if (containerId) {
      try {
        await driver.remove(containerId);
      } catch (cleanupError) {
        if (primaryError) context.diagnostic(`Podman cleanup after primary failure also failed: ${cleanupError.message}`);
        else throw cleanupError;
      }
    }
    try {
      await rm(workspaceRoot, { recursive: true, force: true });
    } catch (cleanupError) {
      if (primaryError) context.diagnostic(`Temporary workspace cleanup after primary failure also failed: ${cleanupError.message}`);
      else throw cleanupError;
    }
  }
});
