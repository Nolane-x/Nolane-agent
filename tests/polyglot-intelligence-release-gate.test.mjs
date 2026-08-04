import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
async function exists(relative) { try { await access(path.resolve(relative)); return true; } catch { return false; } }

test('2.22 release gate proves polyglot intelligence while preserving external-runtime non-claims', async (t) => {
  for (const relative of ['src/release/polyglot-runtime-intelligence-verifier.mjs','scripts/verify-polyglot-runtime-intelligence.mjs','scripts/measure-polyglot-runtime-intelligence.mjs','docs/polyglot-runtime-intelligence-measurement-2.22.0.json','docs/feature-audit-2.22.0.json','docs/LIMITATIONS-2.22.0.md']) assert.equal(await exists(relative), true, `${relative} missing`);
  const matrix = await readFile('src/release/full-release-matrix.mjs','utf8');
  assert.match(matrix,/id: 'polyglot-runtime-intelligence'/);
  const audit = JSON.parse(await readFile('docs/feature-audit-2.22.0.json','utf8'));
  assert.deepEqual(audit.summary,{verified_source_test:774,partial:37,external_gate:56,not_implemented:283});
  const output = await mkdtemp(path.join(os.tmpdir(),'forge-222-gate-')); t.after(()=>rm(output,{recursive:true,force:true}));
  const { verifyPolyglotRuntimeIntelligence } = await import('../src/release/polyglot-runtime-intelligence-verifier.mjs');
  const report = await verifyPolyglotRuntimeIntelligence({rootDirectory:path.resolve('.'),version:'2.22.0',outputFile:path.join(output,'report.json')});
  assert.equal(report.status,'pass');
  assert.equal(report.measurement.capabilities.clangd.available,true);
  assert.equal(report.measurement.capabilities.sourcekitLsp.available,true);
  assert.equal(report.measurement.capabilities.treeSitter.operated,false);
  assert.equal(report.measurement.lspContract.rename,true);
  assert.equal(report.measurement.graph.ambiguityPreserved,true);
  assert.equal(report.measurement.runtime.secretRedacted,true);
  assert.equal(report.measurement.drift.blocked,true);
  assert.equal(report.boundaries.productionTreeSitterClaimed,false);
  assert.match(report.receiptSha256,/^[a-f0-9]{64}$/);
});
