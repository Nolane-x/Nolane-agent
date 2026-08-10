import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createNativeWebBrowserTools } from '../src/nolane-native/web-browser-tools.mjs';
import { NativeNotebookService } from '../src/nolane-native/code-notebook-tools.mjs';
import { CrossSessionMemory } from '../src/nolane-native/cross-session-memory.mjs';
import { TerminalUiState } from '../src/nolane-native/terminal-ui.mjs';
import { MediaProviderRegistry } from '../src/nolane-native/media-provider-registry.mjs';
import { AudioProviderRegistry } from '../src/nolane-native/audio-provider-registry.mjs';
import { createNolaneNativeCapabilityPack } from '../src/nolane-native/capability-pack.mjs';

const SHA = /^[a-f0-9]{64}$/;

test('native web tools enforce protocol/host/byte limits and label fetched content untrusted', async () => {
  const tools = createNativeWebBrowserTools({
    allowHosts: ['docs.example.test'], maxResponseBytes: 32,
    fetchImpl: async (url) => new Response('hello from docs', { status: 200, headers: { 'content-type': 'text/plain', 'x-url': String(url) } }),
  });
  const result = await tools.fetchText({ url: 'https://docs.example.test/page' });
  assert.equal(result.text, 'hello from docs');
  assert.equal(result.untrusted, true);
  assert.match(result.receiptSha256, SHA);
  await assert.rejects(() => tools.fetchText({ url: 'file:///etc/passwd' }), /protocol/i);
  await assert.rejects(() => tools.fetchText({ url: 'https://evil.test/' }), /host/i);
  const oversized = createNativeWebBrowserTools({ allowHosts: ['docs.example.test'], maxResponseBytes: 4, fetchImpl: async () => new Response('too-long') });
  await assert.rejects(() => oversized.fetchText({ url: 'https://docs.example.test/' }), /byte limit/i);
});

test('native browser facade delegates bounded actions to an injected driver and requires approvals for computer use', async () => {
  const calls = [];
  const tools = createNativeWebBrowserTools({
    allowHosts: ['app.example.test'],
    fetchImpl: async () => new Response('ok'),
    browserDriver: { async execute(action) { calls.push(action); return { ok: true, snapshot: '<main>ready</main>' }; } },
  });
  const opened = await tools.browser({ action: 'navigate', url: 'https://app.example.test/', approvals: [] });
  assert.equal(opened.result.ok, true);
  await assert.rejects(() => tools.browser({ action: 'click', target: '#delete', approvals: [] }), /approval/i);
  const clicked = await tools.browser({ action: 'click', target: '#delete', approvals: ['browser:computer-use'] });
  assert.equal(clicked.action, 'click');
  assert.deepEqual(calls.map((item) => item.action), ['navigate', 'click']);
});

test('NativeNotebookService runs persistent JavaScript cells in worker isolation with timeout and output limits', async () => {
  // Worker startup can exceed 100ms after the full Windows suite; retain a
  // bounded timeout while leaving enough room for a cold worker handshake.
  const notebook = new NativeNotebookService({ timeoutMs: 1_000, maxOutputBytes: 128, maxSessions: 2 });
  const session = await notebook.openSession({ id: 'nb-1' });
  const first = await notebook.executeCell({ sessionId: session.id, source: 'globalThis.counter = (globalThis.counter ?? 0) + 1; console.log(counter); counter', input: {} });
  assert.equal(first.result, 1);
  assert.deepEqual(first.logs, ['1']);
  const second = await notebook.executeCell({ sessionId: session.id, source: 'counter += input.step; counter', input: { step: 2 } });
  assert.equal(second.result, 3);
  const isolated = await notebook.executeCell({ sessionId: session.id, source: '[typeof process, typeof require, typeof fetch]', input: {} });
  assert.deepEqual(isolated.result, ['undefined', 'undefined', 'undefined']);
  await assert.rejects(() => notebook.executeCell({ sessionId: session.id, source: 'while (true) {}', input: {} }), /timed out/i);
  await assert.rejects(() => notebook.executeCell({ sessionId: session.id, source: 'console.log("x".repeat(1000)); 1', input: {} }), /output limit/i);
  await notebook.closeSession(session.id);
});

test('CrossSessionMemory persists provenance, TTL, optimistic versions and invalidation', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-memory-'));
  let now = 1000;
  try {
    const file = path.join(root, 'memory.json');
    const memory = new CrossSessionMemory({ file, clock: () => now });
    await memory.init();
    const stored = await memory.put({ key: 'repo:rule', value: { text: 'use ESM' }, scope: 'project:p1', provenance: ['receipt-1'], ttlMs: 100 });
    assert.equal(stored.version, 1);
    await assert.rejects(() => memory.put({ key: 'repo:rule', value: { text: 'bad' }, scope: 'project:p1', provenance: ['receipt-2'], expectedVersion: 0 }), /conflict/i);
    const reopened = new CrossSessionMemory({ file, clock: () => now });
    await reopened.init();
    assert.equal((await reopened.get({ key: 'repo:rule', scope: 'project:p1' })).value.text, 'use ESM');
    now = 1200;
    assert.equal(await reopened.get({ key: 'repo:rule', scope: 'project:p1' }), null);
    now = 1300;
    await reopened.put({ key: 'repo:rule', value: { text: 'new' }, scope: 'project:p1', provenance: ['receipt-3'] });
    const invalidated = await reopened.invalidate({ key: 'repo:rule', scope: 'project:p1', reason: 'superseded', provenanceReceipt: 'receipt-4' });
    assert.equal(invalidated.invalidated, true);
    assert.equal(await reopened.get({ key: 'repo:rule', scope: 'project:p1' }), null);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('TerminalUiState renders deterministic ANSI-free state and handles bounded navigation commands', () => {
  const tui = new TerminalUiState({ width: 60, height: 12 });
  tui.update({ missions: [{ id: 'm1', title: 'Build feature', status: 'running' }, { id: 'm2', title: 'Review patch', status: 'needs-input' }], selectedMissionId: 'm1', message: 'Nolane Agent ready' });
  const first = tui.render();
  const second = tui.render();
  assert.equal(first, second);
  assert.equal(/\x1b\[/.test(first), false);
  assert.match(first, /Nolane Agent/);
  assert.equal(tui.handleCommand('down').selectedMissionId, 'm2');
  assert.equal(tui.handleCommand('up').selectedMissionId, 'm1');
  assert.throws(() => tui.handleCommand('shell rm -rf'), /unsupported/i);
});

test('media and audio registries negotiate capabilities, enforce byte limits and hide provider secrets', async () => {
  const media = new MediaProviderRegistry({ maxArtifactBytes: 32 });
  media.register({ id: 'local-image', capabilities: ['image.generate'], credentialRef: 'vault://image', execute: async () => ({ mimeType: 'image/png', bytes: Buffer.from('png-bytes'), metadata: { width: 8, height: 8 } }) });
  const image = await media.execute({ capability: 'image.generate', input: { prompt: 'square' } });
  assert.equal(image.mimeType, 'image/png');
  assert.equal(image.bytes.toString(), 'png-bytes');
  assert.equal(JSON.stringify(media.describe()).includes('vault://image'), false);
  const audio = new AudioProviderRegistry({ maxArtifactBytes: 64 });
  audio.register({ id: 'local-voice', capabilities: ['audio.transcribe', 'audio.synthesize'], credentialRef: 'vault://voice', execute: async ({ capability }) => capability === 'audio.transcribe' ? ({ text: 'hello', language: 'en' }) : ({ mimeType: 'audio/wav', bytes: Buffer.from('wav') }) });
  assert.equal((await audio.execute({ capability: 'audio.transcribe', input: { bytes: Buffer.from('voice') } })).text, 'hello');
  assert.equal((await audio.execute({ capability: 'audio.synthesize', input: { text: 'hello' } })).mimeType, 'audio/wav');
  assert.equal(JSON.stringify(audio.describe()).includes('vault://voice'), false);
});

test('capability pack exposes native replacements without importing or executing NolaneNative', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-pack-'));
  try {
    const pack = await createNolaneNativeCapabilityPack({
      memoryFile: path.join(root, 'memory.json'),
      allowHosts: ['docs.example.test'],
      fetchImpl: async () => new Response('docs'),
    });
    const snapshot = pack.snapshot();
    assert.deepEqual(snapshot.capabilities.sort(), ['audio', 'browser', 'code-notebook', 'cross-session-memory', 'media', 'terminal-ui', 'web']);
    assert.equal(snapshot.runtimeOwner, 'nolane-native');
    assert.equal(JSON.stringify(snapshot).toLowerCase().includes('nolane_native'), false);
    assert.match(snapshot.receiptSha256, SHA);
    await pack.close();
  } finally { await rm(root, { recursive: true, force: true }); }
});
