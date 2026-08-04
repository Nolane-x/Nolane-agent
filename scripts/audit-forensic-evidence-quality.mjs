#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { auditEvidenceBindings } from '../src/forensics/evidence-quality-auditor.mjs';

const root = process.cwd();
const ledger = JSON.parse(await readFile(path.join(root, 'requirements', 'master-acceptance-ledger.json'), 'utf8'));
const report = auditEvidenceBindings({ requirements: ledger.requirements, policy: { maxRequirementsPerTest: Number(process.env.MAX_REQUIREMENTS_PER_TEST ?? 25) } });
const outputPath = path.join(root, 'requirements', 'forensic-evidence-quality-audit.json');
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ outputPath: path.relative(root, outputPath), certifiable: report.certifiable, ...report.summary, verifiedRequirements: report.verifiedRequirements }, null, 2));
if (process.env.FORENSIC_STRICT_EVIDENCE === '1' && !report.certifiable) process.exitCode = 1;
