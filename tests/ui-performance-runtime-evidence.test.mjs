import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('runtime performance evidence uses the canonical UI budgets and remains candidate-only', async () => {
  const source = await readFile('scripts/capture-ui-performance-evidence.mjs', 'utf8');

  assert.match(source, /homeInteractiveMs:\s*250/);
  assert.match(source, /routeSwitchP95Ms:\s*100/);
  assert.match(source, /longTaskMaxMs:\s*50/);
  assert.match(source, /idleCpuPercent:\s*1/);
  assert.match(source, /homeDomNodes:\s*1200/);
  assert.match(source, /homeRendererMemoryBytes:\s*180\s*\*\s*1024\s*\*\s*1024/);
  assert.match(source, /Performance\.getMetrics/);
  assert.match(source, /Memory\.getDOMCounters/);
  assert.match(source, /TaskDuration/);
  assert.match(source, /JSHeapUsedSize/);
  assert.match(source, /PerformanceObserver/);
  assert.match(source, /warmRoute/);
  assert.match(source, /candidate_unverified/);
  assert.match(source, /finalDecision:\s*'external_gate'/);
  assert.match(source, /'NOL-UI-032':\s*'external_gate'/);
  assert.match(source, /'NOL-UI-002':\s*'external_gate'/);
  assert.match(source, /readyToShowMs:\s*null/);
  assert.doesNotMatch(source, /finalDecision:\s*'pass'|windows8GbCertified:\s*true/);
});
