#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateMasterLedger,
  hydrateMasterLedgerEvidence,
  validateMasterLedger,
} from '../src/requirements/master-ledger.mjs';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export function renderMasterLedgerReport(ledger) {
  const status = ledger.summary.statusCounts;
  const lines = [
    `# ${ledger.product} ${ledger.productVersion} — Master Acceptance Ledger`,
    '',
    `Product version: **${ledger.productVersion}**`,
    '',
    '## Canonical scope',
    '',
    `- Legacy requirements: **${ledger.sources.legacy.inputItems.toLocaleString('en-US')}**`,
    `- Nolane V5 requirements: **${ledger.sources.nolaneV5.inputItems.toLocaleString('en-US')}**`,
    `- NolaneNative core contract candidates: **${ledger.sources.nolane_nativeCore.inputItems.toLocaleString('en-US')}**`,
    `- Input rows: **${ledger.summary.inputItems.toLocaleString('en-US')}**`,
    `- Canonical rows after exact semantic deduplication: **${ledger.summary.canonicalItems.toLocaleString('en-US')}**`,
    `- Duplicate aliases removed from totals: **${ledger.summary.deduplicatedAliases}**`,
    '',
    '## Status',
    '',
    `- Verified: **${status.verified}**`,
    `- External gate: **${status.external_gate}**`,
    `- Implemented but not wired: **${status.implemented_not_wired}**`,
    `- Not implemented: **${status.not_implemented}**`,
    `- Unmapped: **${status.unmapped}**`,
    '',
    '## Interpretation',
    '',
    'The NolaneNative rows are inventory-derived behavior candidates. Their status is upgraded only by the Nolane Native Core Contract Catalog when production entrypoints, direct conformance tests, negative tests, and fresh evidence hashes are present. External and open behavior remains visible; the ledger never infers parity from file existence.',
    '',
    'Exact-title duplicates are represented as aliases under one canonical requirement. Similar but non-identical requirements remain separate to avoid hiding work through fuzzy matching.',
    '',
    `Ledger receipt SHA-256: \`${ledger.receiptSha256}\``,
    '',
  ];
  return `${lines.join('\n')}\n`;
}

async function loadJson(relativePath) {
  return JSON.parse(await readFile(relativePath, 'utf8'));
}

async function main() {
  const rootDirectory = process.cwd();
  const legacyAudit = await loadJson('docs/feature-audit-4.0.0.json');
  const nolaneV5 = await loadJson('requirements/nolane-agent-v5-requirements.json');
  const nolane_nativeInventory = await loadJson('requirements/nolane-native-core-inventory.json');
  const nativeConformance = await loadJson('requirements/nolane-native-core-conformance.json');
  const initial = generateMasterLedger({ legacyAudit, nolaneV5, nolane_nativeInventory, nativeConformance });
  const ledger = await hydrateMasterLedgerEvidence(initial, { rootDirectory });
  validateMasterLedger(ledger);
  await writeFile('requirements/master-acceptance-ledger.json', `${JSON.stringify(canonical(ledger), null, 2)}\n`);
  await writeFile('docs/MASTER-ACCEPTANCE-LEDGER.md', renderMasterLedgerReport(ledger));
  process.stdout.write(`${JSON.stringify({ status: 'pass', summary: ledger.summary, receiptSha256: ledger.receiptSha256 })}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((error) => { console.error(error); process.exitCode = 1; });
