#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runSkillCertificationAudit } from '../src/benchmarks/skill-certification-audit.mjs';

const output = path.resolve(process.env.FORGEOS_SKILL_CERTIFICATION_AUDIT_OUTPUT ?? 'dist/skill-certification-audit.json');
const report = await runSkillCertificationAudit();
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Skill certification: ${report.evidenceQualified.stable}/${report.inventory.totalTechniques} evidence-qualified stable, ${report.evidenceQualified.certified} certified`);
console.log(output);
// This audit validates claims honesty. It fails only when a production-grade claim is
// marked true without the required evidence, not merely because certification is pending.
if (report.claims.allKernelStableOrCertified || report.claims.allProceduralSkillsProductionGrade) process.exitCode = 1;
