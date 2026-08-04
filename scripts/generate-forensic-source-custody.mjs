#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createSourceCustodyRecord, verifySourceCustodyRecord } from '../src/forensics/source-custody.mjs';
import { evaluateRecoveryClaims } from '../src/forensics/recovery-claim-policy.mjs';

const root = process.cwd();
const outputPath = path.join(root, 'requirements', 'forensic-source-custody.json');
const canonicalPath = process.env.NOLANE_NATIVE_SOURCE_ARCHIVE
  ? path.relative(root, path.resolve(process.env.NOLANE_NATIVE_SOURCE_ARCHIVE))
  : 'vendor/nolane_native-agent/nolane_native-agent-main.zip';

const definitions = [
  createSourceCustodyRecord({
    id: 'nolane-native-canonical',
    kind: 'upstream-source',
    path: canonicalPath,
    expectedSha256: '1ac5fcb20630d6556f6169cb836dda73298b2371f7c0a6ed23bcc5d6eaf41cd9',
    expectedBytes: 67431284,
    origin: 'historical-project-manifest',
    required: true,
    description: 'Canonical NolaneNative Agent archive previously bundled by ForgeStudio/Nolane Agent.',
  }),
  createSourceCustodyRecord({
    id: 'nolane-package-anchor',
    kind: 'product-source-anchor',
    path: 'package.json',
    origin: 'current-git-worktree',
    required: true,
    description: 'Current Nolane Agent package identity anchor.',
  }),
];

const records = [];
for (const definition of definitions) records.push(await verifySourceCustodyRecord(definition, { root }));
const gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
async function optionalJson(file, fallback) { try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; } }
async function optionalJsonl(file) { try { const source = (await readFile(file, 'utf8')).trim(); return source ? source.split(/\r?\n/).map(JSON.parse) : []; } catch { return []; } }
const truthLedger = await optionalJsonl(path.join(root, 'requirements', 'nolane-native-function-parity-ledger.jsonl'));
const uiAudit = await optionalJson(path.join(root, 'requirements', 'ui-v3-master-plan-gap-registry.json'), {});
const claims = evaluateRecoveryClaims({ custody: records, truthLedger, uiAudit, externalReceipts: [] });
const report = {
  schema: 'nolane.forensics.source-custody.v1',
  product: 'Nolane Agent',
  checkpoint: 'forensic-recovery-checkpoint-3',
  gitHead,
  records,
  claims,
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ outputPath: path.relative(root, outputPath), gitHead, statuses: Object.fromEntries(records.map((record) => [record.id, record.status])), claims }, null, 2));
