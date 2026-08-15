#!/usr/bin/env node
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyCoreContracts } from '../src/native-core/core-conformance-verifier.mjs';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

async function loadJson(relativePath) {
  return JSON.parse(await readFile(relativePath, 'utf8'));
}

async function writeJsonAtomic(relativePath, value) {
  const target = path.resolve(relativePath);
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(canonical(value), null, 2)}\n`, { flag: 'wx' });
  try { await rename(temporary, target); }
  finally { await rm(temporary, { force: true }).catch(() => {}); }
}

export async function generateNativeCoreConformance({ rootDirectory = process.cwd() } = {}) {
  const previous = process.cwd();
  process.chdir(path.resolve(rootDirectory));
  try {
    const [catalog, inventory] = await Promise.all([
      loadJson('requirements/nolane-native-core-contracts.json'),
      loadJson('requirements/nolane-native-core-inventory.json'),
    ]);
    const receipt = await verifyCoreContracts({ rootDirectory: process.cwd(), catalog, nolane_nativeInventory: inventory });
    await writeJsonAtomic('requirements/nolane-native-core-conformance.json', receipt);
    return receipt;
  } finally {
    process.chdir(previous);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) generateNativeCoreConformance()
  .then((receipt) => process.stdout.write(`${JSON.stringify({ status: receipt.status, receiptSha256: receipt.receiptSha256, summary: receipt.summary })}\n`))
  .catch((error) => { console.error(error); process.exitCode = 1; });
