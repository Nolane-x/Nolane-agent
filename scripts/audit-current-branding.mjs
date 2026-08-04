#!/usr/bin/env node
import { auditCurrentBranding } from '../src/branding/brand-migration-auditor.mjs';

const report = await auditCurrentBranding({ root: process.cwd() });
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.complete) process.exitCode = 1;
