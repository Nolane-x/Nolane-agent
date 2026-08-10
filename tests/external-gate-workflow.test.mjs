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
  assert.match(workflow, /os:\s*ubuntu-latest\s*\n\s*label:\s*Linux\s*\n\s*slug:\s*linux\s*\n\s*fullSourceSuite:\s*true/);
  assert.match(workflow, /os:\s*windows-latest\s*\n\s*label:\s*Windows\s*\n\s*slug:\s*windows\s*\n\s*fullSourceSuite:\s*false/);
  assert.match(workflow, /os:\s*macos-latest\s*\n\s*label:\s*macOS\s*\n\s*slug:\s*macos\s*\n\s*fullSourceSuite:\s*false/);
  assert.match(workflow, /name:\s*Run the source suite\s*\n\s*if:\s*matrix\.fullSourceSuite\s*\n\s*run:\s*npm run validate/);
  assert.equal([...workflow.matchAll(/npm run validate/g)].length, 1);
  for (const modulePath of ['launcher/go.mod', 'native/pty/go.mod', 'native/credential/go.mod', 'native/job-object/go.mod']) {
    assert.match(workflow, new RegExp(modulePath.replace('/', '\\/')));
  }
  assert.match(workflow, /npm run audit:external-gates/);
  assert.match(workflow, /name:\s*Run real Podman sandbox gate[\s\S]*if:\s*matrix\.slug == 'linux'[\s\S]*NOLANE_RUNTIME_PODMAN_GATE:\s*'1'[\s\S]*node --test tests\/podman-runtime-evidence\.test\.mjs/);
  assert.match(workflow, /name:\s*Run real macOS sandbox gate[\s\S]*if:\s*matrix\.slug == 'macos'[\s\S]*NOLANE_RUNTIME_MACOS_SANDBOX_GATE:\s*'1'[\s\S]*node --test tests\/macos-sandbox-runtime-evidence\.test\.mjs/);
  assert.match(workflow, /NolaneCredential/);
  assert.match(workflow, /NOLANE_GITHUB_ISSUE_LINKED/);
  assert.match(workflow, /if: github\.event_name == 'pull_request'/);
  assert.match(workflow, /Get-Content -Raw -LiteralPath \$env:GITHUB_EVENT_PATH \| ConvertFrom-Json/);
  assert.match(workflow, /-match '\(\?im\)\^\\s\*closes\\s\+#\\d\+\\b'/);
  assert.doesNotMatch(workflow, /electron-builder|build:electron|smoke:packaged|release:matrix/);
});
