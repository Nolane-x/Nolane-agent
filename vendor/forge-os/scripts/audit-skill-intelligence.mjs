#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runSkillIntelligenceAudit } from '../src/benchmarks/skill-intelligence-audit.mjs';
const output=path.resolve(process.env.FORGEOS_SKILL_INTELLIGENCE_AUDIT_OUTPUT??'dist/skill-intelligence-audit.json');const report=await runSkillIntelligenceAudit();await mkdir(path.dirname(output),{recursive:true});await writeFile(output,`${JSON.stringify(report,null,2)}\n`,'utf8');console.log(`Skill Intelligence: ${report.graph.techniques} techniques, ${report.graph.l0Techniques} L0, depth min ${report.quality.minimumDepthScore}, boilerplate max ${(report.quality.maximumBoilerplateRatio*100).toFixed(1)}%`);console.log(output);if(report.quality.invalidDepth||report.quality.boilerplateViolations||report.stableMaterialization.failed)process.exitCode=1;
