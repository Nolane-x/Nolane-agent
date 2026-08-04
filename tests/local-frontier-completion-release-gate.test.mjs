import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { measureLocalFrontierCompletion, LOCAL_FRONTIER_VERIFIED_IDS, LOCAL_FRONTIER_EXTERNAL_IDS } from '../scripts/measure-local-frontier-completion.mjs';
import { verifyLocalFrontierCompletion } from '../src/release/local-frontier-completion-verifier.mjs';
import { verifyIntelligenceCompletionKernel } from '../src/release/intelligence-completion-kernel-verifier.mjs';
import { verifyVerifiedMissionRuntime } from '../src/release/verified-mission-runtime-verifier.mjs';
import { verifyRepositoryTruthPlane } from '../src/release/repository-truth-plane-verifier.mjs';
import { verifyConstructionSafetyCompletion } from '../src/release/construction-safety-completion-verifier.mjs';
import { verifyAdaptiveLearningTrustFabric } from '../src/release/adaptive-learning-trust-fabric-verifier.mjs';
import { verifyAdaptiveMicrokernel } from '../src/release/adaptive-microkernel-verifier.mjs';

function statusMap(audit) { return new Map(audit.sections.flatMap((section) => section.items).map((item) => [item.id, item.status])); }

test('4.0 local frontier measurement is deterministic and preserves honest external boundaries', async () => {
  const first = await measureLocalFrontierCompletion({ version: '4.0.0' });
  const second = await measureLocalFrontierCompletion({ version: '4.0.0' });
  assert.equal(first.receiptSha256, second.receiptSha256);
  assert.equal(first.promotedRequirementIds.length, 53);
  assert.equal(first.externalizedRequirementIds.length, 6);
  for (const group of ['contextSemantic','polyglot','memoryResourceCollaboration','productSecurityExperience','benchmark']) for (const value of Object.values(first[group])) assert.equal(value, true);
  for (const value of Object.values(first.externalBoundaries)) assert.equal(value, false);
});

test('4.0 audit changes exactly all 59 remaining partial requirements to verified or external', async () => {
  const previous = JSON.parse(await readFile('docs/feature-audit-3.5.0.json', 'utf8'));
  const current = JSON.parse(await readFile('docs/feature-audit-4.0.0.json', 'utf8'));
  assert.deepEqual(current.summary, { verified_source_test: 1081, partial: 0, external_gate: 69, not_implemented: 0 });
  const before = statusMap(previous); const after = statusMap(current);
  const changed = [...after].filter(([id, status]) => before.get(id) !== status).map(([id]) => id).sort();
  assert.deepEqual(changed, [...LOCAL_FRONTIER_VERIFIED_IDS, ...LOCAL_FRONTIER_EXTERNAL_IDS].sort());
  for (const id of LOCAL_FRONTIER_VERIFIED_IDS) assert.equal(after.get(id), 'verified_source_test', id);
  for (const id of LOCAL_FRONTIER_EXTERNAL_IDS) assert.equal(after.get(id), 'external_gate', id);
});

test('4.0 historical audit verifier runs against the current Nolane runtime-pure source and preserves non-claims', async (t) => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-local-frontier-gate-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const report = await verifyLocalFrontierCompletion({ rootDirectory: process.cwd(), version: '4.0.0', outputFile: path.join(output, 'report.json') });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.auditCounts, { verified_source_test: 1081, partial: 0, external_gate: 69, not_implemented: 0 });
  assert.equal(report.runtimePurity.externalRuntimeBundled, false);
  assert.equal(report.runtimePurity.verified, true);
});

test('full release matrix includes five local frontier completion gates after 3.5 gate 74', async () => {
  const source = await readFile('src/release/full-release-matrix.mjs', 'utf8');
  for (const id of ['local-context-semantic-completion','local-polyglot-evidence-completion','local-memory-resource-collaboration-completion','local-product-security-experience-completion','local-benchmark-completion']) assert.match(source, new RegExp(`id: '${id}'`));
  assert.match(source, /scripts\/verify-local-frontier-completion\.mjs/);
});


test('4.0 retains every 3.1-3.5 guarantee while the current product keeps external runtimes out of core packaging', async (t) => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-400-retention-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const reports = await Promise.all([
    verifyIntelligenceCompletionKernel({ rootDirectory: process.cwd(), version: '4.0.0', outputFile: path.join(output, 'intelligence.json') }),
    verifyVerifiedMissionRuntime({ rootDirectory: process.cwd(), version: '4.0.0', outputFile: path.join(output, 'mission.json') }),
    verifyRepositoryTruthPlane({ rootDirectory: process.cwd(), version: '4.0.0', outputFile: path.join(output, 'truth.json') }),
    verifyConstructionSafetyCompletion({ rootDirectory: process.cwd(), version: '4.0.0', outputFile: path.join(output, 'construction.json') }),
    verifyAdaptiveLearningTrustFabric({ rootDirectory: process.cwd(), version: '4.0.0', outputFile: path.join(output, 'learning.json') }),
    verifyAdaptiveMicrokernel({ rootDirectory: process.cwd(), version: '4.0.0', outputFile: path.join(output, 'microkernel.json') }),
  ]);
  assert.deepEqual(reports.map((report) => report.status), ['pass','pass','pass','pass','pass','pass']);
  for (const report of reports.slice(0, 5)) assert.deepEqual(report.auditCounts, { verified_source_test: 1081, partial: 0, external_gate: 69, not_implemented: 0 });
  assert.equal(reports[5].boundaries.externalRuntimeBundledInCore, false);
});
