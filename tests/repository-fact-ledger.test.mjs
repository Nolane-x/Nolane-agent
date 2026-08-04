import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RepositoryFactLedger,
  createBranchFingerprint,
  createFactInvalidationKey,
} from '../src/repository/repository-fact-ledger.mjs';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const baseBranch = Object.freeze({
  branch: 'feature/truth',
  worktree: '/workspace/truth',
  headSha: '1'.repeat(40),
  dirtyHash: 'clean',
  editorOverlayHash: null,
});

function fact(overrides = {}) {
  return {
    projectId: 'project_truth',
    kind: 'architecture',
    subject: 'src/auth.mjs#validateSession',
    predicate: 'belongs-to-service',
    object: 'auth-service',
    confidence: 'exact',
    provider: 'ast-lsp',
    branchContext: baseBranch,
    citation: { path: 'src/auth.mjs', line: 1, start: 0, end: 42, sourceHash: HASH_A },
    metadata: { language: 'javascript' },
    ...overrides,
  };
}

test('RepositoryFactLedger records immutable cited facts with deterministic identities', () => {
  const ledger = new RepositoryFactLedger({ maxFacts: 8 });
  const recorded = ledger.record(fact());
  const repeated = ledger.record(fact());
  assert.equal(recorded.id, repeated.id);
  assert.equal(recorded.branchFingerprint, createBranchFingerprint(baseBranch));
  assert.equal(recorded.invalidationKey, createFactInvalidationKey(recorded));
  assert.match(recorded.id, /^fact_[a-f0-9]{24}$/);
  assert.match(recorded.invalidationKey, /^[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(recorded), true);
  assert.equal(Object.isFrozen(recorded.citation), true);
  assert.throws(() => { recorded.metadata.language = 'python'; }, TypeError);
  assert.equal(ledger.size, 1);
});

test('RepositoryFactLedger rejects facts from another branch or worktree', () => {
  const ledger = new RepositoryFactLedger();
  ledger.record(fact());
  const otherBranch = ledger.query({ projectId: 'project_truth', branchContext: { ...baseBranch, branch: 'main' } });
  const otherWorktree = ledger.query({ projectId: 'project_truth', branchContext: { ...baseBranch, worktree: '/workspace/main' } });
  assert.deepEqual(otherBranch.facts, []);
  assert.equal(otherBranch.rejected[0].reason, 'branch-context-mismatch');
  assert.deepEqual(otherWorktree.facts, []);
  assert.equal(otherWorktree.rejected[0].reason, 'branch-context-mismatch');
});

test('RepositoryFactLedger invalidates a fact when the cited source hash changes', () => {
  const ledger = new RepositoryFactLedger();
  ledger.record(fact());
  const report = ledger.validate({
    projectId: 'project_truth',
    branchContext: baseBranch,
    resolveSourceHash: (path) => path === 'src/auth.mjs' ? HASH_B : null,
  });
  assert.deepEqual(report.valid, []);
  assert.equal(report.invalid.length, 1);
  assert.equal(report.invalid[0].reason, 'source-hash-mismatch');
  assert.equal(report.invalid[0].expectedSourceHash, HASH_A);
  assert.equal(report.invalid[0].actualSourceHash, HASH_B);
});

test('RepositoryFactLedger isolates unsaved editor overlays from disk facts and clears them independently', () => {
  const ledger = new RepositoryFactLedger();
  const disk = ledger.record(fact());
  const overlayContext = { ...baseBranch, editorOverlayHash: HASH_B };
  const overlay = ledger.record(fact({
    branchContext: overlayContext,
    object: 'auth-service-overlay',
    citation: { path: 'src/auth.mjs', line: 1, start: 0, end: 48, sourceHash: HASH_B, overlayId: 'editor:src/auth.mjs' },
  }));
  assert.notEqual(disk.id, overlay.id);
  assert.equal(ledger.query({ projectId: 'project_truth', branchContext: baseBranch }).facts.length, 1);
  const overlayResult = ledger.query({ projectId: 'project_truth', branchContext: overlayContext });
  assert.equal(overlayResult.facts.length, 1);
  assert.equal(overlayResult.facts[0].citation.overlayId, 'editor:src/auth.mjs');
  assert.equal(ledger.clearOverlay('editor:src/auth.mjs'), 1);
  assert.equal(ledger.query({ projectId: 'project_truth', branchContext: baseBranch }).facts.length, 1);
});

test('RepositoryFactLedger fails closed on uncited or malformed facts and remains bounded', () => {
  const ledger = new RepositoryFactLedger({ maxFacts: 2 });
  assert.throws(() => ledger.record(fact({ citation: null })), /citation/i);
  assert.throws(() => ledger.record(fact({ citation: { path: 'src/auth.mjs', sourceHash: 'short' } })), /sourceHash/i);
  ledger.record(fact({ subject: 'one' }));
  ledger.record(fact({ subject: 'two' }));
  ledger.record(fact({ subject: 'three' }));
  assert.equal(ledger.size, 2);
  const result = ledger.query({ projectId: 'project_truth', branchContext: baseBranch });
  assert.deepEqual(result.facts.map((item) => item.subject), ['two', 'three']);
  assert.equal(result.truncatedByLedgerLimit, true);
});
