import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { verifyMissionResourceFabric } from '../src/release/mission-resource-fabric-verifier.mjs';

const root = path.resolve(process.argv[2] ?? '.');
const identity = JSON.parse(await readFile(path.join(root, 'config', 'release-identity.json'), 'utf8'));
const outputFile = path.join(root, 'release', `mission-resource-fabric-${identity.version}.json`);
const report = await verifyMissionResourceFabric({ rootDirectory: root, version: identity.version, outputFile });
process.stdout.write(`${JSON.stringify({ status: report.status, version: report.version, receiptSha256: report.receiptSha256, outputFile: path.relative(root, outputFile).replaceAll('\\', '/') })}\n`);
