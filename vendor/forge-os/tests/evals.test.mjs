import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { evaluateCandidate, compareRuns } from '../src/evals/evaluator.mjs';

const requiredDomains = new Set(['saas','automation','developer-tools','browser-extensions','games','ai-products','data-platforms','mobile','desktop','ecommerce','enterprise','api-products']);

test('behavioral eval corpus covers every first-party product domain with explicit rubrics', async () => {
  const files = (await readdir('evals/cases')).filter(x => x.endsWith('.json'));
  assert.ok(files.length >= 24);
  const domains = new Set();
  for (const file of files) {
    const value = JSON.parse(await readFile(`evals/cases/${file}`, 'utf8'));
    assert.ok(value.id && value.domain && value.prompt && value.mode);
    assert.ok(Array.isArray(value.forbiddenPatterns));
    assert.ok(Array.isArray(value.requiredEvidence));
    assert.ok(value.rubric.novelty && value.rubric.usefulness && value.rubric.distinctMechanisms);
    domains.add(value.domain);
  }
  assert.deepEqual(domains, requiredDomains);
});

test('candidate skill evaluation rejects regressions and token-only growth', () => {
  const baseline = { passRate: 0.62, quality: 74, tokenCount: 10000, criticalFailures: 0 };
  assert.equal(evaluateCandidate(baseline, { passRate: 0.68, quality: 80, tokenCount: 11500, criticalFailures: 0 }).decision, 'promote');
  assert.equal(evaluateCandidate(baseline, { passRate: 0.60, quality: 78, tokenCount: 9000, criticalFailures: 0 }).decision, 'quarantine');
  assert.equal(evaluateCandidate(baseline, { passRate: 0.62, quality: 74, tokenCount: 16000, criticalFailures: 0 }).decision, 'quarantine');
  assert.equal(evaluateCandidate(baseline, { passRate: 0.90, quality: 95, tokenCount: 9000, criticalFailures: 1 }).decision, 'quarantine');
});

test('run comparison reports marginal quality, pass-rate, and token efficiency', () => {
  const result = compareRuns(
    [{ caseId: 'a', seed: 1, passed: true, quality: 80, tokens: 1000, criticalFailures: 0 }, { caseId: 'b', seed: 1, passed: false, quality: 50, tokens: 800, criticalFailures: 0 }],
    [{ caseId: 'a', seed: 1, passed: true, quality: 88, tokens: 900, criticalFailures: 0 }, { caseId: 'b', seed: 1, passed: true, quality: 72, tokens: 900, criticalFailures: 0 }]
  );
  assert.equal(result.baseline.passRate, 0.5);
  assert.equal(result.candidate.passRate, 1);
  assert.equal(result.delta.quality, 15);
  assert.ok(result.delta.tokenEfficiency > 0);
});
