import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { PolyglotEvidenceRuntime } from '../src/frontier-completion/polyglot-evidence-runtime.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const citation = (path, symbol = null) => ({ path, symbol, sourceHash: sha(`${path}:${symbol ?? ''}`), startLine: 1, endLine: 20 });

test('polyglot call graph records direct and ambiguous dynamic edges with confidence and citations', () => {
  const runtime = new PolyglotEvidenceRuntime();
  runtime.ingestCalls([
    { language: 'javascript', from: 'api.handler', to: 'service.run', confidence: 1, citation: citation('src/api.js', 'handler') },
    { language: 'python', from: 'plugin.dispatch', candidates: ['a.run', 'b.run'], confidence: 0.55, citation: citation('plugin.py', 'dispatch') },
  ]);
  const graph = runtime.callGraph();
  assert.equal(graph.edges.length, 3);
  assert.equal(graph.edges.filter((edge) => edge.ambiguous).length, 2);
  assert.equal(graph.edges.every((edge) => /^[a-f0-9]{64}$/.test(edge.receiptSha256)), true);
});

test('type graph combines inheritance, interfaces, implementation and dynamic dispatch evidence', () => {
  const runtime = new PolyglotEvidenceRuntime();
  runtime.ingestTypes([
    { language: 'java', kind: 'extends', from: 'Dog', to: 'Animal', citation: citation('Dog.java', 'Dog') },
    { language: 'go', kind: 'implements', from: 'FileStore', to: 'Store', citation: citation('store.go', 'FileStore') },
    { language: 'typescript', kind: 'dynamic-dispatch', from: 'Controller.save', to: 'Store.save', confidence: 0.7, ambiguous: true, citation: citation('controller.ts', 'save') },
  ]);
  const graph = runtime.typeGraph();
  assert.deepEqual(graph.edges.map((edge) => edge.kind), ['extends', 'implements', 'dynamic-dispatch']);
  assert.equal(graph.edges.at(-1).ambiguous, true);
});

test('build graph merges package-manager, compiler and workspace metadata with provenance', () => {
  const runtime = new PolyglotEvidenceRuntime();
  runtime.ingestBuild({
    packages: [{ id: 'web', manager: 'npm', dependsOn: ['core'], citation: citation('package.json') }],
    compilerTargets: [{ id: 'core', compiler: 'go', outputs: ['bin/core'], citation: citation('go.mod') }],
    workspaces: [{ id: 'root', members: ['web', 'core'], citation: citation('workspace.json') }],
  });
  const graph = runtime.buildGraph();
  assert.equal(graph.nodes.some((node) => node.id === 'bin/core'), true);
  assert.equal(graph.edges.some((edge) => edge.kind === 'workspace-member'), true);
  assert.equal(graph.edges.every((edge) => edge.citation.sourceHash), true);
});

test('test graph joins tests and line coverage to symbols', () => {
  const runtime = new PolyglotEvidenceRuntime();
  runtime.ingestTests({
    tests: [{ id: 'account.test', targets: ['AccountService.save'], citation: citation('tests/account.test.js') }],
    coverage: [{ testId: 'account.test', symbol: 'AccountService.save', path: 'src/account.js', lines: [10, 11, 12], citation: citation('coverage.json') }],
  });
  const graph = runtime.testGraph();
  assert.equal(graph.edges.some((edge) => edge.kind === 'tests-symbol'), true);
  assert.equal(graph.edges.some((edge) => edge.kind === 'covers-lines' && edge.lines.length === 3), true);
});

test('sandbox runtime trace captures calls, exceptions, requests, events, state and database queries only with permission receipt', () => {
  const runtime = new PolyglotEvidenceRuntime();
  const permissionReceipt = { scope: ['runtime.trace', 'network.observe', 'database.observe'], receiptSha256: sha('permission') };
  const report = runtime.ingestRuntime({
    traceId: 'trace-1', permissionReceipt,
    observations: [
      { kind: 'call', from: 'route.getUser', to: 'repo.findUser', atMs: 1 },
      { kind: 'exception', symbol: 'repo.findUser', errorType: 'TimeoutError', atMs: 2 },
      { kind: 'request', method: 'GET', target: '/users/1', symbol: 'route.getUser', atMs: 3 },
      { kind: 'event', name: 'user.loaded', symbol: 'route.getUser', atMs: 4 },
      { kind: 'state-transition', from: 'loading', to: 'ready', symbol: 'UserView', atMs: 5 },
      { kind: 'database-query', operation: 'SELECT', target: 'users', symbol: 'repo.findUser', atMs: 6 },
    ],
  });
  assert.equal(report.observations, 6);
  assert.equal(runtime.runtimeGraph().edges.some((edge) => edge.kind === 'exception-path'), true);
  assert.equal(runtime.runtimeGraph().edges.some((edge) => edge.kind === 'database-query'), true);
  assert.throws(() => runtime.ingestRuntime({ traceId: 'bad', observations: [] }), /permission/i);
});

test('runtime resource access is attributed to the causal symbol and task', () => {
  const runtime = new PolyglotEvidenceRuntime();
  const permissionReceipt = { scope: ['runtime.trace', 'resource.observe'], receiptSha256: sha('resource-permission') };
  runtime.ingestRuntime({ traceId: 'trace-r', permissionReceipt, observations: [
    { kind: 'file-access', operation: 'write', target: '/tmp/out.json', symbol: 'Exporter.write', taskId: 'task-7', atMs: 1 },
    { kind: 'network-access', operation: 'connect', target: '127.0.0.1:3000', symbol: 'Client.call', taskId: 'task-7', atMs: 2 },
    { kind: 'process-access', operation: 'spawn', target: 'git', symbol: 'GitRunner.run', taskId: 'task-7', atMs: 3 },
  ] });
  const access = runtime.resourceAttribution();
  assert.deepEqual(access.map((entry) => entry.kind), ['file-access', 'network-access', 'process-access']);
  assert.equal(access.every((entry) => entry.taskId === 'task-7' && entry.symbol), true);
});

test('uncited static evidence is rejected rather than promoted to a graph fact', () => {
  const runtime = new PolyglotEvidenceRuntime();
  assert.throws(() => runtime.ingestCalls([{ language: 'ruby', from: 'a', to: 'b', confidence: 1 }]), /citation/i);
});
