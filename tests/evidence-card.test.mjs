import assert from 'node:assert/strict';
import test from 'node:test';

import { createEvidenceCard } from '../src/context/evidence-card.mjs';

const H = 'a'.repeat(64);

test('createEvidenceCard creates stable IDs from provenance and exact source spans', () => {
  const input = {
    source: 'structural', path: 'src/auth/session.mjs', symbol: 'validateSession',
    startLine: 84, endLine: 137, sourceHash: H, currentHash: H, text: 'export function validateSession() {}',
    branch: 'feature/session', worktree: 'wt-17', trust: 0.91, tokenCost: 246,
    supports: ['hypothesis-2'], contradicts: ['hypothesis-1'], claim: 'Expired sessions remain cached',
  };
  const a = createEvidenceCard(input);
  const b = createEvidenceCard(input);
  assert.equal(a.evidenceId, b.evidenceId);
  assert.deepEqual(a.lines, [84, 137]);
  assert.equal(a.freshness, 'fresh');
  assert.equal(a.branch, 'feature/session');
  assert.equal(a.worktree, 'wt-17');
  assert.equal(a.tokenCost, 246);
  assert.equal(Object.isFrozen(a), true);
});

test('createEvidenceCard marks mismatched current hashes stale and redacts secrets', () => {
  const card = createEvidenceCard({
    source: 'runtime', path: 'logs/test.log', startLine: 1, endLine: 2,
    sourceHash: H, currentHash: 'b'.repeat(64), text: 'Authorization: Bearer super-secret-token',
    claim: 'Request failed', trust: 0.8, tokenCost: 9,
  });
  assert.equal(card.freshness, 'stale');
  assert.equal(card.text.includes('super-secret-token'), false);
  assert.match(card.text, /REDACTED/);
});

test('createEvidenceCard validates source spans, hashes, trust and token cost', () => {
  assert.throws(() => createEvidenceCard({ source: 'code', path: 'a', startLine: 5, endLine: 4, sourceHash: H, claim: 'x', trust: 0.5, tokenCost: 1 }), /source span/i);
  assert.throws(() => createEvidenceCard({ source: 'code', path: 'a', startLine: 1, endLine: 1, sourceHash: 'bad', claim: 'x', trust: 0.5, tokenCost: 1 }), /sourceHash/i);
  assert.throws(() => createEvidenceCard({ source: 'code', path: 'a', startLine: 1, endLine: 1, sourceHash: H, claim: 'x', trust: 2, tokenCost: 1 }), /trust/i);
  assert.throws(() => createEvidenceCard({ source: 'code', path: 'a', startLine: 1, endLine: 1, sourceHash: H, claim: 'x', trust: 0.5, tokenCost: -1 }), /tokenCost/i);
});
