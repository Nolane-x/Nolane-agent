#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexTestSource } from '../src/forensics/test-assertion-index.mjs';
import { auditMasterLedgerAssertions } from '../src/forensics/master-ledger-assertion-audit.mjs';
import { evidenceFileSha256 } from '../src/release/evidence-file-hash.mjs';

async function exists(file) { try { await access(file); return true; } catch { return false; } }
function uniquePaths(requirements) {
  const values = new Set();
  for (const item of requirements) {
    const acceptance = item.acceptance ?? {};
    for (const value of [acceptance.productionEntryPoints, acceptance.productionEntrypoint, acceptance.entrypoint, acceptance.testPaths, acceptance.exactTest]) {
      for (const entry of Array.isArray(value) ? value : value ? [value] : []) values.add(String(entry).replaceAll('\\', '/'));
    }
  }
  return [...values].filter(Boolean).sort();
}

export async function generateMasterLedgerAssertionAudit({ root = process.cwd(), write = true, maxRequirementsPerTest = 25 } = {}) {
  const ledgerPath = path.join(root, 'requirements/master-acceptance-ledger.json');
  const ledger = JSON.parse(await readFile(ledgerPath, 'utf8'));
  const requirements = ledger.requirements ?? [];
  const existingPaths = new Set(); const sha256ByPath = new Map(); const testIndex = new Map();
  for (const relativePath of uniquePaths(requirements)) {
    const absolutePath = path.join(root, relativePath);
    if (!await exists(absolutePath)) continue;
    const bytes = await readFile(absolutePath); existingPaths.add(relativePath); sha256ByPath.set(relativePath, evidenceFileSha256(bytes));
    if (relativePath.startsWith('tests/') || relativePath.includes('/test/')) {
      testIndex.set(relativePath, { ...indexTestSource({ path: relativePath, source: bytes.toString('utf8') }), sourceSha256: evidenceFileSha256(bytes) });
    }
  }
  const report = auditMasterLedgerAssertions({ requirements, existingPaths, sha256ByPath, testIndex, maxRequirementsPerTest });
  const outputJson = path.join(root, 'docs/checkpoints/MASTER-LEDGER-ASSERTION-AUDIT.json');
  const outputMd = path.join(root, 'docs/checkpoints/MASTER-LEDGER-ASSERTION-AUDIT.md');
  const outputJsonl = path.join(root, 'requirements/master-ledger-assertion-audit.jsonl');
  if (write) {
    await mkdir(path.dirname(outputJson), { recursive: true }); await mkdir(path.dirname(outputJsonl), { recursive: true });
    await writeFile(outputJson, `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(outputJsonl, `${report.records.map((item) => JSON.stringify(item)).join('\n')}\n`);
    const s = report.summary;
    await writeFile(outputMd, `# Master Ledger Assertion Audit\n\n- Canonical requirements: ${s.requirementsTotal}\n- Assertion verified: ${s.assertionVerified}\n- Assertion unbound: ${s.assertionUnbound}\n- External unverified: ${s.externalUnverified}\n- Documentation-only entrypoints: ${s.documentationOnlyEntrypoints}\n- Missing positive assertions: ${s.missingPositiveAssertions}\n- Missing negative assertions: ${s.missingNegativeAssertions}\n- Over-broad test files: ${s.overBroadTestFiles}\n- Certifiable: **${report.certifiable}**\n- Receipt: \`${report.receiptSha256}\`\n\nThis audit does not mutate canonical requirement status. It records assertion-level truth and blockers.\n`);
  }
  return Object.freeze({ report, outputJson, outputMd, outputJsonl });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) generateMasterLedgerAssertionAudit({}).then(({ report }) => console.log(JSON.stringify({ summary: report.summary, receiptSha256: report.receiptSha256 }))).catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
