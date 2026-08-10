import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('external gate workflow uses least privilege and real Windows Linux macOS runners without Electron packaging', async () => {
  const workflow = await readFile('.github/workflows/external-gates.yml', 'utf8');
  assert.match(workflow, /permissions:\s*\n\s+contents:\s*read/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /pull_request:\s*\n\s+paths:/);
  assert.match(workflow, /- 'native\/\*\*'/);
  assert.match(workflow, /- 'scripts\/\*\*'/);
  assert.doesNotMatch(workflow, /push:\s*\n\s+branches:\s*\n\s+- codex\/external-gate-evidence/);
  assert.match(workflow, /ubuntu-latest/);
  assert.match(workflow, /windows-latest/);
  assert.match(workflow, /macos-latest/);
  assert.match(workflow, /fail-fast:\s*false/);
  assert.match(workflow, /timeout-minutes:/);
  assert.match(workflow, /node-version:\s*'24'/);
  for (const modulePath of ['launcher/go.mod', 'native/pty/go.mod', 'native/credential/go.mod', 'native/job-object/go.mod']) {
    assert.match(workflow, new RegExp(modulePath.replace('/', '\\/')));
  }
  assert.match(workflow, /npm run audit:external-gates/);
  assert.match(workflow, /NolaneCredential/);
  assert.match(workflow, /NOLANE_GITHUB_ISSUE_LINKED/);
  assert.match(workflow, /if: github\.event_name == 'pull_request'/);
  assert.match(workflow, /Get-Content -Raw -LiteralPath \$env:GITHUB_EVENT_PATH \| ConvertFrom-Json/);
  assert.match(workflow, /-match '\(\?im\)\^\\s\*closes\\s\+#\\d\+\\b'/);
  assert.doesNotMatch(workflow, /electron-builder|build:electron|smoke:packaged|release:matrix/);
});
