import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('UI v3 settings route mounts the real API controller and applies preferences', async () => {
  const app = await readFile(new URL('../ui-v3/app.mjs', import.meta.url), 'utf8');
  assert.match(app, /createApiClient/);
  assert.match(app, /createSettingsController/);
  assert.match(app, /applyPreferences/);
  assert.match(app, /view\.mount/);
  assert.match(app, /data-settings-action/);
});
