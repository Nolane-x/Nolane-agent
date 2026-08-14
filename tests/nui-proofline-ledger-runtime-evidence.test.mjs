import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const captureUrl = new URL('../scripts/capture-proofline-ledger-evidence.mjs', import.meta.url);
const workflowUrl = new URL('../.github/workflows/proofline-ledger-evidence.yml', import.meta.url);

test('Proofline critique cycle 2 has dedicated ledger-in-viewport runtime evidence', async () => {
  const capturer = await readFile(captureUrl, 'utf8');
  const workflow = await readFile(workflowUrl, 'utf8');

  for (const state of ['mission-proofline-ledger', 'mission-proofline-ledger-compact']) {
    assert.match(capturer, new RegExp(`id: '${state}'`));
  }
  assert.match(capturer, /\.activity-filament/);
  assert.match(capturer, /scrollIntoViewIfNeeded/);
  assert.match(capturer, /ledger did not enter the viewport/);
  assert.match(capturer, /ledger rendered no activity events/);
  assert.match(capturer, /ledger exposed no discoverable evidence receipt/);
  assert.match(capturer, /ledger overflows horizontally/);
  assert.match(capturer, /AxeBuilder/);
  assert.match(capturer, /axeSeriousCritical:\s*'PASS'/);
  assert.match(capturer, /receiptDiscoverability:\s*'PASS'/);
  assert.match(capturer, /screenReader:\s*'UNKNOWN'/);

  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /node-version:\s*'24'/);
  assert.match(workflow, /npm run build:ui-v3/);
  assert.match(workflow, /git diff --exit-code -- ui-dist/);
  assert.match(workflow, /playwright@1\.58\.2/);
  assert.match(workflow, /@axe-core\/playwright@4\.12\.1/);
  assert.match(workflow, /capture-proofline-ledger-evidence\.mjs/);
  assert.match(workflow, /actions\/upload-artifact@v6/);
  assert.match(workflow, /retention-days:\s*14/);
});
