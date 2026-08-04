import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NolaneNativeOrchestrationService } from '../src/nolane-native/orchestration-service.mjs';
import { createRoutes } from '../src/server/routes.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-wave7-production-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const service = new NolaneNativeOrchestrationService({ dataDir: path.join(root, '.data'), workspaceRoot: root });
  await service.open();
  return { root, service };
}

test('orchestration production-wires execution wave7 and exposes secret-free status', async (t) => {
  const { root, service } = await fixture(t);
  const receipt = await service.executeNativeBackend({
    backendId: 'local',
    action: { command: process.execPath, args: ['-e', 'process.stdout.write("wave7")'], cwd: root },
    policy: { risk: 'low', reversible: true },
  });
  assert.equal(receipt.status, 'pass');
  assert.equal(receipt.stdout, 'wave7');
  assert.equal(service.status().executionWave7.backends.some((entry) => entry.id === 'local'), true);
  assert.equal(JSON.stringify(service.status().executionWave7).includes('secret'), false);

  await writeFile(path.join(root, 'artifact.txt'), 'artifact');
  const copied = await service.transferNativeExecutionArtifact({ source: 'artifact.txt', target: 'copied/artifact.txt' });
  assert.equal(copied.bytes, 8);
  assert.match(copied.sha256, /^[a-f0-9]{64}$/);
});

test('authenticated HTTP routes expose bounded execution and artifact transfer', async (t) => {
  const { root, service } = await fixture(t);
  await writeFile(path.join(root, 'artifact.txt'), 'artifact');
  const route = createRoutes({ nativeOrchestration: service });
  const call = async ({ method = 'GET', pathname, body = null }) => {
    let status; let data = '';
    const req = { method, forgePrincipal: { subject: 'alice' }, async *[Symbol.asyncIterator]() { if (body !== null) yield Buffer.from(JSON.stringify(body)); } };
    const res = { writeHead(code) { status = code; }, end(chunk = '') { data += chunk; } };
    await route(req, res, new URL(`http://local${pathname}`));
    return { status, body: data ? JSON.parse(data) : null };
  };

  const run = await call({ method: 'POST', pathname: '/api/nolane/native-core/execution/run', body: {
    backendId: 'local',
    action: { command: process.execPath, args: ['-e', 'process.stdout.write("route")'], cwd: root, shell: true },
    policy: { risk: 'low', reversible: true },
  } });
  assert.equal(run.status, 200);
  assert.equal(run.body.stdout, 'route');
  assert.equal(run.body.output?.shell, undefined);

  const transfer = await call({ method: 'POST', pathname: '/api/nolane/native-core/execution/artifact', body: { source: 'artifact.txt', target: 'copied/route.txt' } });
  assert.equal(transfer.status, 201);
  assert.equal(transfer.body.bytes, 8);

  const status = await call({ pathname: '/api/nolane/native-core/execution/status' });
  assert.equal(status.status, 200);
  assert.equal(status.body.backends.some((entry) => entry.id === 'local'), true);
});
