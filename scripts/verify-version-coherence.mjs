import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { verifyVersionCoherence } from '../src/release/version-coherence.mjs';

const rootDirectory = path.resolve(process.argv[2] ?? '.');
const report = await verifyVersionCoherence({ rootDirectory });
const outputDirectory = path.join(rootDirectory, 'release');
await mkdir(outputDirectory, { recursive: true });
const output = path.join(outputDirectory, `version-coherence-${report.version}.json`);
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: report.status, version: report.version, receiptSha256: report.receiptSha256, output: path.relative(rootDirectory, output).replaceAll('\\', '/') })}\n`);
