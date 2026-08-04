import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrowserEngineWave11 } from '../src/native-core/browser-engine-wave11.mjs';

class FixtureBackend {
  constructor() { this.url = 'about:blank'; this.nodes = [{ id: 'submit', role: 'button', text: 'Submit' }, { id: 'secret', role: 'textbox', text: '', sensitive: true }]; this.actions = []; this.restarts = 0; }
  async navigate(url) { this.url = url; this.actions.push(['navigate', url]); return { url }; }
  async snapshot() { return { url: this.url, nodes: structuredClone(this.nodes) }; }
  async act(action) { this.actions.push([action.type, action.target?.id ?? null]); return { changed: true, type: action.type, target: action.target?.id ?? null }; }
  async screenshot() { return Buffer.from(`shot:${this.url}`); }
  async restart() { this.restarts += 1; return { restarted: true }; }
}

async function fixture(t, options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-wave11-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const backend = new FixtureBackend();
  const engine = new BrowserEngineWave11({ backend, profileRoot: path.join(root, 'profiles'), uploadRoot: path.join(root, 'uploads'), quarantineRoot: path.join(root, 'quarantine'), approval: async () => ({ approved: true, approver: 'test' }), ...options });
  await engine.open();
  engine.createProfile({ id: 'p1', allowedHosts: ['example.com'], maxActions: 20, maxNavigations: 3 });
  return { root, backend, engine };
}

test('browser engine isolates profiles, blocks private networks and arbitrary JavaScript', async (t) => {
  const { engine } = await fixture(t);
  await assert.rejects(() => engine.navigate({ profileId: 'p1', url: 'http://127.0.0.1/admin' }), (error) => error.code === 'PRIVATE_NETWORK_DENIED');
  await assert.rejects(() => engine.navigate({ profileId: 'p1', url: 'https://evil.example.net' }), (error) => error.code === 'HOST_DENIED');
  await assert.rejects(() => engine.execute({ profileId: 'p1', type: 'evaluate', script: 'document.cookie' }), (error) => error.code === 'ACTION_DENIED');
  assert.equal((await engine.navigate({ profileId: 'p1', url: 'https://example.com/path' })).url, 'https://example.com/path');
});

test('snapshot selector resolution, approval and sensitive-field masking are deterministic', async (t) => {
  const { engine } = await fixture(t);
  await engine.navigate({ profileId: 'p1', url: 'https://example.com' });
  const snapshot = await engine.snapshot({ profileId: 'p1' });
  assert.equal(snapshot.nodes.find((node) => node.id === 'secret').text, '[SENSITIVE]');
  const clicked = await engine.execute({ profileId: 'p1', type: 'click', selector: { role: 'button', text: 'Submit' } });
  assert.equal(clicked.effect.target, 'submit');
  await assert.rejects(() => engine.execute({ profileId: 'p1', type: 'click', selector: { id: 'missing' } }), (error) => error.code === 'STALE_SELECTOR');
});

test('file chooser and download quarantine reject traversal, symlinks and byte overflow', async (t) => {
  const { root, engine } = await fixture(t, { maxDownloadBytes: 8, maxUploadBytes: 8 });
  await writeFile(path.join(root, 'uploads', 'ok.txt'), 'abc');
  assert.equal((await engine.chooseFile({ profileId: 'p1', relativePath: 'ok.txt' })).bytes, 3);
  await assert.rejects(() => engine.chooseFile({ profileId: 'p1', relativePath: '../escape.txt' }), (error) => error.code === 'PATH_TRAVERSAL');
  await symlink(path.join(root, 'uploads', 'ok.txt'), path.join(root, 'uploads', 'link.txt'));
  await assert.rejects(() => engine.chooseFile({ profileId: 'p1', relativePath: 'link.txt' }), (error) => error.code === 'SYMLINK_FORBIDDEN');
  await assert.rejects(() => engine.quarantineDownload({ profileId: 'p1', suggestedName: '../../evil.exe', mimeType: 'application/octet-stream', bytes: Buffer.alloc(9) }), (error) => error.code === 'DOWNLOAD_TOO_LARGE');
  const saved = await engine.quarantineDownload({ profileId: 'p1', suggestedName: '../../safe.txt', mimeType: 'text/plain', bytes: Buffer.from('safe') });
  assert.equal(saved.name, 'safe.txt');
  assert.match(saved.sha256, /^[a-f0-9]{64}$/);
});

test('dialog storm, action budgets, cancellation and crash recovery fail closed', async (t) => {
  const { backend, engine } = await fixture(t, { maxDialogs: 2 });
  engine.enqueueDialog({ profileId: 'p1', type: 'alert', message: '1' });
  engine.enqueueDialog({ profileId: 'p1', type: 'alert', message: '2' });
  assert.throws(() => engine.enqueueDialog({ profileId: 'p1', type: 'alert', message: '3' }), (error) => error.code === 'DIALOG_STORM');
  const controller = new AbortController(); controller.abort('stop');
  await assert.rejects(() => engine.snapshot({ profileId: 'p1', signal: controller.signal }), (error) => error.code === 'ABORT_ERR');
  assert.equal((await engine.recover({ profileId: 'p1', reason: 'crash' })).restarted, true);
  assert.equal(backend.restarts, 1);
});

test('browser journey produces replayable effect receipts and screenshots', async (t) => {
  const { engine } = await fixture(t);
  const journey = await engine.runJourney({ profileId: 'p1', steps: [
    { type: 'navigate', url: 'https://example.com' },
    { type: 'snapshot' },
    { type: 'click', selector: { id: 'submit' } },
    { type: 'screenshot' },
  ] });
  assert.equal(journey.steps.length, 4);
  assert.equal(journey.steps.every((step) => /^[a-f0-9]{64}$/.test(step.receiptSha256)), true);
  assert.match(journey.effectHeadSha256, /^[a-f0-9]{64}$/);
  const replay = engine.replay(journey);
  assert.equal(replay.valid, true);
  assert.equal(replay.effectHeadSha256, journey.effectHeadSha256);
});
