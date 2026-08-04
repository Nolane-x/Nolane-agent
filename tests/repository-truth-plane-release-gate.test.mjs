import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  measureRepositoryTruthPlane,
  REPOSITORY_TRUTH_PLANE_REQUIREMENT_IDS,
} from '../scripts/measure-repository-truth-plane.mjs';
import { verifyRepositoryTruthPlane } from '../src/release/repository-truth-plane-verifier.mjs';

const PROMOTED_IDS = Object.freeze(['32.2','32.3','32.4','32.7','32.9','32.10','32.11','32.12','32.15','32.17','32.18']);
async function exists(relative) { try { await access(path.resolve(relative)); return true; } catch { return false; } }
function statusById(audit) { return new Map(audit.sections.flatMap((section) => section.items).map((item) => [item.id, item.status])); }

test('3.3 Repository Truth Plane measurement is deterministic and uses real repository adapters', async () => {
  const first = await measureRepositoryTruthPlane({ rootDirectory: process.cwd(), version: '3.3.0' });
  const second = await measureRepositoryTruthPlane({ rootDirectory: process.cwd(), version: '3.3.0' });
  assert.equal(first.receiptSha256, second.receiptSha256);
  assert.deepEqual(first.promotedRequirementIds, PROMOTED_IDS);
  assert.deepEqual(REPOSITORY_TRUTH_PLANE_REQUIREMENT_IDS, PROMOTED_IDS);
  assert.deepEqual(first.workspace, {
    realGitRepository: true,
    branchDetected: true,
    worktreeDetected: true,
    dirtyStateDetected: true,
    editorOverlayIsolated: true,
  });
  for (const kind of ['public-api','internal-api','database-schema','configuration','build-target','external-dependency','service','layer','domain']) assert.ok(first.architecture.nodeKinds.includes(kind), kind);
  for (const kind of ['defines','references','calls','implements','verifies']) assert.ok(first.symbols.edgeKinds.includes(kind), kind);
  for (const kind of ['request','event','process','state','data-flow','reads','writes','controls']) assert.ok(first.runtime.edgeKinds.includes(kind), kind);
  assert.equal(first.provenance.allReturnedFactsCited, true);
  assert.equal(first.provenance.crossBranchFactRejected, true);
  assert.equal(first.provenance.sourceHashDriftInvalidated, true);
  assert.deepEqual(first.query.stageOrder, ['exact','lexical','ast-lsp','graph','git','test','semantic','runtime']);
  assert.equal(first.query.unavailableStagesExplicit, true);
  assert.equal(first.viewer.pageLoadedLessThanGraph, true);
  assert.equal(first.viewer.corruptCursorRejected, true);
  assert.deepEqual(first.boundaries, {
    externalGateCountChanged: false,
    comparativeSuperiorityClaimed: false,
    uncitedInferencePromoted: false,
    fullGraphLoadedForPage: false,
  });
  assert.match(first.receiptSha256, /^[a-f0-9]{64}$/);
});

test('3.3 release verifier requires source tests measurement audit transitions and non-claims', async (t) => {
  for (const relative of [
    'src/repository/repository-fact-ledger.mjs',
    'src/repository/repository-truth-map-builder.mjs',
    'src/repository/repository-evidence-query-planner.mjs',
    'src/repository/repository-truth-viewer.mjs',
    'src/repository/repository-workspace-state-adapter.mjs',
    'tests/repository-truth-plane-integration.test.mjs',
    'docs/repository-truth-plane-measurement-3.3.0.json',
    'docs/feature-audit-3.3.0.json',
    'docs/LIMITATIONS-3.3.0.md',
  ]) assert.equal(await exists(relative), true, `${relative} is missing`);
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-330-truth-gate-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const report = await verifyRepositoryTruthPlane({ rootDirectory: process.cwd(), version: '3.3.0', outputFile: path.join(output, 'report.json') });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.auditCounts, { verified_source_test: 996, partial: 91, external_gate: 63, not_implemented: 0 });
  assert.deepEqual(report.promotedRequirementIds, PROMOTED_IDS);
  assert.equal(report.boundaries.externalGateCountChanged, false);
  assert.equal(report.boundaries.comparativeSuperiorityClaimed, false);
  assert.equal(report.boundaries.uncitedInferencePromoted, false);
  assert.equal(report.boundaries.fullGraphLoadedForPage, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});

test('3.3 audit promotes exactly eleven Repository Digital Twin P0 requirements', async () => {
  const previous = JSON.parse(await readFile('docs/feature-audit-3.2.0.json', 'utf8'));
  const current = JSON.parse(await readFile('docs/feature-audit-3.3.0.json', 'utf8'));
  assert.deepEqual(current.summary, { verified_source_test: 996, partial: 91, external_gate: 63, not_implemented: 0 });
  const before = statusById(previous);
  const after = statusById(current);
  const changed = [...after].filter(([id, status]) => before.get(id) !== status).map(([id]) => id).sort();
  assert.deepEqual(changed, [...PROMOTED_IDS].sort());
  for (const id of PROMOTED_IDS) {
    assert.equal(before.get(id), 'partial');
    assert.equal(after.get(id), 'verified_source_test');
  }
});

test('full matrix includes Repository Truth Plane as required gate 72', async () => {
  const matrix = await readFile('src/release/full-release-matrix.mjs', 'utf8');
  assert.match(matrix, /id: 'repository-truth-plane'/);
  assert.match(matrix, /scripts\/verify-repository-truth-plane\.mjs/);
});
