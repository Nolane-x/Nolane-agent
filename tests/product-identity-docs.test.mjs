import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('top-level documentation identifies the current Nolane Agent product', () => {
  const readme = read('README.md');
  const architecture = read('docs/ARCHITECTURE.md');
  assert.match(readme, /^# Nolane Agent/m);
  assert.doesNotMatch(readme.split('\n')[0], /Native Runtime Conversion Wave/i);
  assert.match(architecture, /^# Nolane Agent Architecture/m);
  assert.doesNotMatch(architecture.split('\n')[0], /Forge Studio/i);
});

test('documentation states GitHub Releases updater metadata and retained ForgeOS compatibility truth', () => {
  const combined = `${read('README.md')}\n${read('docs/ARCHITECTURE.md')}\n${read('docs/COMPATIBILITY-SUBSTRATES.md')}`;
  assert.match(combined, /electron-updater[^\n]*GitHub Releases metadata|GitHub Releases metadata[^\n]*electron-updater/i);
  assert.doesNotMatch(combined, /config\/update\.json[^\n]*(?:release-generated|generated during release)/i);
  assert.match(combined, /vendor\/forge-os[^\n]*(?:compatibility|authority)/i);
  const factualLines = combined.split('\n').map((line) => line.trim()).filter((line) => !/must not claim|does not claim|cannot claim/i.test(line));
  assert.equal(factualLines.some((line) => /^ForgeOS (?:is|has been) (?:fully )?(?:removed|absent)/i.test(line)), false);
});
