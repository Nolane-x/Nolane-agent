#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrateCheckpoint6LedgerEvidence } from '../src/forensics/checkpoint-6-evidence-migration.mjs';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export async function migrateCheckpoint6EvidenceFile({
  inputPath = 'requirements/master-acceptance-ledger.json',
  outputPath = inputPath,
} = {}) {
  const ledger = JSON.parse(await readFile(inputPath, 'utf8'));
  const migrated = migrateCheckpoint6LedgerEvidence(ledger);
  await writeFile(outputPath, `${JSON.stringify(canonical(migrated), null, 2)}\n`);
  return migrated.metadata.checkpoint6EvidenceMigration;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) migrateCheckpoint6EvidenceFile().then((summary) => process.stdout.write(`${JSON.stringify({ status: 'pass', ...summary })}\n`)).catch((error) => { console.error(error); process.exitCode = 1; });
