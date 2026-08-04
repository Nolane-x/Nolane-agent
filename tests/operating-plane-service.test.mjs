import test from 'node:test';
import assert from 'node:assert/strict';
import { OperatingPlaneService } from '../src/agent/operating-plane-service.mjs';
import { OperatingPlaneToolGateway } from '../src/agent/operating-plane-tool-gateway.mjs';

test('OperatingPlaneService exposes honest capabilities and routes project-scoped operations', async () => {
  const calls = [];
  const project = { id: 'p1', workspaceRoot: '/workspace/p1' };
  const service = new OperatingPlaneService({
    version: '1.0.0',
    projectResolver: (id) => id === 'p1' ? project : null,
    profileLoader: { async loadProjectProfiles(root) { calls.push(['profiles', root]); return [{ id: 'reviewer' }]; } },
    codeIntelligence: {
      async workspaceSymbols(input) { calls.push(['symbols', input]); return { source: 'lsp', items: [] }; },
      async definition(input) { calls.push(['definition', input]); return { source: 'lsp', items: [] }; },
      async references(input) { calls.push(['references', input]); return { source: 'lsp', items: [] }; },
      async callHierarchy(input) { calls.push(['callHierarchy', input]); return { source: 'lsp', result: {} }; },
    },
    imageComparisonFactory: ({ projectRoot }) => ({ async compare(input) { calls.push(['visual', projectRoot, input]); return { changedRatio: 0 }; } }),
    astIntelligenceFactory: ({ projectRoot }) => ({
      async query(input) { calls.push(['astQuery', projectRoot, input]); return { schema: 'forge.ast-query.v1', matched: 1 }; },
      async patch(input) { calls.push(['astPatch', projectRoot, input]); return { schema: 'forge.ast-patch.v1', applied: input.dryRun !== true }; },
    }),
    gitGatewayFactory: ({ projectRoot }) => ({
      async status() { calls.push(['status', projectRoot]); return { branch: 'main' }; },
      async diff(input) { calls.push(['diff', projectRoot, input]); return { patch: '' }; },
    }),
    sessionLedgerFactory: async ({ sessionId }) => ({
      async verify() { calls.push(['verify', sessionId]); return { valid: true }; },
      async checkpoint(input) { calls.push(['checkpoint', sessionId, input]); return { seq: 1 }; },
      async rewind(targetSeq, input) { calls.push(['rewind', sessionId, targetSeq, input]); return { seq: 2 }; },
      async fork(input) { calls.push(['fork', sessionId, input]); return { sessionId: input.newSessionId }; },
    }),
    capabilities: ['hooks', 'subagents', 'rewind', 'lsp', 'typed-git', 'visual-diff', 'cli', 'sdk'],
    externalGates: [{ id: 'authenticode', state: 'requires-external-credential' }],
  });

  const status = await service.status();
  assert.equal(status.version, '1.0.0');
  assert.equal(status.capabilities.includes('lsp'), true);
  assert.deepEqual(status.externalGates, [{ id: 'authenticode', state: 'requires-external-credential' }]);
  assert.deepEqual(await service.listProfiles('p1'), [{ id: 'reviewer' }]);
  assert.equal((await service.code('symbols', { projectId: 'p1', languageId: 'javascript' })).source, 'lsp');
  assert.equal((await service.code('astQuery', { projectId: 'p1', path: 'src/main.ts', nodeType: 'FunctionDeclaration' })).matched, 1);
  assert.equal((await service.code('astPatch', { projectId: 'p1', path: 'src/main.ts', nodeType: 'FunctionDeclaration', replacement: 'function run() {}', expectedSha256: 'a'.repeat(64), dryRun: true })).applied, false);
  assert.equal((await service.compareImages({ projectId: 'p1', baselinePath: 'a.png', actualPath: 'b.png' })).changedRatio, 0);
  assert.equal((await service.git('status', { projectId: 'p1' })).branch, 'main');
  assert.equal((await service.session('verify', { sessionId: 's1' })).valid, true);
  assert.equal((await service.session('checkpoint', { sessionId: 's1', repository: { head: 'abc' } })).seq, 1);
  assert.equal((await service.session('rewind', { sessionId: 's1', targetSeq: 1, reason: 'retry' })).seq, 2);
  assert.equal((await service.session('fork', { sessionId: 's1', newSessionId: 's2', targetSeq: 1 })).sessionId, 's2');
  assert.ok(calls.some(([name]) => name === 'symbols'));
  assert.ok(calls.some(([name]) => name === 'astQuery'));
  assert.ok(calls.some(([name]) => name === 'astPatch'));
});

test('OperatingPlaneService fails closed for unknown projects and operations', async () => {
  const service = new OperatingPlaneService({ version: '1.0.0', projectResolver: () => null });
  await assert.rejects(() => service.listProfiles('missing'), (error) => error.code === 'OPERATING_PLANE_PROJECT_NOT_FOUND' && error.statusCode === 404);
  await assert.rejects(() => service.code('unknown', { projectId: 'missing' }), (error) => error.code === 'OPERATING_PLANE_OPERATION_INVALID');
  await assert.rejects(() => service.session('rewind', { sessionId: 's1' }), (error) => error.code === 'OPERATING_PLANE_INPUT_INVALID');
});

test('OperatingPlaneToolGateway exposes governed artifact and dependency security scans', async () => {
  const calls = [];
  const gateway = new OperatingPlaneToolGateway({
    projectResolver: () => ({ id: 'p1', workspaceRoot: '/workspace' }),
    artifactSecurityFactory: ({ projectRoot }) => ({
      async scanArtifacts(input) { calls.push(['artifacts', projectRoot, input]); return { status: 'pass', receiptSha256: 'd'.repeat(64) }; },
      async scanDependencies(input) { calls.push(['dependencies', projectRoot, input]); return { status: 'pass', receiptSha256: 'e'.repeat(64) }; },
    }),
  });
  const task = { id: 't1', projectId: 'p1', metadata: { operatingPlaneAllowedTools: ['security.scanArtifacts', 'security.scanDependencies'] } };
  assert.deepEqual(gateway.schemasForTask(task).map((schema) => schema.function.name), ['security.scanArtifacts', 'security.scanDependencies']);
  assert.equal((await gateway.execute(task, 'security.scanArtifacts', { paths: ['dist'] })).output.status, 'pass');
  assert.equal((await gateway.execute(task, 'security.scanDependencies', { lockfilePath: 'package-lock.json' })).output.status, 'pass');
  assert.deepEqual(calls.map(([kind]) => kind), ['artifacts', 'dependencies']);
});
