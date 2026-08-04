import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { verifyLocalResourceSandbox } from '../src/release/local-resource-sandbox-verifier.mjs';

const root = path.resolve(process.argv[2] ?? '.');
const identity = JSON.parse(await readFile(path.join(root, 'config', 'release-identity.json'), 'utf8'));
const outputFile = path.join(root, 'release', `local-resource-sandbox-${identity.version}.json`);
const report = await verifyLocalResourceSandbox({ rootDirectory: root, version: identity.version, outputFile });
process.stdout.write(`${JSON.stringify({ status: report.status, version: report.version, receiptSha256: report.receiptSha256, outputFile: path.relative(root, outputFile).replaceAll('\\', '/') })}\n`);
