import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const capturerUrl = new URL('../scripts/capture-proofline-empty-evidence.mjs', import.meta.url);
const workflowUrl = new URL('../.github/workflows/proofline-empty-evidence.yml', import.meta.url);

test('Proofline critique cycle 2 captures the unselected mission state instead of inferring it from CSS', async () => {
  const capturer = await readFile(capturerUrl, 'utf8');
  const workflow = await readFile(workflowUrl, 'utf8');

  for (const state of ['mission-proofline-empty', 'mission-proofline-empty-compact']) {
    assert.match(capturer, new RegExp(`id: '${state}'`));
  }
  assert.match(capturer, /async function assertProoflineEmptyState/);
  assert.match(capturer, /selected mission spotlight remained visible/);
  assert.match(capturer, /recovery deck rendered without a selected mission/);
  assert.match(capturer, /empty mission toolbar did not span the available activity lane/);
  assert.match(capturer, /empty mission ledger did not span the available activity lane/);
  assert.match(capturer, /emptyMissionLayout: 'PASS'/);
  assert.match(capturer, /axeSeriousCritical: 'PASS'/);
  assert.match(capturer, /horizontalOverflow: 'PASS'/);
  assert.match(capturer, /screenReader: 'UNKNOWN'/);

  assert.match(capturer, /context\.request\.post/,
    'onboarding preparation must use Playwright request context so Windows evidence shares the browser network stack');
  assert.doesNotMatch(capturer, /await completeOnboarding\(root, credential\)/,
    'the cross-platform evidence path must not depend on Node global fetch before the browser context exists');

  assert.match(workflow, /ubuntu-latest/);
  assert.match(workflow, /windows-latest/);
  assert.match(workflow, /node-version:\s*'24'/);
  assert.match(workflow, /npm run build:ui-v3/);
  assert.match(workflow, /git diff --exit-code -- ui-dist/);
  assert.match(workflow, /playwright@1\.58\.2/);
  assert.match(workflow, /@axe-core\/playwright@4\.12\.1/);
  assert.match(workflow, /capture-proofline-empty-evidence\.mjs/);
  assert.match(workflow, /actions\/upload-artifact@v6/);
  assert.match(workflow, /retention-days:\s*14/);
});
