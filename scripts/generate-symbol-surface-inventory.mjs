#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inventoryRepositorySymbols } from '../src/forensics/symbol-inventory/repository-symbol-inventory.mjs';
import { importNolaneNativeTransformationLedger } from '../src/forensics/nolane-native-ledger-importer.mjs';

const root = process.cwd();
const inventory = await inventoryRepositorySymbols({ root, include: ['src', 'ui', 'ui-v3', 'extensions', 'scripts', 'launcher', 'native'] });
const records = [
  ...inventory.files.map((record) => ({ recordType: 'file', ...record })),
  ...inventory.symbols.map((record) => ({ recordType: 'symbol', ...record })),
  ...inventory.surfaces.map((record) => ({ recordType: 'surface', ...record })),
  ...inventory.parseFailures.map((record) => ({ recordType: 'parse-failure', schema: 'nolane.forensics.parse-failure.v1', id: `parse-failure-${createHash('sha256').update(`${record.relativePath}:${record.message}`).digest('hex').slice(0, 24)}`, ...record })),
].sort((a, b) => a.id.localeCompare(b.id));
const jsonl = records.map((record) => JSON.stringify(record)).join('\n') + '\n';
const inventoryPath = path.join(root, 'requirements', 'nolane-symbol-surface-inventory.jsonl');
const summaryPath = path.join(root, 'requirements', 'nolane-symbol-surface-inventory-summary.json');
await mkdir(path.dirname(inventoryPath), { recursive: true });
await writeFile(inventoryPath, jsonl);
const summary = { ...inventory.summary, inventorySha256: createHash('sha256').update(jsonl).digest('hex'), inventoryPath: path.relative(root, inventoryPath) };
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

const nolane_nativeLedgerPath = path.join(root, 'requirements', 'nolane-native-transformation-ledger.jsonl');
const nolane_nativeOutputPath = path.join(root, 'requirements', 'nolane-native-provisional-source-inventory.jsonl');
const nolane_nativeSummaryPath = path.join(root, 'requirements', 'nolane-native-provisional-source-inventory-summary.json');
const historicalText = await readFile(nolane_nativeLedgerPath, 'utf8');
const provisional = importNolaneNativeTransformationLedger({
  jsonlText: historicalText,
  expectedArchiveSha256: '1ac5fcb20630d6556f6169cb836dda73298b2371f7c0a6ed23bcc5d6eaf41cd9',
  canonicalSourceAvailable: false,
});
const nolane_nativeJsonl = provisional.records.map((record) => JSON.stringify(record)).join('\n') + '\n';
await writeFile(nolane_nativeOutputPath, nolane_nativeJsonl);
await writeFile(nolane_nativeSummaryPath, `${JSON.stringify({ ...provisional.summary, inventorySha256: createHash('sha256').update(nolane_nativeJsonl).digest('hex'), explicitNonClaim: 'This is path metadata, not a function-level NolaneNative source inventory.' }, null, 2)}\n`);
summary.nolane_nativeProvisional = { ...provisional.summary, inventoryPath: path.relative(root, nolane_nativeOutputPath) };

console.log(JSON.stringify(summary, null, 2));
if (inventory.parseFailures.length > 0) process.exitCode = 1;
