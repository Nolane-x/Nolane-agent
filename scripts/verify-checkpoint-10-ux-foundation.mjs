#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { verifyCheckpoint10UxFoundation } from '../src/release/checkpoint-10-ux-foundation-verifier.mjs';
import { PRODUCT_IDENTITY } from '../src/product-identity.mjs';

export async function runCheckpoint10UxFoundationVerification({ root = process.cwd(), write = process.argv.includes('--write') } = {}) {
  const report = await verifyCheckpoint10UxFoundation({ rootDirectory: root, version: PRODUCT_IDENTITY.version });
  if (write) {
    const output = path.join(root, 'release', 'checkpoint-10-ux-foundation-verification.json');
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) runCheckpoint10UxFoundationVerification().then((report) => { console.log(JSON.stringify(report)); if (report.status !== 'pass') process.exitCode = 1; }).catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
