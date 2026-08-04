import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { OperatingPlaneToolGateway } from '../src/agent/operating-plane-tool-gateway.mjs';
import { createRoutes } from '../src/server/routes.mjs';
import { VERSION } from '../src/version.mjs';

function response() {
  return {
    statusCode: null,
    headers: null,
    body: '',
    writeHead(status, headers) { this.statusCode = status; this.headers = headers; },
    end(body = '') { this.body = String(body); },
  };
}

function request(method, body = null) {
  const req = new EventEmitter();
  req.method = method;
  req.headers = {};
  req[Symbol.asyncIterator] = async function* iterator() { if (body !== null) yield Buffer.from(JSON.stringify(body)); };
  return req;
}

test('OperatingPlaneToolGateway exposes only task-authorized tools and emits content-addressed receipts', async () => {
  const calls = [];
  const gateway = new OperatingPlaneToolGateway({
    projectResolver: () => ({ id: 'p1', workspaceRoot: '/workspace' }),
    codeIntelligence: { workspaceSymbols: async (input) => { calls.push(['symbols', input]); return { source: 'lsp', items: [{ name: 'run' }] }; } },
    gitGatewayFactory: () => ({ status: async () => ({ clean: true, entries: [] }) }),
    imageComparisonFactory: () => ({ compare: async (input) => ({ ...input, changedPixelRatio: 0.25, receiptSha256: 'a'.repeat(64) }) }),
    profileLoader: { loadProjectProfiles: async () => [{ id: 'reviewer' }] },
  });
  const task = { id: 't1', projectId: 'p1', metadata: { operatingPlaneAllowedTools: ['code.symbols', 'git.status', 'visual.compare', 'agent.profiles'] } };
  const schemas = gateway.schemasForTask(task);
  assert.deepEqual(schemas.map((schema) => schema.function.name).sort(), ['agent.profiles', 'code.symbols', 'git.status', 'visual.compare']);
  const symbols = await gateway.execute(task, 'code.symbols', { languageId: 'javascript', query: 'run' });
  assert.deepEqual(symbols.output.items, [{ name: 'run' }]);
  assert.match(symbols.receipt.receiptSha256, /^[a-f0-9]{64}$/);
  await assert.rejects(() => gateway.execute(task, 'git.commit', { message: 'no' }), (error) => error.code === 'OPERATING_PLANE_TOOL_DENIED');
});

test('HTTP routes expose governed operating-plane diagnostics, profiles, code intelligence and visual comparison', async () => {
  const project = { id: 'p1', workspaceRoot: '/workspace' };
  const routes = createRoutes({
    store: { listProjects: () => [project], getProject: (id) => id === 'p1' ? project : null },
    providers: {}, missionRunner: {},
    operatingPlane: {
      status: async () => ({ schema: 'forge.operating-plane.status.v1', version: '1.0.0', capabilities: ['hooks', 'lsp', 'git', 'visual-diff'] }),
      listProfiles: async (projectId) => [{ id: `profile-${projectId}` }],
      code: async (operation, input) => ({ operation, input, source: 'lsp' }),
      compareImages: async (input) => ({ ...input, changedPixelRatio: 0.5, receiptSha256: 'b'.repeat(64) }),
      session: async (operation, input) => ({ operation, input, valid: true }),
      git: async (operation, input) => ({ operation, input, clean: true }),
      security: async (operation, input) => ({ operation, input, status: 'pass' }),
    },
  });

  const cases = [
    ['GET', '/api/operating-plane/status', null, 200, 'forge.operating-plane.status.v1'],
    ['GET', '/api/projects/p1/agent-profiles', null, 200, 'profile-p1'],
    ['POST', '/api/code/symbols', { projectId: 'p1', query: 'run' }, 200, 'symbols'],
    ['POST', '/api/code/read-symbol', { projectId: 'p1', path: 'src/main.mjs', symbol: 'run' }, 200, 'readSymbol'],
    ['POST', '/api/code/search-advanced', { projectId: 'p1', kinds: ['todo'], query: 'retry' }, 200, 'searchAdvanced'],
    ['POST', '/api/code/ast-query', { projectId: 'p1', path: 'src/main.ts', nodeType: 'FunctionDeclaration' }, 200, 'astQuery'],
    ['POST', '/api/code/ast-patch', { projectId: 'p1', path: 'src/main.ts', nodeType: 'FunctionDeclaration', replacement: 'function run() {}', expectedSha256: 'a'.repeat(64), dryRun: true }, 200, 'astPatch'],
    ['POST', '/api/security/scan-artifacts', { projectId: 'p1', paths: ['dist'] }, 200, 'scanArtifacts'],
    ['POST', '/api/security/scan-dependencies', { projectId: 'p1', lockfilePath: 'package-lock.json' }, 200, 'scanDependencies'],
    ['POST', '/api/images/compare', { projectId: 'p1', baselinePath: 'a.png', actualPath: 'b.png' }, 200, 0.5],
    ['POST', '/api/sessions/s1/verify', { projectId: 'p1' }, 200, true],
    ['GET', '/api/git/status?projectId=p1', null, 200, true],
  ];
  for (const [method, value, body, expectedStatus, marker] of cases) {
    const url = new URL(value, 'http://localhost');
    const res = response();
    await routes(request(method, body), res, url);
    assert.equal(res.statusCode, expectedStatus, value);
    const payload = JSON.parse(res.body);
    assert.ok(JSON.stringify(payload).includes(String(marker)), `${value}: ${res.body}`);
  }
});

test('OperatingPlaneToolGateway exposes governed exact-symbol reads and mutations', async () => {
  const calls = [];
  const gateway = new OperatingPlaneToolGateway({
    projectResolver: () => ({ id: 'p1', workspaceRoot: '/workspace' }),
    symbolEditFactory: ({ projectRoot }) => ({
      async read(input) { calls.push(['read', projectRoot, input]); return { symbol: input.symbol, content: 'function run() {}' }; },
      async replace(input) { calls.push(['replace', projectRoot, input]); return { operation: 'replace', symbol: input.symbol }; },
      async insertBefore(input) { calls.push(['before', projectRoot, input]); return { operation: 'insert-before', symbol: input.symbol }; },
      async insertAfter(input) { calls.push(['after', projectRoot, input]); return { operation: 'insert-after', symbol: input.symbol }; },
    }),
  });
  const task = {
    id: 't1',
    projectId: 'p1',
    metadata: { operatingPlaneAllowedTools: ['code.readSymbol', 'code.replaceSymbol', 'code.insertBeforeSymbol', 'code.insertAfterSymbol'] },
  };
  assert.deepEqual(gateway.schemasForTask(task).map((schema) => schema.function.name), [
    'code.readSymbol', 'code.replaceSymbol', 'code.insertBeforeSymbol', 'code.insertAfterSymbol',
  ]);
  const read = await gateway.execute(task, 'code.readSymbol', { path: 'src/main.mjs', symbol: 'run', kind: 'function' });
  assert.equal(read.output.content, 'function run() {}');
  const replaced = await gateway.execute(task, 'code.replaceSymbol', { path: 'src/main.mjs', symbol: 'run', kind: 'function', content: 'function run() { return 1; }', expectedSha256: 'a'.repeat(64) });
  assert.equal(replaced.output.operation, 'replace');
  await gateway.execute(task, 'code.insertBeforeSymbol', { path: 'src/main.mjs', symbol: 'run', content: 'const x = 1;\n' });
  await gateway.execute(task, 'code.insertAfterSymbol', { path: 'src/main.mjs', symbol: 'run', content: '\nexport { run };' });
  assert.deepEqual(calls.map(([name]) => name), ['read', 'replace', 'before', 'after']);
});

test('OperatingPlaneToolGateway exposes bounded advanced repository search', async () => {
  const calls = [];
  const gateway = new OperatingPlaneToolGateway({
    projectResolver: () => ({ id: 'p1', workspaceRoot: '/workspace' }),
    advancedSearchFactory: ({ projectRoot }) => ({ async search(input) { calls.push([projectRoot, input]); return { schema: 'forge.repository-advanced-search.v1', items: [{ kind: 'todo', path: 'src/main.mjs', line: 2 }] }; } }),
  });
  const task = { id: 't1', projectId: 'p1', metadata: { operatingPlaneAllowedTools: ['code.searchAdvanced'] } };
  assert.deepEqual(gateway.schemasForTask(task).map((schema) => schema.function.name), ['code.searchAdvanced']);
  const result = await gateway.execute(task, 'code.searchAdvanced', { kinds: ['todo', 'diff'], query: 'retry', limit: 25 });
  assert.equal(result.output.items[0].kind, 'todo');
  assert.equal(calls[0][0], '/workspace');
  assert.deepEqual(calls[0][1].kinds, ['todo', 'diff']);
});



test('OperatingPlaneToolGateway exposes read-only AST query and explicitly authorized AST patch', async () => {
  const calls = [];
  const gateway = new OperatingPlaneToolGateway({
    projectResolver: () => ({ id: 'p1', workspaceRoot: '/workspace' }),
    astIntelligenceFactory: ({ projectRoot }) => ({
      async query(input) { calls.push(['query', projectRoot, input]); return { schema: 'forge.ast-query.v1', matched: 1, sourceSha256: 'a'.repeat(64) }; },
      async patch(input) { calls.push(['patch', projectRoot, input]); return { schema: 'forge.ast-patch.v1', dryRun: input.dryRun === true, applied: input.dryRun !== true }; },
    }),
  });
  const defaultTask = { id: 't-default', projectId: 'p1', metadata: {} };
  const defaultNames = gateway.schemasForTask(defaultTask).map((schema) => schema.function.name);
  assert.ok(defaultNames.includes('code.astQuery'));
  assert.ok(!defaultNames.includes('code.astPatch'));

  const task = { id: 't1', projectId: 'p1', metadata: { operatingPlaneAllowedTools: ['code.astQuery', 'code.astPatch'] } };
  const schemas = gateway.schemasForTask(task);
  assert.deepEqual(schemas.map((schema) => schema.function.name), ['code.astQuery', 'code.astPatch']);
  const patchSchema = schemas.find((schema) => schema.function.name === 'code.astPatch').function.parameters;
  assert.deepEqual(patchSchema.required, ['path', 'nodeType', 'replacement', 'expectedSha256']);
  assert.equal(patchSchema.properties.expectedSha256.pattern, '^[a-f0-9]{64}$');

  assert.equal((await gateway.execute(task, 'code.astQuery', { path: 'src/main.ts', nodeType: 'FunctionDeclaration' })).output.matched, 1);
  assert.equal((await gateway.execute(task, 'code.astPatch', { path: 'src/main.ts', nodeType: 'FunctionDeclaration', replacement: 'function run() {}', expectedSha256: 'a'.repeat(64), dryRun: true })).output.dryRun, true);
  assert.deepEqual(calls.map(([operation]) => operation), ['query', 'patch']);
});

test('Nolane Agent operating-plane release exposes a valid semantic version including prerelease channels', () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
});

test('OperatingPlaneToolGateway supports asynchronously constructed project subagent runtimes', async () => {
  const gateway = new OperatingPlaneToolGateway({
    projectResolver: () => ({ id: 'p1', workspaceRoot: '/workspace' }),
    subagentFactory: async ({ projectRoot }) => ({
      async run(input) { return { projectRoot, profileId: input.profileId, objective: input.objective }; },
    }),
  });
  const task = { id: 't1', projectId: 'p1', metadata: { operatingPlaneAllowedTools: ['agent.spawn'] } };
  const result = await gateway.execute(task, 'agent.spawn', { profileId: 'reviewer', objective: 'Review' });
  assert.equal(result.output.projectRoot, '/workspace');
  assert.equal(result.output.profileId, 'reviewer');
});

test('OperatingPlaneToolGateway exposes governed test detection and scoped execution', async () => {
  const calls = [];
  const gateway = new OperatingPlaneToolGateway({
    projectResolver: () => ({ id: 'p1', workspaceRoot: '/workspace' }),
    testEngineFactory: ({ projectRoot }) => ({
      async detect() { calls.push(['detect', projectRoot]); return [{ id: 'node-test' }]; },
      async run(input) { calls.push(['run', projectRoot, input]); return { status: 'pass', receipt: { receiptSha256: 'c'.repeat(64) } }; },
    }),
  });
  const task = { id: 't1', projectId: 'p1', metadata: { operatingPlaneAllowedTools: ['test.detect', 'test.run'] } };
  assert.deepEqual(gateway.schemasForTask(task).map((schema) => schema.function.name), ['test.detect', 'test.run']);
  assert.equal((await gateway.execute(task, 'test.detect')).output[0].id, 'node-test');
  assert.equal((await gateway.execute(task, 'test.run', { scope: 'file', path: 'tests/a.test.mjs' })).output.status, 'pass');
  assert.deepEqual(calls.map(([name]) => name), ['detect', 'run']);
});

test('HTTP routes expose test framework detection and governed test execution', async () => {
  const routes = createRoutes({
    store: { listProjects: () => [], getProject: () => null }, providers: {}, missionRunner: {},
    operatingPlane: { tests: async (operation, input) => ({ operation, input, status: operation === 'run' ? 'pass' : 'detected' }) },
  });
  for (const [pathname, operation] of [['/api/tests/detect', 'detect'], ['/api/tests/run', 'run']]) {
    const res = response();
    await routes(request('POST', { projectId: 'p1', scope: 'full' }), res, new URL(pathname, 'http://localhost'));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).operation, operation);
  }
});
