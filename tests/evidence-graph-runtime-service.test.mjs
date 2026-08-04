import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';

import { EvidenceGraphRuntimeService } from '../src/context/evidence-graph-runtime-service.mjs';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-evidence-graph-'));
  const artifacts = [];
  const memoryCalls = [];
  let tick = 0;
  const service = new EvidenceGraphRuntimeService({
    version: '2.15.0',
    file: path.join(root, 'evidence.db'),
    projectResolver: (id) => id === 'project-1' ? { id, workspaceRoot: root } : null,
    contextStore: {
      async artifactize(request, scope) {
        const record = { id: `ctx_${String(artifacts.length + 1).padStart(20, '0')}_deadbeef`, sha256: HASH_B, bytes: String(request.content).length, kind: request.kind, refs: scope.refs };
        artifacts.push({ request, scope, record });
        return record;
      },
    },
    memorySidecar: {
      async propose(request) { memoryCalls.push(request); return { id: 'memory-1', ...request, status: 'candidate' }; },
    },
    clock: () => new Date(Date.UTC(2026, 6, 30, 0, 0, tick++)).toISOString(),
  });
  return { root, service, artifacts, memoryCalls, async close() { service.close(); await rm(root, { recursive: true, force: true }); } };
}

function seedInput() {
  return {
    projectId: 'project-1', principalId: 'user-1',
    nodes: [
      { key: 'req', type: 'Requirement', label: 'Refresh token rotates', content: { text: 'refresh token must rotate' }, sourceKind: 'requirement', sourceRef: 'REQ-7', sourceHash: HASH_A, version: '1', validUntil: 'requirement_changed', confidence: 1 },
      { key: 'file', type: 'File', label: 'token.ts', content: { path: 'src/auth/token.ts' }, sourceKind: 'file', sourceRef: 'src/auth/token.ts', sourceHash: HASH_A, version: '1', validUntil: 'file_changed', confidence: 1 },
      { key: 'fn', type: 'Function', label: 'rotateRefreshToken', content: { path: 'src/auth/token.ts', startLine: 42, endLine: 81 }, sourceKind: 'file', sourceRef: 'src/auth/token.ts', sourceHash: HASH_A, version: '1', validUntil: 'file_changed', confidence: 0.95 },
      { key: 'test', type: 'Test', label: 'auth.refresh', content: { path: 'tests/auth.refresh.test.ts' }, sourceKind: 'test', sourceRef: 'auth.refresh', sourceHash: HASH_A, version: 'run-1', validUntil: 'test_rerun', confidence: 1 },
      { key: 'error', type: 'Error', label: 'token reused', content: { message: 'token reused' }, sourceKind: 'test', sourceRef: 'auth.refresh', sourceHash: HASH_A, version: 'run-1', validUntil: 'test_rerun', confidence: 1 },
      { key: 'hypothesis', type: 'Hypothesis', label: 'storage race', content: { planId: 'plan-old' }, sourceKind: 'plan', sourceRef: 'plan-old', sourceHash: HASH_A, version: '1', validUntil: 'plan_revised', confidence: 0.6 },
      { key: 'dependency', type: 'Dependency', label: 'jsonwebtoken', content: { name: 'jsonwebtoken' }, sourceKind: 'dependency', sourceRef: 'jsonwebtoken', sourceHash: HASH_A, version: '9.0.0', validUntil: 'dependency_updated', confidence: 1 },
    ],
    edges: [
      { from: 'req', to: 'fn', type: 'proves', confidence: 0.9 },
      { from: 'fn', to: 'test', type: 'tested_by', confidence: 1 },
      { from: 'test', to: 'error', type: 'failed_with', confidence: 1 },
      { from: 'hypothesis', to: 'error', type: 'contradicts', confidence: 0.7 },
    ],
  };
}

test('stores typed evidence graph with provenance, receipts, and idempotency', async () => {
  const fx = await fixture();
  try {
    const first = fx.service.index(seedInput());
    assert.equal(first.nodes.length, 7);
    assert.equal(first.edges.length, 4);
    assert.match(first.receiptSha256, /^[a-f0-9]{64}$/);
    assert.ok(first.nodes.every((node) => node.projectId === 'project-1' && node.principalId === 'user-1'));
    assert.ok(first.nodes.every((node) => node.sourceHash === HASH_A && node.status === 'active'));

    const second = fx.service.index(seedInput());
    assert.deepEqual(second.nodes.map((node) => node.id), first.nodes.map((node) => node.id));
    const graph = fx.service.graph({ projectId: 'project-1', principalId: 'user-1' });
    assert.equal(graph.nodes.length, 7);
    assert.equal(graph.edges.length, 4);
    assert.match(graph.receiptSha256, /^[a-f0-9]{64}$/);

    assert.throws(() => fx.service.index({ projectId: 'project-1', principalId: 'user-1', nodes: [{ type: 'Unknown', label: 'bad', sourceKind: 'file', sourceRef: 'x', sourceHash: HASH_A }] }), /node type/i);
    assert.throws(() => fx.service.graph({ projectId: 'project-2', principalId: 'user-1' }), /unknown project/i);
  } finally { await fx.close(); }
});

test('invalidates leases for file, test, plan, and dependency changes', async () => {
  const fx = await fixture();
  try {
    fx.service.index(seedInput());
    const file = fx.service.invalidate({ projectId: 'project-1', principalId: 'user-1', kind: 'file_changed', target: 'src/auth/token.ts', currentHash: HASH_B });
    assert.equal(file.invalidated, 2);
    const testRun = fx.service.invalidate({ projectId: 'project-1', principalId: 'user-1', kind: 'test_rerun', target: 'auth.refresh', currentVersion: 'run-2' });
    assert.equal(testRun.invalidated, 2);
    const plan = fx.service.invalidate({ projectId: 'project-1', principalId: 'user-1', kind: 'plan_revised', target: 'plan-new' });
    assert.equal(plan.invalidated, 1);
    const dependency = fx.service.invalidate({ projectId: 'project-1', principalId: 'user-1', kind: 'dependency_updated', target: 'jsonwebtoken', currentVersion: '10.0.0' });
    assert.equal(dependency.invalidated, 1);

    const active = fx.service.graph({ projectId: 'project-1', principalId: 'user-1' });
    assert.equal(active.nodes.length, 1);
    assert.equal(active.nodes[0].type, 'Requirement');
    assert.equal(active.edges.length, 0);
    const all = fx.service.graph({ projectId: 'project-1', principalId: 'user-1', includeStale: true });
    assert.equal(all.nodes.filter((node) => node.status === 'stale').length, 6);
    assert.ok(all.edges.some((edge) => edge.status === 'stale'));
  } finally { await fx.close(); }
});

test('lossless compaction stores full content and keeps only summary references in graph', async () => {
  const fx = await fixture();
  try {
    const indexed = fx.service.index(seedInput());
    const evidenceNodeId = indexed.nodes.find((node) => node.type === 'Requirement').id;
    const compacted = await fx.service.compact({
      projectId: 'project-1', principalId: 'user-1', kind: 'conversation',
      fullContent: 'full transcript\n'.repeat(100),
      summary: 'Decision: rotate refresh tokens.',
      unresolved: ['Check multi-device sessions'],
      evidenceNodeIds: [evidenceNodeId],
      sourceRef: 'session-1', sourceHash: HASH_A,
    });
    assert.equal(fx.artifacts.length, 1);
    assert.equal(fx.artifacts[0].request.kind, 'evidence-context-compaction');
    assert.ok(String(fx.artifacts[0].request.content).includes('full transcript'));
    assert.equal(compacted.node.content.summary, 'Decision: rotate refresh tokens.');
    assert.equal(compacted.node.content.artifactId, fx.artifacts[0].record.id);
    assert.deepEqual(compacted.node.content.unresolved, ['Check multi-device sessions']);
    assert.ok(!JSON.stringify(compacted.node.content).includes('full transcript'));
    assert.ok(compacted.edges.some((edge) => edge.type === 'depends_on'));
  } finally { await fx.close(); }
});

test('memory proposals require active evidence and subagent handoffs require structured evidence', async () => {
  const fx = await fixture();
  try {
    const indexed = fx.service.index(seedInput());
    const req = indexed.nodes.find((node) => node.type === 'Requirement');
    await assert.rejects(() => fx.service.proposeMemory({ projectId: 'project-1', principalId: 'user-1', title: 'Package manager', content: 'Uses pnpm', evidenceNodeIds: [] }), /evidence/i);
    const memory = await fx.service.proposeMemory({ projectId: 'project-1', principalId: 'user-1', title: 'Refresh invariant', content: 'Refresh tokens rotate', kind: 'invariant', confidence: 0.98, evidenceNodeIds: [req.id] });
    assert.equal(memory.status, 'candidate');
    assert.equal(fx.memoryCalls.length, 1);
    assert.match(fx.memoryCalls[0].createdCommit ?? '', /^evidence:/);

    assert.throws(() => fx.service.validateSubagentResult({ projectId: 'project-1', principalId: 'user-1', result: { task: 'investigate' } }), /findings/i);
    const validated = fx.service.validateSubagentResult({
      projectId: 'project-1', principalId: 'user-1',
      result: {
        task: 'Find refresh-token root cause',
        findings: ['Rotation function is the relevant implementation'],
        evidence: [req.id],
        filesExamined: ['src/auth/token.ts'],
        hypothesesRejected: ['Cookie expiry alone explains reuse'],
        remainingUncertainty: ['Multi-device behavior'],
        recommendedNextAction: 'Run the refresh-token integration test',
      },
    });
    assert.equal(validated.result.evidence[0], req.id);
    assert.match(validated.receiptSha256, /^[a-f0-9]{64}$/);

    fx.service.invalidate({ projectId: 'project-1', principalId: 'user-1', kind: 'requirement_changed', target: 'REQ-7' });
    assert.throws(() => fx.service.validateSubagentResult({ projectId: 'project-1', principalId: 'user-1', result: { task: 'x', findings: [], evidence: [req.id], filesExamined: [], hypothesesRejected: [], remainingUncertainty: [], recommendedNextAction: 'stop' } }), /active evidence/i);
  } finally { await fx.close(); }
});
