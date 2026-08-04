import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('primary navigation exposes only Mission, Work and Evidence while advanced centers remain command-reachable', async () => {
  const html = await readFile(new URL('../ui/index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../ui/app.js', import.meta.url), 'utf8');
  const primary = [...html.matchAll(/class="rail-button primary-shell-button[^"]*"[^>]+data-shell="([^"]+)"[^>]+title="([^"]+)"/g)].map((match) => [match[1], match[2]]);
  assert.deepEqual(primary, [['mission', 'Mission'], ['work', 'Work'], ['evidence', 'Evidence']]);
  assert.match(html, /<div class="advanced-center-launchers" hidden>/);
  for (const id of ['runtime-center-button','integrated-browser-button','secrets-manager-button','sandbox-manager-button','workspace-trust-button','agent-operations-button','context-memory-button','trace-evidence-button','repository-intelligence-button','codebase-knowledge-button','local-operations-button','evidence-runtime-button','git-governance-button','instruction-governance-button','agent-modes-button','mission-state-button']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /const SHELL_ROUTES=Object\.freeze\(\{mission:'home',work:'task',evidence:'evidenceRuntime'\}\)/);
  assert.match(app, /Object\.entries\(CENTER_SPECS\)\.map/);
  assert.match(app, /openShell\(button\.dataset\.shell\)/);
});
