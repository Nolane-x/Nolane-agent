import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { verifyRemainingGapsReport, writeRemainingGapsReport } from '../src/release/remaining-gaps-report.mjs';

const mode = String(process.argv[2] ?? 'verify');
const root = path.resolve(process.argv[3] ?? '.');
const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const auditFile = path.join(root, 'docs', `feature-audit-${metadata.version}.json`);
const markdownFile = path.join(root, 'docs', `REMAINING-GAPS-${metadata.version}.md`);
const jsonFile = path.join(root, 'release', `remaining-gaps-${metadata.version}.json`);
const report = mode === 'write'
  ? await writeRemainingGapsReport({ auditFile, markdownFile, jsonFile })
  : await verifyRemainingGapsReport({ auditFile, markdownFile, jsonFile });
process.stdout.write(`${JSON.stringify({ mode, version: report.productVersion, totalOpen: report.totalOpen, summary: report.summary, receiptSha256: report.receiptSha256 })}\n`);
