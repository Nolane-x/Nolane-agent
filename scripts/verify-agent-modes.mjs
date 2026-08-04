import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { verifyAgentModes } from '../src/release/agent-modes-verifier.mjs';
const root = path.resolve(process.argv[2] ?? '.');
const identity = JSON.parse(await readFile(path.join(root, 'config', 'release-identity.json'), 'utf8'));
const outputFile = path.join(root, 'release', `agent-modes-${identity.version}.json`);
const report = await verifyAgentModes({ rootDirectory: root, version: identity.version, outputFile });
console.log(JSON.stringify({ status: report.status, version: report.version, modeCount: report.modeCount, receiptSha256: report.receiptSha256, outputFile: path.relative(root, outputFile) }));
