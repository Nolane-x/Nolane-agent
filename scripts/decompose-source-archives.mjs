#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { decomposeArchive } from '../src/forensics/archive-decomposer.mjs';

const root = process.cwd();
const requested = [
  process.env.NOLANE_SOURCE_ARCHIVE ? { id: 'nolane-source', path: process.env.NOLANE_SOURCE_ARCHIVE } : null,
  process.env.NOLANE_NATIVE_SOURCE_ARCHIVE ? { id: 'nolane-native-source', path: process.env.NOLANE_NATIVE_SOURCE_ARCHIVE, expectedSha256: '1ac5fcb20630d6556f6169cb836dda73298b2371f7c0a6ed23bcc5d6eaf41cd9' } : null,
].filter(Boolean);
if (requested.length === 0) {
  console.error('Set NOLANE_SOURCE_ARCHIVE and/or NOLANE_NATIVE_SOURCE_ARCHIVE');
  process.exit(2);
}
const outputs = [];
await mkdir(path.join(root, 'requirements', 'archive-decomposition'), { recursive: true });
for (const item of requested) {
  const report = await decomposeArchive({ archivePath: item.path, expectedSha256: item.expectedSha256 ?? null });
  const outputPath = path.join(root, 'requirements', 'archive-decomposition', `${item.id}.json`);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  outputs.push({ id: item.id, outputPath: path.relative(root, outputPath), archiveSha256: report.archiveSha256, entries: report.entries.length, unknown: report.unknownEntries.length, totals: report.totals });
}
console.log(JSON.stringify({ schema: 'nolane.forensics.archive-decomposition-run.v1', outputs }, null, 2));
if (outputs.some((output) => output.unknown > 0)) process.exitCode = 1;
