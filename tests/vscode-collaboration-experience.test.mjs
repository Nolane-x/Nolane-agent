import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildVsCodeExtension } from '../scripts/build-vscode-extension.mjs';
const require = createRequire(import.meta.url);

test('VS Code client reads collaboration state and sends bounded review and steering decisions', async () => {
  await buildVsCodeExtension();
  const clientPath = path.resolve('extensions/vscode/extension/dist/client.js');
  delete require.cache[clientPath];
  const { NolaneAgentClient } = require(clientPath);
  const calls = [];
  const previousFetch = global.fetch;
  global.fetch = async (url, init = {}) => { calls.push({ url: String(url), init }); return { ok: true, status: 200, async json() { return { schema: 'forge.collaboration-experience-plane.v1' }; } }; };
  try {
    const client = new NolaneAgentClient({ baseUrl: 'http://127.0.0.1:8787', organizationId: 'local', workspaceId: 'default', projectId: 'p1' }, { async get() { return 'token'; }, async store() {}, async delete() {} });
    await client.getCollaborationExperience();
    await client.decideReviewItem({ itemId: 'r1', decision: 'approve', receiptSha256: 'a'.repeat(64) });
    await client.steerMission({ missionId: 'm1', action: 'pause', expectedRevision: 0, capabilities: ['mission.pause'], reason: 'Inspect', evidenceReceiptSha256: 'b'.repeat(64) });
  } finally { global.fetch = previousFetch; }
  assert.deepEqual(calls.map((entry) => [new URL(entry.url).pathname, entry.init.method ?? 'GET']), [
    ['/api/collaboration-experience/snapshot', 'GET'],
    ['/api/collaboration-experience/review/decisions', 'POST'],
    ['/api/collaboration-experience/steering', 'POST'],
  ]);
});

test('VS Code extension contributes collaboration state, review and steering commands without shell execution', async () => {
  const pkg = JSON.parse(await readFile('extensions/vscode/extension/package.json', 'utf8'));
  const commands = new Set(pkg.contributes.commands.map((entry) => entry.command));
  for (const id of ['nolane.showCollaboration', 'nolane.reviewApprove', 'nolane.steerPause', 'nolane.steerResume']) assert.equal(commands.has(id), true, id);
  const source = await readFile('extensions/vscode/src/extension.ts', 'utf8');
  assert.match(source, /registerCommand\('nolane\.showCollaboration'/);
  assert.match(source, /registerCommand\('nolane\.reviewApprove'/);
  assert.match(source, /registerCommand\('nolane\.steerPause'/);
  assert.match(source, /registerCommand\('nolane\.steerResume'/);
  assert.doesNotMatch(source, /child_process|execFile|spawn\(/);
});
