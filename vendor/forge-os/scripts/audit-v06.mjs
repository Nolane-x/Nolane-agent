#!/usr/bin/env node
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {runV06ReleaseAudit} from '../src/benchmarks/v06-release-audit.mjs';
const output=path.resolve(process.env.FORGEOS_V06_AUDIT_OUTPUT??'dist/v06-release-audit.json');const report=await runV06ReleaseAudit();await mkdir(path.dirname(output),{recursive:true});await writeFile(output,`${JSON.stringify(report,null,2)}\n`);console.log(`ForgeOS v0.6 audit: ${report.kernel.total} kernel techniques, ${report.review.cases} review cases, ${report.security.passed}/${report.security.cases} security cases`);console.log(output);if(report.security.missed||report.stableMaterialization.failed||report.quality.invalidDepth||report.quality.boilerplateViolations)process.exitCode=1;
