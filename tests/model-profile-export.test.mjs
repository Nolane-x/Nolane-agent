import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildBundledModelProfileCatalog, writeModelProfileCatalog } from '../scripts/export-model-profiles.mjs';

test('bundled catalog exports broad exact, family, and size coverage deterministically', () => {
  const first = buildBundledModelProfileCatalog({ clock: () => '2026-08-03T00:00:00.000Z' });
  const second = buildBundledModelProfileCatalog({ clock: () => '2026-08-03T00:00:00.000Z' });
  assert.deepEqual(first, second);
  assert.ok(first.profiles.length >= 500);
  assert.ok(first.families.length >= 70);
  assert.ok(first.coverage.publishers >= 40);
  assert.ok(first.coverage.localProfiles >= 250);
  assert.ok(first.coverage.parameterScales.includes('0.6B'));
  assert.ok(first.coverage.parameterScales.includes('2.8T-A104B'));
  assert.match(first.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(first).match(/(?:api[_-]?key|authorization|bearer\s+[a-z0-9])/i), null);
});

test('export writes canonical JSON and returns its receipt', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'nolane-profiles-'));
  const output = path.join(directory, 'profiles.json');
  const result = await writeModelProfileCatalog(output, { clock: () => '2026-08-03T00:00:00.000Z' });
  const parsed = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(parsed.receiptSha256, result.receiptSha256);
  assert.equal(parsed.profiles.length, result.profileCount);
  assert.equal(parsed.schemaVersion, '1.0.0');
});
