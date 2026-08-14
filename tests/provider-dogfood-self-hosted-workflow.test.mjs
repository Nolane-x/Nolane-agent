import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflowPath = new URL('../.github/workflows/provider-real-dogfood-self-hosted.yml', import.meta.url);

function count(text, fragment) {
  return text.split(fragment).length - 1;
}

test('provider-real dogfood workflow is manual-only and bound to the dedicated Windows runner', async () => {
  const source = await readFile(workflowPath, 'utf8');
  assert.match(source, /workflow_dispatch:/);
  assert.doesNotMatch(source, /^\s{2}(push|pull_request|schedule):/m);
  assert.match(source, /runs-on:\s*\[self-hosted, Windows, X64, nolane-provider-dogfood\]/);
  assert.match(source, /permissions:\s*\n\s+contents:\s*read/);
  assert.match(source, /persist-credentials:\s*false/);
  assert.equal(source.includes('${{ secrets.'), false);
  assert.equal(source.includes('github.token'), false);
  assert.match(source, /NOLANE_PROVIDER_DOGFOOD_ALLOW_REAL_RUN:\s*["']?1["']?/);
});

test('workflow passes provider input through a PowerShell argument array and never composes an executable shell command', async () => {
  const source = await readFile(workflowPath, 'utf8');
  assert.match(source, /\$arguments\s*=\s*@\(/);
  assert.match(source, /&\s+node\s+@arguments/);
  assert.doesNotMatch(source, /Invoke-Expression|iex\s|cmd\s+\/c|powershell\s+-Command/i);
  assert.match(source, /--acknowledge-real-provider-run/);
  assert.match(source, /--provider/);
  assert.match(source, /--workspace/);
  assert.match(source, /--output/);
});

test('workflow publishes only the sanitized candidate with short retention and always cleans isolated state', async () => {
  const source = await readFile(workflowPath, 'utf8');
  assert.match(source, /actions\/upload-artifact@v4/);
  assert.match(source, /retention-days:\s*3/);
  assert.match(source, /provider-dogfood-candidate\.json/);
  assert.equal(count(source, 'actions/upload-artifact@v4'), 1);
  assert.match(source, /if:\s*always\(\)/);
  assert.match(source, /Remove-Item[^\n]*-Recurse[^\n]*-Force/);
  assert.doesNotMatch(source, /prompt\.txt|output\.txt|stdout|stderr|transcript/i);
});
