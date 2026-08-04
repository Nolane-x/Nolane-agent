import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { verifyRepositoryDiscovery } from '../src/release/repository-discovery-verifier.mjs';

const root = path.resolve(process.argv[2] ?? '.');
const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const outputFile = path.join(root, 'release', `repository-discovery-${metadata.version}.json`);
const report = await verifyRepositoryDiscovery({ rootDirectory: root, version: metadata.version, outputFile });
process.stdout.write(`${JSON.stringify({ status: report.status, version: report.version, receiptSha256: report.receiptSha256, outputFile: path.relative(root, outputFile).replaceAll('\\', '/') })}\n`);
