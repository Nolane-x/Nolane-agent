import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('external gate workflow aggregates runner receipts from every successful trusted trigger into a read-only certification candidate artifact', async () => {
  const workflow = await readFile('.github/workflows/external-gates.yml', 'utf8');
  assert.match(workflow, /permissions:\s*\n\s+contents:\s*read\s*\n\s+actions:\s*read/);
  assert.match(workflow, /NOLANE_GITHUB_HEAD_SHA:/);
  assert.match(workflow, /github\.event\.pull_request\.head\.sha/);
  assert.match(workflow, /certification-candidate:/);
  assert.match(workflow, /certification-candidate:\s*\n\s*if:\s*\$\{\{\s*needs\.runner-evidence\.result\s*==\s*'success'\s*\}\}/);
  assert.match(workflow, /needs:\s*runner-evidence/);
  assert.match(workflow, /actions\/download-artifact@v6/);
  assert.match(workflow, /pattern:\s*external-gates-\*/);
  assert.match(workflow, /gh api/);
  assert.match(workflow, /build-external-gate-certification\.mjs/);
  assert.match(workflow, /external-gate-certification-candidate/);
  assert.doesNotMatch(workflow, /contents:\s*write/);
  assert.doesNotMatch(workflow, /git\s+push/);
});
