import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ledger = JSON.parse(fs.readFileSync(path.join(root, 'requirements', 'checkpoint-14-source-truth-ledger.json'), 'utf8'));
const allowedStates = new Set([
  'implemented-and-wired',
  'implemented-but-not-runtime-consumed',
  'implemented-but-incomplete',
  'implemented-but-converging',
  'compatibility-only',
  'mock-contract-tested',
  'external-certification-required',
  'planned-only',
]);

test('source truth ledger uses explicit evidence states and unique IDs', () => {
  const ids = new Set();
  for (const entry of ledger.entries) {
    assert.ok(entry.id);
    assert.ok(allowedStates.has(entry.state), `unknown state ${entry.state}`);
    assert.equal(ids.has(entry.id), false, `duplicate truth entry ${entry.id}`);
    ids.add(entry.id);
  }
});

test('truth ledger keeps compatibility boundaries visible', () => {
  assert.equal(ledger.entries.find((entry) => entry.id === 'forge-os-substrate')?.state, 'compatibility-only');
  assert.equal(ledger.entries.find((entry) => entry.id === 'legacy-ui')?.state, 'compatibility-only');
  assert.equal(ledger.entries.find((entry) => entry.id === 'windows-update-replay')?.state, 'external-certification-required');
});
