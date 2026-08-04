#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { rehydrateNolaneNativeCoreInventory } from '../src/native-core/nolane-native-domain-classifier.mjs';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

const path = process.argv[2] ?? 'requirements/nolane-native-core-inventory.json';
const source = JSON.parse(await readFile(path, 'utf8'));
const inventory = rehydrateNolaneNativeCoreInventory(source);
await writeFile(path, `${JSON.stringify(canonical(inventory), null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: 'pass', path, receiptSha256: inventory.receiptSha256, entries: inventory.entries.length, contracts: inventory.contracts.length })}\n`);
