#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateNolaneNativeCoreInventory } from '../src/native-core/nolane-native-domain-classifier.mjs';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for --${key}`);
    args[key] = value;
    index += 1;
  }
  return args;
}

export function renderNolaneNativeCoreAudit(inventory) {
  const lines = [
    '# NolaneNative Core Parity Audit',
    '',
    `Source snapshot: **${inventory.sourceSnapshot.label}**`,
    '',
    `Tree SHA-256: \`${inventory.sourceSnapshot.treeSha256}\``,
    '',
    '## Truth reset',
    '',
    '- NolaneNative executable source and archive remain absent from Nolane production packages.',
    '- Beta.1 retirement proved package/runtime absence, not complete behavioral parity.',
    '- This inventory is behavioral provenance only; no upstream implementation is copied into Nolane.',
    '- File existence is not accepted as capability evidence.',
    '',
    '## Inventory totals',
    '',
    `- Files inspected: **${inventory.summary.entries.toLocaleString('en-US')}**`,
    `- Core entries: **${inventory.summary.coreEntries.toLocaleString('en-US')}**`,
    `- Explicit exclusions: **${inventory.summary.excludedEntries.toLocaleString('en-US')}**`,
    `- Contract candidates: **${inventory.summary.contractCandidates.toLocaleString('en-US')}**`,
    `- Unmapped core paths: **${inventory.summary.unmappedCorePaths}**`,
    '',
    '## Domain distribution',
    '',
    '| Domain | Entries | Source/config | Tests | Bytes |',
    '|---|---:|---:|---:|---:|',
    ...inventory.domains.map((domain) => `| ${domain.id} | ${domain.entries} | ${domain.sourceEntries} | ${domain.testEntries} | ${domain.bytes} |`),
    '',
    '## Acceptance interpretation',
    '',
    'An inventory contract begins as `inventory_only`. It becomes `verified` only when the Master Acceptance Ledger links it to a Nolane-native production entrypoint, a direct conformance test, a negative test, and fresh evidence hashes. Provider, messaging, Windows, browser, and independent-evaluation behavior remains an external gate until a real receipt exists.',
    '',
    '## Exclusion policy',
    '',
    'Translations, marketing websites, contributor metadata, optional skill payloads, generated datasets, and standalone assets are not ported file-for-file. Their useful behavior is represented through Nolane-owned engines and contracts; required license attribution remains preserved.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const upstream = args.upstream ?? process.env.NOLANE_NOLANE_NATIVE_AUDIT_ROOT;
  if (!upstream) throw new Error('provide --upstream or NOLANE_NOLANE_NATIVE_AUDIT_ROOT');
  const output = path.resolve(args.output ?? 'requirements/nolane-native-core-inventory.json');
  const auditOutput = path.resolve(args.audit ?? 'docs/NOLANE-NATIVE-CORE-AUDIT.md');
  const inventory = await generateNolaneNativeCoreInventory({
    upstreamRoot: path.resolve(upstream),
    historicalLedgerPath: args.ledger ? path.resolve(args.ledger) : path.resolve('requirements/nolane-native-transformation-ledger.jsonl'),
    outputPath: output,
    sourceLabel: args.label ?? 'Nous Research MIT-licensed upstream agent audit snapshot 0.19.0',
  });
  await writeFile(auditOutput, renderNolaneNativeCoreAudit(inventory));
  process.stdout.write(`${JSON.stringify({ status: 'pass', output, auditOutput, summary: inventory.summary })}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((error) => { console.error(error); process.exitCode = 1; });
