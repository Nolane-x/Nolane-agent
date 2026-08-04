import { readFile } from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve(process.argv[2] ?? 'release/benchmark-self-smoke');
const report = JSON.parse(await readFile(path.join(directory, 'benchmark-report.json'), 'utf8'));
if (report.independent !== false) throw new Error('Self benchmark must not be marked independent');
if (report.claimAllowed !== false) throw new Error('Self benchmark must not unlock comparative claims');
if (!Array.isArray(report.runs) || report.runs.length !== 3 || report.runs.some((run) => run.verified !== true)) throw new Error('Self benchmark must contain exactly three verified smoke runs');
process.stdout.write(`${JSON.stringify({ independent: false, claimAllowed: false, runs: report.runs.length })}\n`);
