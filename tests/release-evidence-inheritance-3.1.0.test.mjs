import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('3.1 limitations preserve every 3.0 boundary before adding intelligence completion non-claims', async () => {
  const previous = (await read('docs/LIMITATIONS-3.0.0.md')).replaceAll('3.0.0', '3.1.0').trim();
  const current = (await read('docs/LIMITATIONS-3.1.0.md')).trim();

  assert.ok(current.startsWith(previous), '3.1 limitations must retain the complete normalized 3.0 boundary document');
  assert.match(current, /Counterfactual patch ablation works only through a caller-supplied isolated-workspace adapter/i);
  assert.match(current, /Dynamic program-analysis targets remain ambiguous/i);
  assert.match(current, /Verified context utility is local evidence routing/i);
  assert.match(current, /paged vector measurement proves bounded page reads/i);
});

for (const name of [
  'adaptive-harness-lab',
  'adaptive-work-fabric',
  'mission-resource-fabric',
]) {
  test(`3.1 release carries a valid ${name} measurement receipt`, async () => {
    const report = JSON.parse(await read(`docs/${name}-measurement-3.1.0.json`));
    const { receiptSha256, ...unsigned } = report;

    assert.equal(report.version, '3.1.0');
    assert.match(receiptSha256, /^[a-f0-9]{64}$/);
    assert.equal(receiptSha256, canonicalSha256(unsigned));
  });
}
