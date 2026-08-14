import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const capturerUrl = new URL('../scripts/capture-ui-runtime-visual.mjs', import.meta.url);
const workflowUrl = new URL('../.github/workflows/ui-runtime-visual.yml', import.meta.url);

test('Proofline critique cycle 2 captures the unselected mission state instead of inferring it from CSS', async () => {
  const capturer = await readFile(capturerUrl, 'utf8');
  const workflow = await readFile(workflowUrl, 'utf8');

  assert.match(capturer, /id: 'mission-proofline-empty'/);
  assert.match(capturer, /async function assertProoflineEmptyState/);
  assert.match(capturer, /selected mission spotlight remained visible/);
  assert.match(capturer, /recovery deck rendered without a selected mission/);
  assert.match(capturer, /empty mission toolbar did not span the available activity lane/);
  assert.match(capturer, /empty mission ledger did not span the available activity lane/);
  assert.match(capturer, /emptyMissionLayout: 'PASS'/);

  assert.match(workflow, /mission-proofline-empty/);
  const windowsWorkflow = workflow.slice(workflow.indexOf('windows-ui-runtime-evidence:'));
  assert.match(windowsWorkflow, /mission-proofline-empty/);
});
