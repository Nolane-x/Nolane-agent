import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { createHttpServer } from '../src/server/http-server.mjs';

const auth = (init = {}) => ({ ...init, headers: { authorization: 'Bearer evidence-token', 'content-type': 'application/json', ...(init.headers ?? {}) } });

function fakeRuntime(calls) {
  const method = (name, result) => async (input) => { calls.push([name, input]); return result; };
  return {
    index: method('index', { nodes: [], edges: [], receiptSha256: 'a'.repeat(64) }),
    retrieve: method('retrieve', { evidence: [], counterEvidence: [], omissions: [], receiptSha256: 'b'.repeat(64) }),
    packet: method('packet', { schema: 'forge.structured-context-packet.v1', evidence: [], counterEvidence: [], receiptSha256: 'c'.repeat(64) }),
    invalidate: method('invalidate', { invalidatedNodes: [], receiptSha256: 'd'.repeat(64) }),
    compact: method('compact', { artifactRef: 'artifact://x', receiptSha256: 'e'.repeat(64) }),
    proposeMemory: method('memory', { memoryId: 'm1', receiptSha256: 'f'.repeat(64) }),
    validateSubagentResult: method('subagent', { result: {}, receiptSha256: '1'.repeat(64) }),
    audit: method('audit', { ready: true, issues: [], receiptSha256: '2'.repeat(64) }),
    recover: method('recover', { actions: [], executed: false, receiptSha256: '3'.repeat(64) }),
    graph: method('graph', { nodes: [], edges: [], receiptSha256: '4'.repeat(64) }),
  };
}

test('evidence runtime API is authenticated, principal-bound, bounded, and never accepts a workspace root', async (t) => {
  const calls = [];
  const server = await createHttpServer({
    config: { host: '127.0.0.1', port: 0, authToken: 'evidence-token' },
    store: { listEvents: () => [], listProjects: () => [] }, providers: new ProviderRegistry(), missionRunner: {},
    evidenceContextRuntime: fakeRuntime(calls), uiRoot: path.resolve('ui'),
  });
  t.after(() => server.close());
  assert.equal((await fetch(`${server.url}/api/evidence-runtime/graph?projectId=p1`)).status, 401);

  const requests = [
    ['index', '/api/evidence-runtime/index', { nodes: [], edges: [], principalId: 'spoof', workspaceRoot: '/escape' }],
    ['retrieve', '/api/evidence-runtime/retrieve', { query: 'refresh token', hypothesis: 'reuse bug', principalId: 'spoof', workspaceRoot: '/escape' }],
    ['packet', '/api/evidence-runtime/packet', { goal: { objective: 'fix auth' }, completionCriteria: ['tests pass'], principalId: 'spoof', workspaceRoot: '/escape' }],
    ['invalidate', '/api/evidence-runtime/invalidate', { kind: 'file_changed', sourceRef: 'src/a.ts', principalId: 'spoof', workspaceRoot: '/escape' }],
    ['compact', '/api/evidence-runtime/compact', { title: 'long trace', fullContent: 'trace', principalId: 'spoof', workspaceRoot: '/escape' }],
    ['memory', '/api/evidence-runtime/memory', { fact: 'Uses pnpm', scope: 'repository', evidenceNodeIds: ['n1'], principalId: 'spoof', workspaceRoot: '/escape' }],
    ['subagent', '/api/evidence-runtime/subagent/validate', { result: { task: 'inspect', findings: [], evidence: [], filesExamined: [], hypothesesRejected: [], remainingUncertainty: [], recommendedNextAction: 'stop' }, principalId: 'spoof', workspaceRoot: '/escape' }],
    ['audit', '/api/evidence-runtime/audit', { packet: { receiptSha256: 'a'.repeat(64), evidence: [], counterEvidence: [], completionCriteria: [] }, principalId: 'spoof', workspaceRoot: '/escape' }],
    ['recover', '/api/evidence-runtime/recover', { recentToolCalls: [], testOutcomes: [], previousState: {}, currentState: {}, principalId: 'spoof', workspaceRoot: '/escape' }],
  ];
  for (const [, url, body] of requests) {
    const response = await fetch(`${server.url}${url}`, auth({ method: 'POST', body: JSON.stringify({ projectId: 'p1', ...body }) }));
    assert.ok([200, 201].includes(response.status), `${url} returned ${response.status}`);
  }
  assert.equal((await fetch(`${server.url}/api/evidence-runtime/graph?projectId=p1&limit=10&includeStale=false`, auth())).status, 200);
  for (const [, input] of calls) {
    assert.equal(input.principalId, 'local-admin');
    assert.equal(Object.hasOwn(input, 'workspaceRoot'), false);
  }
});
