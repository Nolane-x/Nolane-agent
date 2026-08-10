import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('external gate workflow uses least privilege and real Windows Linux macOS runners without Electron packaging', async () => {
  const workflow = await readFile('.github/workflows/external-gates.yml', 'utf8');
  assert.match(workflow, /permissions:\s*\n\s+contents:\s*read/);
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
  assert.doesNotMatch(workflow, /electron-builder|build:electron|smoke:packaged|release:matrix/);
});
