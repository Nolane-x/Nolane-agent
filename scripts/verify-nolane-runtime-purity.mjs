#!/usr/bin/env node
import path from 'node:path';
import { verifyNolaneRuntimePurity } from './lib/nolane-runtime-purity-verifier.mjs';

const report = await verifyNolaneRuntimePurity({ rootDirectory: path.resolve(process.argv[2] ?? '.') });
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.status !== 'pass') process.exitCode = 1;
