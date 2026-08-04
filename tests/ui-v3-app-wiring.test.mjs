import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('application selects the Nolane Agent UI root through the fail-closed resolver', async () => {
  const source = await readFile('src/app.mjs', 'utf8');
  assert.match(source, /resolveUiRoot/);
  assert.match(source, /nolaneEnvironment\.get\('UI_VERSION', 'v3'\)/);
  assert.doesNotMatch(source, /uiRoot:\s*path\.join\(appRoot, 'ui'\)/);
});

test('UI resolver defaults to the canonical Nolane environment variable', async () => {
  const resolver = await readFile('src/ui/ui-root-resolver.mjs', 'utf8');
  assert.match(resolver, /process\.env\.NOLANE_AGENT_UI_VERSION/);
});

test('portable and Electron packaging include the built UI v3 closure', async () => {
  const portable = await readFile('scripts/build-portable.mjs', 'utf8');
  const electron = await readFile('scripts/build-electron.mjs', 'utf8');
  assert.match(portable, /ui-dist/);
  assert.match(electron, /ui-dist/);
});
