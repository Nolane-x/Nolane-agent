import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { measureDeepSuperiorityWaveBatch } from './measure-deep-superiority-wave-batch.mjs';
import { verifyDeepSuperiorityWaveBatch } from '../src/release/deep-superiority-wave-batch-verifier.mjs';

const root = path.resolve(process.argv[2] ?? '.');
const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const measurementPath = path.join(root, 'docs', `deep-superiority-wave-batch-measurement-${metadata.version}.json`);
const measurement = await measureDeepSuperiorityWaveBatch({ rootDirectory: root, version: metadata.version });
await mkdir(path.dirname(measurementPath), { recursive: true });
await writeFile(measurementPath, `${JSON.stringify(measurement, null, 2)}\n`);
const output = path.join(root, 'release', `deep-superiority-wave-batch-${metadata.version}.json`);
const report = await verifyDeepSuperiorityWaveBatch({ rootDirectory: root, version: metadata.version, outputFile: output });
process.stdout.write(`${JSON.stringify({ status: report.status, version: report.version, receiptSha256: report.receiptSha256, output: path.relative(root, output).replaceAll('\\', '/') })}\n`);
