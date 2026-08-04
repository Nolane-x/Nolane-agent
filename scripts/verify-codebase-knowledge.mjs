import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { verifyCodebaseKnowledge } from '../src/release/codebase-knowledge-verifier.mjs';
const root = path.resolve(process.argv[2] ?? '.');
const identity = JSON.parse(await readFile(path.join(root, 'config', 'release-identity.json'), 'utf8'));
const outputFile = path.join(root, 'release', `codebase-knowledge-${identity.version}.json`);
const report = await verifyCodebaseKnowledge({ rootDirectory: root, version: identity.version, outputFile });
console.log(JSON.stringify({ status: report.status, version: report.version, receiptSha256: report.receiptSha256, outputFile: path.relative(root, outputFile) }));
