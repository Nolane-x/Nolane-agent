#!/usr/bin/env node
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { verifyInstructionPolicy } from '../src/release/instruction-policy-verifier.mjs';
const root = path.resolve(process.argv[2] ?? '.');
const identity = JSON.parse(await readFile(path.join(root, 'config', 'release-identity.json'), 'utf8'));
const outputFile = path.join(root, 'release', `instruction-policy-${identity.version}.json`);
const report = await verifyInstructionPolicy({ rootDirectory: root, version: identity.version, outputFile });
console.log(JSON.stringify({ status: report.status, version: report.version, receiptSha256: report.receiptSha256, outputFile }, null, 2));
