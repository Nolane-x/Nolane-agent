#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { auditUiV3MasterPlan } from '../src/forensics/ui-v3-gap-auditor.mjs';

const root = process.cwd();
const report = await auditUiV3MasterPlan({ root });
const outputPath = path.join(root, 'requirements', 'ui-v3-master-plan-gap-registry.json');
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ outputPath: path.relative(root, outputPath), defaultUiVersion: report.defaultUiVersion, complete: report.complete, summary: report.summary, blockers: report.blockers }, null, 2));
