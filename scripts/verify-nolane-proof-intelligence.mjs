import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { verifyNolaneProofIntelligence } from '../src/release/nolane-proof-intelligence-verifier.mjs';

const root = path.resolve(process.argv[2] ?? '.');
const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const output = path.join(root, 'release', `nolane-proof-intelligence-${metadata.version}.json`);
await mkdir(path.dirname(output), { recursive: true });
const report = await verifyNolaneProofIntelligence({ rootDirectory: root, version: metadata.version, outputFile: output });
process.stdout.write(`${JSON.stringify({ status: report.status, version: report.version, receiptSha256: report.receiptSha256, output: path.relative(root, output).replaceAll('\\', '/') })}\n`);
