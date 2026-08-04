import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ExecutionBackendTCK } from '../src/native-core/execution/execution-backend-tck.mjs';
import { LocalProcessBackend } from '../src/native-core/execution/local-process-backend.mjs';
import { ContainerBackend } from '../src/native-core/execution/container-backend.mjs';
import { SshExecutionBackend } from '../src/native-core/execution/ssh-execution-backend.mjs';
import { HostedExecutionBackend } from '../src/native-core/execution/hosted-execution-backend.mjs';
import { DaemonPool } from '../src/native-core/execution/daemon-pool.mjs';
import { LazyDependencyResolver } from '../src/native-core/execution/lazy-dependency-resolver.mjs';
import { ToolDispatchPipeline } from '../src/native-core/execution/tool-dispatch-pipeline.mjs';
import { ShellHookPolicy } from '../src/native-core/execution/shell-hook-policy.mjs';
import { McpStdioWatchdog } from '../src/native-core/execution/mcp-stdio-watchdog.mjs';
import { ExecutionArtifactTransfer } from '../src/native-core/execution/execution-artifact-transfer.mjs';
import { ExecutionRuntimeWave7 } from '../src/native-core/execution-runtime-wave7.mjs';

const hex64 = /^[a-f0-9]{64}$/;

test('local process backend executes argv without shell, bounds output and redacts credential values', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-wave7-local-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const backend = new LocalProcessBackend({ workspaceRoot: root, maxOutputBytes: 16, credentialResolver: (ref) => ref === 'secret:test' ? 'TOP_SECRET' : null });
  const result = await backend.execute({ command: process.execPath, args: ['-e', 'process.stdout.write(process.env.TOKEN + "-abcdefghijklmnop")'], cwd: root, envRefs: { TOKEN: 'secret:test' } });
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout.includes('TOP_SECRET'), false);
  assert.equal(result.outputTruncated, true);
  assert.ok(result.stdout.includes('[REDACTED]'));
  assert.equal(result.mode, 'non-pty');
});

test('local process backend rejects cwd escape and symlink escape', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-wave7-path-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'nolane-wave7-outside-'));
  t.after(() => Promise.all([rm(root, { recursive: true, force: true }), rm(outside, { recursive: true, force: true })]));
  await symlink(outside, path.join(root, 'escape'));
  const backend = new LocalProcessBackend({ workspaceRoot: root });
  await assert.rejects(() => backend.execute({ command: process.execPath, args: ['-e', ''], cwd: outside }), (error) => error.code === 'PATH_OUTSIDE_WORKSPACE');
  await assert.rejects(() => backend.execute({ command: process.execPath, args: ['-e', ''], cwd: path.join(root, 'escape') }), (error) => error.code === 'SYMLINK_ESCAPE');
});

test('execution backend TCK verifies local, container, SSH and hosted protocol contracts without claiming real infrastructure', async () => {
  const local = new LocalProcessBackend({ workspaceRoot: process.cwd() });
  const container = new ContainerBackend({ runtime: 'docker', runner: async () => ({ exitCode: 0, stdout: 'ok', stderr: '' }), available: () => true, allowImages: ['fixture:latest'] });
  const ssh = new SshExecutionBackend({ runner: async () => ({ exitCode: 0, stdout: 'loopback', stderr: '' }), available: () => true, credentialResolver: () => '/tmp/id_fixture' });
  const hosted = new HostedExecutionBackend({ id: 'fixture-hosted', provider: { available: () => true, execute: async () => ({ exitCode: 0, stdout: 'hosted', stderr: '', remoteId: 'job-1' }), teardown: async () => {} } });
  const tck = new ExecutionBackendTCK();
  for (const backend of [local, container, ssh, hosted]) {
    const receipt = await tck.verify(backend);
    assert.equal(receipt.status, 'pass');
    assert.match(receipt.receiptSha256, hex64);
  }
  assert.equal((await container.execute({ image: 'fixture:latest', command: ['node', '--version'] })).exitCode, 0);
  assert.equal((await ssh.execute({ host: '127.0.0.1', user: 'fixture', command: ['echo', 'ok'], credentialRef: 'ssh:fixture' })).stdout, 'loopback');
  await hosted.teardown({ remoteId: 'job-1' });
  await hosted.teardown({ remoteId: 'job-1' });
});

test('unavailable container, SSH and hosted backends fail with BACKEND_UNAVAILABLE', async () => {
  const cases = [
    new ContainerBackend({ available: () => false }),
    new SshExecutionBackend({ available: () => false }),
    new HostedExecutionBackend({ id: 'offline', provider: { available: () => false, execute: async () => ({}) } }),
  ];
  for (const backend of cases) await assert.rejects(() => backend.execute({}), (error) => error.code === 'BACKEND_UNAVAILABLE');
});

test('daemon pool enforces capacity and closes resources idempotently', async () => {
  let created = 0;
  let closed = 0;
  const pool = new DaemonPool({ maxSize: 1, factory: async () => ({ id: `d-${++created}`, close: async () => { closed += 1; } }) });
  const lease = await pool.acquire('worker');
  await assert.rejects(() => pool.acquire('other'), (error) => error.code === 'DAEMON_POOL_EXHAUSTED');
  await lease.release();
  await lease.release();
  await pool.close();
  await pool.close();
  assert.equal(created, 1);
  assert.equal(closed, 1);
});

test('lazy dependency resolver caches loaders and fails closed for unknown dependencies', async () => {
  let loads = 0;
  const resolver = new LazyDependencyResolver();
  resolver.register('fixture', async () => ({ value: ++loads }));
  assert.equal((await resolver.resolve('fixture')).value, 1);
  assert.equal((await resolver.resolve('fixture')).value, 1);
  await assert.rejects(() => resolver.resolve('missing'), (error) => error.code === 'DEPENDENCY_NOT_REGISTERED');
});

test('tool dispatch retries only retryable failures and preserves approval boundary', async () => {
  let attempts = 0;
  const pipeline = new ToolDispatchPipeline({ maxRetries: 2 });
  pipeline.register({ id: 'fixture', risk: 'high', execute: async () => { attempts += 1; if (attempts < 2) throw Object.assign(new Error('busy'), { code: 'RATE_LIMITED', retryable: true }); return { status: 'pass' }; } });
  await assert.rejects(() => pipeline.dispatch('fixture', {}, { approved: false }), (error) => error.code === 'APPROVAL_REQUIRED');
  const result = await pipeline.dispatch('fixture', {}, { approved: true });
  assert.equal(result.attempts, 2);
  pipeline.register({ id: 'fatal', risk: 'low', execute: async () => { throw Object.assign(new Error('bad'), { code: 'INVALID_INPUT', retryable: false }); } });
  await assert.rejects(() => pipeline.dispatch('fatal', {}, {}), (error) => error.code === 'INVALID_INPUT');
});

test('shell hook policy accepts argv hooks and rejects shell strings, secret literals and unknown phases', () => {
  const policy = new ShellHookPolicy({ allowedCommands: [process.execPath] });
  assert.deepEqual(policy.authorize({ phase: 'before-tool', command: process.execPath, args: ['--version'], envRefs: { TOKEN: 'secret:test' } }).args, ['--version']);
  assert.throws(() => policy.authorize({ phase: 'before-tool', command: `${process.execPath} --version`, args: [] }), /command is not allowlisted/i);
  assert.throws(() => policy.authorize({ phase: 'unknown', command: process.execPath, args: [] }), /hook phase/i);
  assert.throws(() => policy.authorize({ phase: 'before-tool', command: process.execPath, args: [], env: { TOKEN: 'raw-secret' } }), /raw environment values/i);
});

test('MCP stdio watchdog enforces restart budget and stop is idempotent', async () => {
  let restarts = 0;
  let stops = 0;
  const watchdog = new McpStdioWatchdog({ maxRestarts: 1, restart: async () => { restarts += 1; }, stop: async () => { stops += 1; } });
  await watchdog.start();
  await watchdog.markFailure({ code: 'PIPE_CLOSED' });
  await assert.rejects(() => watchdog.markFailure({ code: 'PIPE_CLOSED' }), (error) => error.code === 'RESTART_BUDGET_EXHAUSTED');
  await watchdog.close();
  await watchdog.close();
  assert.equal(restarts, 1);
  assert.equal(stops, 1);
});

test('artifact transfer is content-addressed, rejects symlinks and enforces byte budget', async (t) => {
  const source = await mkdtemp(path.join(os.tmpdir(), 'nolane-wave7-artifact-source-'));
  const target = await mkdtemp(path.join(os.tmpdir(), 'nolane-wave7-artifact-target-'));
  t.after(() => Promise.all([rm(source, { recursive: true, force: true }), rm(target, { recursive: true, force: true })]));
  await writeFile(path.join(source, 'a.txt'), 'hello');
  const transfer = new ExecutionArtifactTransfer({ sourceRoot: source, targetRoot: target, maxBytes: 10 });
  const receipt = await transfer.copy('a.txt', 'copied/a.txt');
  assert.equal(await readFile(path.join(target, 'copied/a.txt'), 'utf8'), 'hello');
  assert.match(receipt.sha256, hex64);
  await symlink(path.join(source, 'a.txt'), path.join(source, 'link.txt'));
  await assert.rejects(() => transfer.copy('link.txt', 'link.txt'), (error) => error.code === 'SYMLINK_FORBIDDEN');
  await writeFile(path.join(source, 'large.bin'), Buffer.alloc(11));
  await assert.rejects(() => transfer.copy('large.bin', 'large.bin'), (error) => error.code === 'ARTIFACT_TOO_LARGE');
});

test('wave 7 aggregate exposes secret-free status and local execution', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-wave7-runtime-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const runtime = new ExecutionRuntimeWave7({ workspaceRoot: root, dataDir: root });
  const result = await runtime.execute({ backendId: 'local', action: { command: process.execPath, args: ['-e', 'process.stdout.write("ok")'], cwd: root }, policy: { risk: 'low', reversible: true } });
  assert.equal(result.status, 'pass');
  assert.equal(result.stdout, 'ok');
  assert.equal(JSON.stringify(runtime.snapshot()).includes('secret'), false);
});
