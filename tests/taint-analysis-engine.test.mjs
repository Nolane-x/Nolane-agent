import test from 'node:test';
import assert from 'node:assert/strict';
import { TaintAnalysisEngine } from '../src/security/taint-analysis-engine.mjs';

const hash = (c) => c.repeat(64);

test('typed taint analysis blocks sanitizer mismatch before a shell sink', () => {
  const engine = new TaintAnalysisEngine();
  const report = engine.analyze({
    nodes: [
      { id: 'input', sourceHash: hash('a') },
      { id: 'sql-escape', sourceHash: hash('b') },
      { id: 'shell', sourceHash: hash('c') },
    ],
    edges: [
      { from: 'input', to: 'sql-escape', kind: 'data' },
      { from: 'sql-escape', to: 'shell', kind: 'call' },
    ],
    sources: [{ nodeId: 'input', label: 'repository-content', provenance: 'src/routes.mjs:10' }],
    sanitizers: [{ nodeId: 'sql-escape', forSink: 'sql' }],
    sinks: [{ nodeId: 'shell', kind: 'shell', impact: 'critical' }],
  });
  assert.equal(report.status, 'block');
  assert.equal(report.blockers.length, 1);
  assert.equal(report.findings[0].sanitizerMismatch, true);
  assert.deepEqual(report.findings[0].path.map((step) => step.nodeId), ['input', 'sql-escape', 'shell']);
});

test('typed matching sanitizer clears only the intended sink', () => {
  const engine = new TaintAnalysisEngine();
  const report = engine.analyze({
    nodes: [{ id: 'input' }, { id: 'shell-escape' }, { id: 'shell' }],
    edges: [{ from: 'input', to: 'shell-escape' }, { from: 'shell-escape', to: 'shell' }],
    sources: [{ nodeId: 'input', label: 'user-input', provenance: 'request.body' }],
    sanitizers: [{ nodeId: 'shell-escape', forSink: 'shell' }],
    sinks: [{ nodeId: 'shell', kind: 'shell', impact: 'critical' }],
  });
  assert.equal(report.status, 'pass');
  assert.equal(report.findings.length, 0);
});

test('ambiguous dynamic edges never become proof of safety', () => {
  const engine = new TaintAnalysisEngine();
  const report = engine.analyze({
    nodes: [{ id: 'tool-output' }, { id: 'dynamic-target' }],
    edges: [{ from: 'tool-output', to: 'dynamic-target', kind: 'dynamic-call', ambiguous: true }],
    sources: [{ nodeId: 'tool-output', label: 'tool-output', provenance: 'tool:1' }],
    sinks: [{ nodeId: 'dynamic-target', kind: 'dynamic-code', impact: 'high' }],
  });
  assert.equal(report.status, 'block');
  assert.equal(report.findings[0].ambiguous, true);
  assert.equal(report.claims.completeDataFlowAnalysis, false);
});
