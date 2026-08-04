import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { LocalContainerPreflightService } from '../src/sandbox/local-container-preflight-service.mjs';

test('probes Docker daemon with argv and shell disabled', async () => {
  const calls = [];
  const service = new LocalContainerPreflightService({
    spawnProcess: async (command, args, options) => { calls.push({ command, args, options }); return { exitCode: 0, stdout: '{"ServerVersion":"27.0"}', stderr: '' }; },
  });
  const result = await service.check({ projectRoot: process.cwd(), mounts: [] });
  assert.equal(result.daemon.available, true);
  assert.equal(calls[0].command, 'docker');
  assert.deepEqual(calls[0].args, ['info', '--format', '{{json .ServerVersion}}']);
  assert.equal(calls[0].options.shell, false);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('rejects mounts outside the project and writable sensitive destinations', async () => {
  const service = new LocalContainerPreflightService({ spawnProcess: async () => ({ exitCode: 0, stdout: '"27"', stderr: '' }) });
  await assert.rejects(() => service.check({ projectRoot: process.cwd(), mounts: [{ source: path.resolve(process.cwd(), '..'), target: '/workspace', readOnly: true }] }), /outside project/i);
  await assert.rejects(() => service.check({ projectRoot: process.cwd(), mounts: [{ source: process.cwd(), target: '/etc', readOnly: false }] }), /sensitive destination/i);
});

test('rejects Docker, Podman, SSH agent and credential socket escapes', async () => {
  const service = new LocalContainerPreflightService({ spawnProcess: async () => ({ exitCode: 0, stdout: '"27"', stderr: '' }) });
  for (const source of ['/var/run/docker.sock', '/run/podman/podman.sock', '/tmp/ssh-agent.sock', path.join(process.env.HOME ?? '/home/user', '.ssh')]) {
    await assert.rejects(() => service.check({ projectRoot: '/', mounts: [{ source, target: '/mnt/x', readOnly: true }] }), /socket escape|credential/i);
  }
});

test('reports daemon unavailable without pretending isolation exists', async () => {
  const service = new LocalContainerPreflightService({ spawnProcess: async () => ({ exitCode: 1, stdout: '', stderr: 'daemon unavailable' }) });
  const result = await service.check({ projectRoot: process.cwd(), mounts: [] });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.daemon.available, false);
  assert.match(result.daemon.reason, /daemon unavailable/);
});
