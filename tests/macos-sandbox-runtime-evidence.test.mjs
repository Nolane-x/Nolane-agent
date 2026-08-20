import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { MacOsSandboxDriver } from '../src/sandbox/macos-sandbox-driver.mjs';

const execFileAsync = promisify(execFile);
const enabled = process.env.NOLANE_RUNTIME_MACOS_SANDBOX_GATE === '1';

function execute(command, args) {
  return execFileAsync(command, args, { timeout: 10_000, maxBuffer: 128_000, windowsHide: true });
}

function sandboxId(prefix) {
  const suffix = `${process.env.GITHUB_RUN_ID ?? Date.now()}-${process.pid}`.replace(/[^A-Za-z0-9_.-]+/g, '-');
  return `${prefix}-${suffix}`.slice(0, 120);
}

test('real macOS sandbox permits only the prepared workspace path', { skip: !enabled }, async (context) => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'nolane-macos-sandbox-workspace-'));
  const outsideRoot = await mkdtemp(path.join(os.tmpdir(), 'nolane-macos-sandbox-outside-'));
  const driver = new MacOsSandboxDriver({ profileRoot: path.join(workspaceRoot, 'profiles') });
  let primaryError = null;
  try {
    assert.equal((await driver.capabilities()).available, true);

    const permittedPath = path.join(workspaceRoot, 'permitted.txt');
    const permitted = await driver.prepare({
      id: sandboxId('allowed'),
      workspaceRoot,
      command: ['/usr/bin/touch', permittedPath],
      allowNetwork: false,
    });
    assert.equal(permitted.network, 'deny');
    assert.match(permitted.profile, /\(deny default\)/);
    assert.match(permitted.profile, /\(deny network\*\)/);
    await execute(permitted.command, permitted.args);
    await access(permittedPath);

    const deniedPath = path.join(outsideRoot, 'denied.txt');
    const denied = await driver.prepare({
      id: sandboxId('denied'),
      workspaceRoot,
      command: ['/usr/bin/touch', deniedPath],
      allowNetwork: false,
    });
    await assert.rejects(execute(denied.command, denied.args));
    await assert.rejects(access(deniedPath), (error) => error?.code === 'ENOENT');
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    for (const directory of [workspaceRoot, outsideRoot]) {
      try {
        await rm(directory, { recursive: true, force: true });
      } catch (cleanupError) {
        if (primaryError) context.diagnostic(`macOS sandbox cleanup after primary failure also failed: ${cleanupError.message}`);
        else throw cleanupError;
      }
    }
  }
});
