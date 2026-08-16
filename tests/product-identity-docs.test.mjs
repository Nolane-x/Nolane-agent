import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('public documentation identifies the clean Nolane Agent 0.0.0 baseline', () => {
  const readme = read('README.md');
  const architecture = read('docs/ARCHITECTURE.md');
  const releases = read('docs/RELEASES.md');
  assert.match(readme, /^# Nolane Agent 0\.0\.0/m);
  assert.match(architecture, /^# Architecture/m);
  assert.match(releases, /^# Releases/m);
  for (const document of [readme, architecture, releases]) {
    assert.doesNotMatch(document, /Product Perfection|Task 1[0-3]|5\.0\.0-beta/i);
  }
});

test('documentation keeps update trust fail-closed until release evidence exists', () => {
  const combined = `${read('README.md')}\n${read('docs/CONFIGURATION.md')}\n${read('docs/RELEASES.md')}\n${read('docs/PLATFORMS.md')}`;
  assert.match(combined, /config\/update\.json/i);
  assert.match(combined, /disabled/i);
  assert.match(combined, /signing|signature|verified/i);
  assert.doesNotMatch(combined, /signed (?:Windows|macOS|Linux) release is verified/i);
});
