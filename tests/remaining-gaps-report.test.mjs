import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

import { buildRemainingGapsReport, renderRemainingGapsMarkdown, writeRemainingGapsReport, verifyRemainingGapsReport } from '../src/release/remaining-gaps-report.mjs';

const AUDIT = {
  schema: 'forge.studio.feature-audit.v1', productVersion: '1.7.0', totalItems: 4,
  summary: { verified_source_test: 1, partial: 1, external_gate: 1, not_implemented: 1 },
  sections: [{ number: 4, title: 'UI', items: [
    { id: '4.1', text: 'Done', status: 'verified_source_test', evidence: ['done.mjs'], note: 'done' },
    { id: '4.2', text: 'Partial', status: 'partial', evidence: ['partial.mjs'], note: 'needs direct behavior' },
    { id: '4.3', text: 'External', status: 'external_gate', evidence: [], note: 'requires credentials' },
    { id: '4.4', text: 'Missing', status: 'not_implemented', evidence: [], note: 'missing' },
  ] }],
};

test('remaining gaps report lists every non-verified item with explicit completion conditions', () => {
  const report = buildRemainingGapsReport(AUDIT);
  assert.equal(report.totalOpen, 3);
  assert.deepEqual(report.summary, { partial: 1, external_gate: 1, not_implemented: 1 });
  assert.deepEqual(report.items.map((item) => item.id), ['4.2', '4.3', '4.4']);
  for (const item of report.items) {
    assert.ok(item.reason.length > 0);
    assert.ok(item.completionCondition.length > 0);
  }
  const markdown = renderRemainingGapsMarkdown(report);
  assert.match(markdown, /Còn lại: \*\*3\*\*/);
  assert.match(markdown, /4\.2 — Partial/);
  assert.match(markdown, /Điều kiện hoàn tất/);
  assert.doesNotMatch(markdown, /4\.1 — Done/);
});

test('remaining gaps report verify mode detects stale tracked documentation', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-gaps-report-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const auditFile = path.join(root, 'audit.json');
  const markdownFile = path.join(root, 'REMAINING-GAPS-1.7.0.md');
  const jsonFile = path.join(root, 'release', 'remaining-gaps-1.7.0.json');
  await writeFile(auditFile, `${JSON.stringify(AUDIT)}\n`);
  const written = await writeRemainingGapsReport({ auditFile, markdownFile, jsonFile });
  assert.equal(written.totalOpen, 3);
  await verifyRemainingGapsReport({ auditFile, markdownFile, jsonFile });
  await writeFile(markdownFile, '# stale\n');
  await assert.rejects(() => verifyRemainingGapsReport({ auditFile, markdownFile, jsonFile }), /Remaining gaps documentation is stale/);
  assert.equal(JSON.parse(await readFile(jsonFile, 'utf8')).totalOpen, 3);
});


test('frontier audit generation emits a remaining-gaps document accepted by the canonical verifier', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-frontier-gaps-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'docs'), { recursive: true });
  const frontier = {
    schema: 'forge.studio.frontier-requirements.v1', productVersion: '3.0.0', totalItems: 3,
    summary: { verified_source_test: 1, partial: 1, external_gate: 0, not_implemented: 1 },
    sections: [{ number: 29, title: 'Decision Efficiency', items: [
      { id: '29.1', text: 'Verified criterion', status: 'not_implemented', note: 'planned' },
      { id: '29.3', text: 'Partial criterion', status: 'not_implemented', note: 'planned' },
      { id: '29.19', text: 'Future criterion', status: 'not_implemented', note: 'planned' },
    ] }],
    governance: {},
  };
  await writeFile(path.join(root, 'docs', 'frontier-requirements-3.0.0.json'), `${JSON.stringify(frontier)}
`);
  await execFileAsync(process.execPath, [path.resolve('scripts/generate-frontier-feature-audit.mjs'), root, '2.20.0']);
  const auditFile = path.join(root, 'docs', 'feature-audit-2.20.0.json');
  const markdownFile = path.join(root, 'docs', 'REMAINING-GAPS-2.20.0.md');
  const jsonFile = path.join(root, 'release', 'remaining-gaps-2.20.0.json');
  const report = await verifyRemainingGapsReport({ auditFile, markdownFile, jsonFile });
  assert.equal(report.totalRequirements, 3);
  assert.deepEqual(report.summary, { partial: 1, external_gate: 0, not_implemented: 1 });
});


test('Nolane requirement schema emits every open acceptance item without hiding gaps', () => {
  const audit = {
    schema: 'nolane.agent.requirements.v5', product: 'Nolane Agent', version: '5.0.0-alpha.3', productVersion: '5.0.0-alpha.3',
    total: 3, totalItems: 3, statusCounts: { verified_source_test: 1, not_implemented: 2 }, summary: { verified_source_test: 1, not_implemented: 2 },
    requirements: [
      { id:'N-1', group:'Runtime', title:'ready', status:'verified_source_test', acceptance:{} },
      { id:'N-2', group:'Models', title:'train model', status:'not_implemented', acceptance:{} },
      { id:'N-3', group:'Benchmarks', title:'hidden benchmark', status:'not_implemented', acceptance:{} },
    ],
  };
  const report = buildRemainingGapsReport(audit);
  assert.equal(report.product, 'Nolane Agent');
  assert.equal(report.totalOpen, 2);
  assert.deepEqual(report.items.map((item) => item.id), ['N-2','N-3']);
  assert.match(renderRemainingGapsMarkdown(report), /^# Nolane Agent 5\.0\.0-alpha\.3/m);
});
