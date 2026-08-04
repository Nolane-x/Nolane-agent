import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { verifyAdaptiveWorkFabric } from '../src/release/adaptive-work-fabric-verifier.mjs';
const root = path.resolve(process.argv[2] ?? '.');
const identity = JSON.parse(await readFile(path.join(root, 'config', 'release-identity.json'), 'utf8'));
const outputFile = path.join(root, 'release', `adaptive-work-fabric-${identity.version}.json`);
const report = await verifyAdaptiveWorkFabric({ rootDirectory: root, version: identity.version, outputFile });
process.stdout.write(`${JSON.stringify({ status: report.status, version: report.version, receiptSha256: report.receiptSha256, outputFile: path.relative(root, outputFile).replaceAll('\\', '/') })}\n`);
