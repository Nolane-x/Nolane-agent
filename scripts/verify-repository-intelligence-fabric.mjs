import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { verifyRepositoryIntelligenceFabric } from '../src/release/repository-intelligence-fabric-verifier.mjs';
const root = path.resolve(process.argv[2] ?? '.');
const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const output = path.join(root, 'release', `repository-intelligence-fabric-${metadata.version}.json`);
const report = await verifyRepositoryIntelligenceFabric({ rootDirectory: root, version: metadata.version, outputFile: output });
process.stdout.write(`${JSON.stringify({ status: report.status, version: report.version, receiptSha256: report.receiptSha256, output: path.relative(root, output).replaceAll('\\', '/') })}\n`);
