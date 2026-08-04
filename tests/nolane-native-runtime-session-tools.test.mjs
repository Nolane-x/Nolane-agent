import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm, cp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NolaneNativeRuntimeService } from '../src/nolane-native/runtime-service.mjs';
import { NolaneSessionStore, compressSessionHistory } from '../src/nolane-native/session-store.mjs';
import { createLocalHttpProvider, createCliProvider } from '../src/nolane-native/provider-adapters.mjs';
import { createGovernedShellTool } from '../src/nolane-native/shell-tool.mjs';
import { createFileTools } from '../src/nolane-native/file-tools.mjs';

test('native runtime preflight verifies offline lock, worker hash and protocol handshake', async () => {
  const service = new NolaneNativeRuntimeService({ projectRoot: process.cwd() });
  const preflight = await service.preflight();
  assert.equal(preflight.ready, true);
  assert.equal(preflight.protocol, 'nolane-agent-runtime/1');
  const started = await service.start();
  assert.equal(started.status, 'running');
  assert.equal((await service.ping()).pong, true);
  await service.stop();
  assert.equal(service.status().status, 'stopped');
});

test('native runtime fails closed when worker bytes do not match manifest', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'nolane-runtime-corrupt-'));
  try {
    await mkdir(path.join(temp, 'src/nolane-native'), { recursive: true });
    await mkdir(path.join(temp, 'config'), { recursive: true });
    await cp('src/nolane-native/runtime-worker.mjs', path.join(temp, 'src/nolane-native/runtime-worker.mjs'));
    await cp('config/nolane-native-runtime.json', path.join(temp, 'config/nolane-native-runtime.json'));
    await cp('package-lock.json', path.join(temp, 'package-lock.json'));
    await writeFile(path.join(temp, 'src/nolane-native/runtime-worker.mjs'), '\n//corrupt\n', { flag: 'a' });
    const service = new NolaneNativeRuntimeService({ projectRoot: temp });
    await assert.rejects(() => service.preflight(), /worker sha256 mismatch/i);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('session store survives restart, supports search and recovers from corrupt primary', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-sessions-'));
  try {
    const first = new NolaneSessionStore({ root }); await first.open();
    await first.createSession({ id: 's1', title: 'Provider fallback repair', projectId: 'p1' });
    await first.appendMessage('s1', { id: 'm1', role: 'user', text: 'Fix provider fallback and retry policy' });
    await first.appendMessage('s1', { id: 'm2', role: 'assistant', text: 'Added deterministic retry tests' });
    const search = first.search('retry provider'); assert.equal(search[0].sessionId, 's1');
    const second = new NolaneSessionStore({ root }); await second.open();
    assert.equal(second.getSession('s1').messages.length, 2);
    await writeFile(path.join(root, 'sessions.json'), '{broken');
    const recovered = new NolaneSessionStore({ root }); const receipt = await recovered.open();
    assert.equal(receipt.recoveredFromBackup, true);
    assert.equal(recovered.getSession('s1').messages.length >= 1, true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('history compression is deterministic, bounded and keeps recent turns plus provenance', () => {
  const messages = Array.from({ length: 20 }, (_, index) => ({ id: `m${index}`, role: index % 2 ? 'assistant' : 'user', text: `message ${index} ${'x'.repeat(50)}` }));
  const first = compressSessionHistory({ messages, maxCharacters: 300, keepRecent: 3 });
  const second = compressSessionHistory({ messages, maxCharacters: 300, keepRecent: 3 });
  assert.deepEqual(first, second);
  assert.equal(first.recent.length, 3);
  assert.match(first.summarySha256, /^[a-f0-9]{64}$/);
  assert.equal(first.totalMessages, 20);
  assert.equal(first.estimatedCharacters <= 300, true);
});

test('provider adapters preserve typed contracts and classify retryable failures', async () => {
  const http = createLocalHttpProvider({ id: 'local-http', endpoint: 'http://127.0.0.1:9999/v1', fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ type: 'final', answer: 'ok' }) }) });
  assert.equal((await http.invoke({ payload: { objective: 'x' } })).answer, 'ok');
  const busy = createLocalHttpProvider({ id: 'busy', endpoint: 'http://127.0.0.1:9999/v1', fetchImpl: async () => ({ ok: false, status: 503, text: async () => 'busy' }) });
  await assert.rejects(() => busy.invoke({ payload: {} }), (error) => error.retryable === true);
  const calls = [];
  const cli = createCliProvider({ id: 'cli', command: 'model-cli', runner: async (command, args, options) => { calls.push({ command, args, options }); return { code: 0, stdout: '{"type":"final","answer":"cli-ok"}' }; } });
  assert.equal((await cli.invoke({ payload: { objective: 'x' } })).answer, 'cli-ok');
  assert.deepEqual(calls[0].args.slice(0, 2), ['--json', '--request']);
  assert.equal(calls[0].options.shell, false);
});

test('governed shell rejects string commands and requires approval for destructive or network actions', async () => {
  const calls = []; const shell = createGovernedShellTool({ workspaceRoot: '/workspace', executor: async (file, args, options) => { calls.push({ file, args, options }); return { code: 0, stdout: 'ok', stderr: '' }; } });
  await assert.rejects(() => shell.execute({ command: 'rm -rf /' }, { capabilities: ['shell:execute'], approvals: [] }), /array/i);
  await assert.rejects(() => shell.execute({ command: ['git','push','--force'], cwd: '/workspace' }, { capabilities: ['shell:execute'], approvals: [] }), /approval required/i);
  const result = await shell.execute({ command: ['node','--version'], cwd: '/workspace' }, { capabilities: ['shell:execute'], approvals: [] });
  assert.equal(result.code, 0); assert.equal(calls[0].options.shell, false);
  await assert.rejects(() => shell.execute({ command: ['node','x'], cwd: '/outside' }, { capabilities: ['shell:execute'], approvals: [] }), /workspace/i);
});

test('file tools enforce realpath scope, symlink denial and optimistic write hashes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-files-')); const outside = await mkdtemp(path.join(os.tmpdir(), 'nolane-outside-'));
  try {
    await writeFile(path.join(root, 'a.txt'), 'one'); await writeFile(path.join(outside, 'secret.txt'), 'secret'); await symlink(path.join(outside, 'secret.txt'), path.join(root, 'link.txt'));
    const files = createFileTools({ workspaceRoot: root });
    const read = await files.read('a.txt'); assert.equal(read.content, 'one');
    await assert.rejects(() => files.read('../secret.txt'), /outside workspace|traversal/i);
    await assert.rejects(() => files.read('link.txt'), /symlink/i);
    await assert.rejects(() => files.write('a.txt', 'two', { expectedSha256: '0'.repeat(64) }), /file conflict/i);
    const written = await files.write('a.txt', 'two', { expectedSha256: read.sha256 }); assert.equal(written.contentSha256.length, 64);
    assert.deepEqual((await files.search('two')).map((item) => item.path), ['a.txt']);
  } finally { await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); }
});
