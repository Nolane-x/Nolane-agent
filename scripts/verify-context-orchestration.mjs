#!/usr/bin/env node
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { verifyContextOrchestration } from '../src/release/context-orchestration-verifier.mjs';
const root = path.resolve(process.argv[2] ?? '.');
const identity = JSON.parse(await readFile(path.join(root, 'config', 'release-identity.json'), 'utf8'));
const report = await verifyContextOrchestration({ rootDirectory: root, version: identity.version, outputFile: path.join(root, 'release', `context-orchestration-${identity.version}.json`) });
console.log(JSON.stringify(report, null, 2));
