import assert from 'node:assert/strict';
import test from 'node:test';
import { SemanticMergeAnalyzer } from '../src/collaboration/semantic-merge-analyzer.mjs';
const hash = (c) => c.repeat(64);

const analyzer = new SemanticMergeAnalyzer();

test('semantic merge blocks incompatible API assumptions even when files do not overlap', () => {
  const result = analyzer.analyze({ candidates: [
    { candidateId: 'backend', changedFiles: ['server/session.mjs'], changedSymbols: ['SessionApi'], apiAssumptions: [{ apiId: 'SessionApi', revision: 2, signature: 'get(): SessionV2' }] },
    { candidateId: 'frontend', changedFiles: ['ui/session.js'], changedSymbols: ['renderSession'], apiAssumptions: [{ apiId: 'SessionApi', revision: 1, signature: 'get(): SessionV1' }] },
  ], graphEdges: [{ from: 'renderSession', to: 'SessionApi', relation: 'calls', confidence: 0.95, provenanceReceiptSha256: hash('a') }] });
  assert.equal(result.status, 'blocked');
  assert.ok(result.findings.some((finding) => finding.kind === 'incompatible-api-assumption'));
});

test('semantic merge detects duplicated logic and shared symbol behavior conflict', () => {
  const result = analyzer.analyze({ candidates: [
    { candidateId: 'a', changedFiles: ['a.mjs'], changedSymbols: ['normalizeExpiry'], logicFingerprints: ['logic-x'], behaviorContracts: [{ symbolId: 'validate', effect: 'throws-on-expired' }] },
    { candidateId: 'b', changedFiles: ['b.mjs'], changedSymbols: ['validate'], logicFingerprints: ['logic-x'], behaviorContracts: [{ symbolId: 'validate', effect: 'returns-false-on-expired' }] },
  ] });
  assert.equal(result.status, 'blocked');
  assert.ok(result.findings.some((finding) => finding.kind === 'duplicate-logic'));
  assert.ok(result.findings.some((finding) => finding.kind === 'behavior-conflict'));
});

test('ambiguous low confidence evidence remains visible but non blocking', () => {
  const result = analyzer.analyze({ candidates: [{ candidateId: 'a', changedFiles: ['a.mjs'] }, { candidateId: 'b', changedFiles: ['b.mjs'] }], graphEdges: [{ from: 'a', to: 'b', relation: 'may-call', confidence: 0.3, ambiguous: true, provenanceReceiptSha256: hash('b') }] });
  assert.equal(result.status, 'pass-with-review');
  assert.equal(result.findings[0].blocking, false);
});
