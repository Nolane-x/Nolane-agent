import assert from 'node:assert/strict';
import test from 'node:test';

import { DiagnosticDeltaService } from '../src/testing/diagnostic-delta-service.mjs';

test('DiagnosticDeltaService distinguishes new, persisting, and resolved structured failures', () => {
  const service = new DiagnosticDeltaService();
  const result = service.compare({
    baseline: 'src/a.mjs:2:4 error TS1001: old issue\nsrc/removed.mjs:1:1 warning W1: old warning\n',
    current: 'src/a.mjs:2:4 error TS1001: old issue\nsrc/new.mjs:8:3 error E_NEW: new regression token-secret\n',
    secretValues: ['token-secret'],
  });
  assert.equal(result.summary.new, 1);
  assert.equal(result.summary.persisting, 1);
  assert.equal(result.summary.resolved, 1);
  assert.equal(result.newDiagnostics[0].path, 'src/new.mjs');
  assert.doesNotMatch(JSON.stringify(result), /token-secret/);
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
});

test('DiagnosticDeltaService parses compiler parenthesized positions and bounds unstructured fallback', () => {
  const service = new DiagnosticDeltaService({ maxDiagnostics: 3 });
  const result = service.compare({ baseline: '', current: 'src/app.ts(10,5): error TS2322: Type mismatch\nError: build failed\nnoise\n' });
  assert.equal(result.newDiagnostics[0].code, 'TS2322');
  assert.equal(result.newDiagnostics[0].line, 10);
  assert.ok(result.newDiagnostics.length <= 3);
});
