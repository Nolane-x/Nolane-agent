import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../ui-v3/app.mjs', import.meta.url), 'utf8');
const shell = fs.readFileSync(new URL('../ui-v3/shell/app-shell.mjs', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../ui-v3/core/api-client.mjs', import.meta.url), 'utf8');

test('UI uses direct persistent experience transitions instead of cyclic-only switching', () => {
  assert.doesNotMatch(app, /nextExperience\s*\(/);
  assert.match(app, /createExperienceTransitionController/);
  assert.match(app, /data-experience-option/);
  assert.match(app, /reconcileEffectivePreferences/);
  assert.match(shell, /renderExperienceSwitcher/);
  assert.match(api, /patch:\s*\(path, body\)/);
});
