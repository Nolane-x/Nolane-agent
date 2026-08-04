import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NolaneAgentClient, NolaneAgentRequestError } from '../src/client/nolane-agent-client.mjs';
import { ForgeStudioClient as LegacyForgeStudioClient } from '../src/client/forge-studio-client.mjs';
import { NolaneAgentClient as TypeScriptSdkClient } from '../sdk/typescript/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function fixture(t) {
  const requests = [];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({ method: req.method, url: req.url, headers: req.headers, body });
    if (req.url === '/health') return send(res, 200, { status: 'ok', version: '1.0.0' });
    if (req.headers.authorization !== 'Bearer test-token') return send(res, 401, { error: 'unauthorized' });
    if (req.url === '/api/projects') return send(res, 200, [{ id: 'p1', name: 'Forge' }]);
    if (req.url === '/api/agent/runs' && req.method === 'POST') return send(res, 201, { id: 'run1', ...JSON.parse(body) });
    if (req.url === '/api/agent/runs?projectId=p1&limit=30') return send(res, 200, [{ id: 'run1' }]);
    if (req.url === '/api/agent/runs/run1/pause' && req.method === 'POST') return send(res, 200, { id: 'run1', status: 'paused' });
    if (req.url === '/api/paged?page=1&limit=2') return send(res, 200, { items: [{ id: 1 }, { id: 2 }], nextPage: 2 });
    if (req.url === '/api/paged?page=2&limit=2') return send(res, 200, { items: [{ id: 3 }], nextPage: null });
    return send(res, 404, { error: 'not-found' });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  return { baseUrl: `http://127.0.0.1:${address.port}`, requests };
}

function send(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
  res.end(body);
}

function runCli(args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['cli/nolane-agent.mjs', ...args], {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => resolve({ code, stdout, stderr }));
  });
}

test('NolaneAgentClient enforces secure endpoints, tenant headers, timeout and pagination', async (t) => {
  assert.throws(() => new NolaneAgentClient({ baseUrl: 'http://example.com', token: 'x' }), /HTTPS/i);
  const f = await fixture(t);
  const client = new NolaneAgentClient({ baseUrl: f.baseUrl, token: 'test-token', organizationId: 'org1', workspaceId: 'ws1', timeoutMs: 5_000 });
  assert.deepEqual(await client.listProjects(), [{ id: 'p1', name: 'Forge' }]);
  const run = await client.createRun({ projectId: 'p1', objective: 'Fix tests', autonomyProfile: 'guided' });
  assert.equal(run.id, 'run1');
  assert.equal((await client.controlRun('run1', 'pause')).status, 'paused');
  assert.deepEqual(await client.paginate('/api/paged', { pageSize: 2 }), [{ id: 1 }, { id: 2 }, { id: 3 }]);
  const protectedRequest = f.requests.find((request) => request.url === '/api/projects');
  assert.equal(protectedRequest.headers.authorization, 'Bearer test-token');
  assert.equal(protectedRequest.headers['x-nolane-organization'], 'org1');
  assert.equal(protectedRequest.headers['x-nolane-workspace'], 'ws1');
});

test('TypeScript SDK exports the same supported client surface', () => {
  assert.equal(TypeScriptSdkClient, NolaneAgentClient);
  assert.equal(LegacyForgeStudioClient, NolaneAgentClient);
  assert.equal(typeof NolaneAgentRequestError, 'function');
  for (const method of ['listProjects', 'createRun', 'listRuns', 'getRun', 'controlRun', 'sendMessage', 'reviewRun', 'listActivities', 'paginate']) {
    assert.equal(typeof NolaneAgentClient.prototype[method], 'function');
  }
});

test('CLI returns stable JSON, reads token from environment and never prints it', async (t) => {
  const f = await fixture(t);
  const env = { NOLANE_AGENT_URL: f.baseUrl, NOLANE_AGENT_TOKEN: 'test-token', NOLANE_AGENT_PROJECT_ID: 'p1' };
  const health = await runCli(['--json', 'health'], env);
  assert.equal(health.code, 0, health.stderr);
  assert.deepEqual(JSON.parse(health.stdout), { status: 'ok', version: '1.0.0' });

  const created = await runCli(['--json', 'runs', 'create', '--objective', 'Fix tests'], env);
  assert.equal(created.code, 0, created.stderr);
  assert.equal(JSON.parse(created.stdout).id, 'run1');
  assert.doesNotMatch(created.stdout + created.stderr, /test-token/);

  const paused = await runCli(['--json', 'runs', 'pause', 'run1'], env);
  assert.equal(paused.code, 0, paused.stderr);
  assert.equal(JSON.parse(paused.stdout).status, 'paused');
});

test('CLI rejects plaintext token arguments and redacts request failures', async (t) => {
  const f = await fixture(t);
  const rejected = await runCli(['--token', 'do-not-print', 'projects', 'list'], { NOLANE_AGENT_URL: f.baseUrl });
  assert.notEqual(rejected.code, 0);
  assert.match(rejected.stderr, /NOLANE_AGENT_TOKEN|token file/i);
  assert.doesNotMatch(rejected.stderr, /do-not-print/);

  const unauthorized = await runCli(['--json', 'projects', 'list'], { NOLANE_AGENT_URL: f.baseUrl, NOLANE_AGENT_TOKEN: 'wrong-secret-token' });
  assert.notEqual(unauthorized.code, 0);
  assert.match(unauthorized.stderr, /401/);
  assert.doesNotMatch(unauthorized.stderr, /wrong-secret-token/);
});

test('SDK source tree never includes Python bytecode caches with or without Git metadata', async () => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  let sourceFiles;
  try {
    const result = await promisify(execFile)(
      'git', ['ls-files', 'sdk/python'], { cwd: root },
    );
    sourceFiles = result.stdout.split(/\r?\n/).filter(Boolean);
  } catch {
    const { readFile } = await import('node:fs/promises');
    const manifest = JSON.parse(await readFile(path.join(root, 'project-manifest.json'), 'utf8'));
    sourceFiles = (manifest.files ?? []).map((entry) => entry.relativePath).filter((file) => file.startsWith('sdk/python/'));
    assert.ok(sourceFiles.length > 0, 'source release manifest must enumerate the Python SDK');
  }
  assert.equal(sourceFiles.filter((file) => /(?:^|\/)__pycache__\/|\.py[co]$/i.test(file)).length, 0);
});
