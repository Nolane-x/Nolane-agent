import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { PlaywrightCliDriver } from '../src/browser/playwright-cli-driver.mjs';
import { BrowserAgentService } from '../src/browser/browser-agent-service.mjs';

function fakeDriver() {
  const calls = [];
  return {
    calls,
    async detect() { return { available: true, command: 'playwright-cli', prefixArgs: [], version: '0.1.16' }; },
    async run(input) {
      calls.push(structuredClone(input));
      if (input.args.includes('list')) return { exitCode: 0, stdout: JSON.stringify([{ name: input.sessionName, url: 'https://example.com', title: 'Example' }]), stderr: '', durationMs: 5 };
      return { exitCode: 0, stdout: '### Page\n- Page URL: https://example.com\n- button "Continue" [ref=e3]', stderr: '', durationMs: 8 };
    },
  };
}

test('PlaywrightCliDriver detects global then local official CLI without shell execution', async () => {
  const calls = [];
  const driver = new PlaywrightCliDriver({
    runProcess: async ({ executable, args }) => {
      calls.push({ executable, args });
      if (executable === 'playwright-cli') return { exitCode: 127, stdout: '', stderr: 'missing' };
      return { exitCode: 0, stdout: 'Version 0.1.16\n', stderr: '' };
    },
  });
  const detected = await driver.detect();
  assert.equal(detected.available, true);
  assert.equal(detected.command, 'npx');
  assert.deepEqual(detected.prefixArgs, ['--no-install', 'playwright-cli']);
  assert.deepEqual(calls, [
    { executable: 'playwright-cli', args: ['--version'] },
    { executable: 'npx', args: ['--no-install', 'playwright-cli', '--version'] },
  ]);
});

test('BrowserAgentService isolates named persistent sessions and returns bounded untrusted snapshots', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-browser-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const driver = fakeDriver();
  const project = { id: 'project_1', workspaceRoot: path.join(root, 'workspace') };
  const service = new BrowserAgentService({ driver, browserRoot: path.join(root, 'browser'), getProject: (id) => id === project.id ? project : null, maxOutputBytes: 256 });

  const opened = await service.open({ projectId: project.id, url: 'https://www.youtube.com/watch?v=abc', headed: true });
  assert.equal(opened.available, true);
  assert.equal(opened.untrusted, true);
  assert.ok(driver.calls[0].args.includes('--headed'));
  assert.ok(driver.calls[0].args.some((arg) => arg.startsWith('--profile=')));
  assert.match(driver.calls[0].sessionName, /^forge-project-1-/);

  const snap = await service.snapshot({ projectId: project.id, depth: 3 });
  assert.equal(snap.untrusted, true);
  assert.match(snap.output, /Continue/);
  assert.deepEqual(driver.calls[1].args, ['snapshot', '--depth=3']);

  await service.click({ projectId: project.id, target: 'e3' });
  assert.deepEqual(driver.calls[2].args, ['click', 'e3']);
  const status = await service.status({ projectId: project.id });
  assert.equal(status.sessions[0].title, 'Example');
});

test('BrowserAgentService rejects unsafe URLs, traversal artifacts, oversized inputs, and missing drivers', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-browser-policy-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = { id: 'p', workspaceRoot: root };
  const missing = { detect: async () => ({ available: false, reason: 'not installed' }), run: async () => { throw new Error('should not run'); } };
  const service = new BrowserAgentService({ driver: missing, browserRoot: path.join(root, 'browser'), getProject: () => project });
  await assert.rejects(() => service.open({ projectId: 'p', url: 'javascript:alert(1)' }), /URL|protocol/i);
  await assert.rejects(() => service.open({ projectId: 'p', url: 'file:///etc/passwd' }), /URL|protocol/i);
  await assert.rejects(() => service.open({ projectId: 'p', url: 'https://example.com' }), /Playwright CLI.*not installed/i);
  const ready = new BrowserAgentService({ driver: fakeDriver(), browserRoot: path.join(root, 'browser2'), getProject: () => project });
  await assert.rejects(() => ready.fill({ projectId: 'p', target: 'e1', text: 'x'.repeat(100_001) }), /too long/i);
  await assert.rejects(() => ready.screenshot({ projectId: 'p', filename: '../escape.png' }), /filename/i);
});

test('BrowserAgentService serves only bounded project-scoped screenshot artifacts', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-browser-artifact-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = { id: 'artifact-project', workspaceRoot: root };
  const driver = {
    async detect() { return { available: true, command: 'playwright-cli', prefixArgs: [], version: '0.1.16' }; },
    async run(input) {
      if (input.args[0] === 'screenshot') await writeFile(input.args.find((item) => item.startsWith('--filename='))?.slice('--filename='.length), Buffer.from('fake-png'));
      return { exitCode: 0, stdout: '', stderr: '', durationMs: 1 };
    },
  };
  const service = new BrowserAgentService({ driver, browserRoot: path.join(root, 'browser'), getProject: (id) => id === project.id ? project : null });
  await service.screenshot({ projectId: project.id, filename: 'workspace.png' });
  const artifact = await service.artifact({ projectId: project.id, filename: 'workspace.png' });
  assert.equal(artifact.mimeType, 'image/png');
  assert.equal(artifact.bytes, 8);
  assert.equal(artifact.contentBase64, Buffer.from('fake-png').toString('base64'));
  assert.match(artifact.sha256, /^[a-f0-9]{64}$/);
  await assert.rejects(() => service.artifact({ projectId: project.id, filename: '../workspace.png' }), /filename/i);
});
