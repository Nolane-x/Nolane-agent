import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { collectExternalGateEvidence } from '../src/release/external-gate-evidence.mjs';

const root = path.resolve(process.argv[2] ?? '.');
const identity = JSON.parse(await readFile(path.join(root, 'config', 'release-identity.json'), 'utf8'));
const runner = String(process.env.RUNNER_OS || process.platform).toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
const outputFile = path.resolve(process.env.NOLANE_GATE_OUTPUT || path.join(root, 'release', 'external-gates', `${runner}.json`));
const report = await collectExternalGateEvidence({ rootDirectory: root, version: identity.version, outputFile });

process.stdout.write(`${JSON.stringify({
  status: 'observed',
  totalExternalGates: report.totalExternalGates,
  receiptSha256: report.receiptSha256,
  outputFile: path.relative(root, outputFile).replaceAll('\\', '/'),
})}\n`);
