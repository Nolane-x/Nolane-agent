import test from 'node:test';
import assert from 'node:assert/strict';
import { ArchitectureDriftSentinel } from '../src/repository/architecture-drift-sentinel.mjs';

test('ArchitectureDriftSentinel finds cycles, layer violations, duplicate logic, public boundary violations, and generated edits', () => {
  const sentinel = new ArchitectureDriftSentinel({ layerRules: [{ from: 'ui', deny: ['storage'] }], blockingSeverities: ['critical','high'] });
  const result = sentinel.evaluate({
    modules: [{ id: 'ui/a', layer: 'ui', public: true }, { id: 'storage/b', layer: 'storage', public: false }, { id: 'core/c', layer: 'core', public: true }],
    dependencies: [{ from: 'ui/a', to: 'storage/b', path: 'ui/a.js', line: 1 }, { from: 'storage/b', to: 'core/c', path: 'storage/b.js', line: 1 }, { from: 'core/c', to: 'ui/a', path: 'core/c.js', line: 1 }],
    logic: [{ id: 'f1', signature: 'sig-x', path: 'a.js' }, { id: 'f2', signature: 'sig-x', path: 'b.js' }],
    edits: [{ path: 'dist/app.js', sourceKind: 'build-output' }],
  });
  assert.ok(result.findings.some((x) => x.kind === 'dependency-cycle'));
  assert.ok(result.findings.some((x) => x.kind === 'layer-violation'));
  assert.ok(result.findings.some((x) => x.kind === 'duplicate-logic'));
  assert.ok(result.findings.some((x) => x.kind === 'internal-boundary-import'));
  assert.ok(result.findings.some((x) => x.kind === 'generated-or-build-edit'));
  assert.equal(result.blocked, true);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('ArchitectureDriftSentinel does not block low-confidence ambiguous evidence', () => {
  const sentinel = new ArchitectureDriftSentinel();
  const result = sentinel.evaluate({ dependencies: [{ from: 'a', to: 'b', ambiguous: true, confidence: 0.4 }] });
  assert.equal(result.blocked, false);
});
