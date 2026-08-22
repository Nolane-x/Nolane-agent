import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PRODUCT_IDENTITY, canonicalEnvironmentName, isLegacyProductName } from '../src/product-identity.mjs';

test('the configured Nolane Agent version is the canonical release identity', async () => {
  assert.equal(PRODUCT_IDENTITY.product, 'Nolane Agent');
  assert.equal(PRODUCT_IDENTITY.packageName, 'nolane-agent');
  assert.match(PRODUCT_IDENTITY.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  assert.equal(PRODUCT_IDENTITY.channel, 'stable');
  assert.equal(PRODUCT_IDENTITY.artifactPrefix, 'NolaneAgent');
  assert.equal(canonicalEnvironmentName('UI_VERSION'), 'NOLANE_AGENT_UI_VERSION');
  assert.equal(isLegacyProductName('Forge Studio'), true);
  assert.equal(isLegacyProductName('Nolane Agent'), false);
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(pkg.name, PRODUCT_IDENTITY.packageName);
  assert.equal(pkg.version, PRODUCT_IDENTITY.version);
  const manifest = JSON.parse(await readFile('project-manifest.json', 'utf8'));
  assert.equal(manifest.schema, 'nolane.agent.project-manifest.v1');
  assert.equal(manifest.product, 'Nolane Agent');
});

test('the current public release documents match the configured Nolane Agent version', async () => {
  const version = PRODUCT_IDENTITY.version;
  const [readme, releaseNotes, limitations, verification, gaps] = await Promise.all([
    readFile('README.md', 'utf8'),
    readFile(`docs/RELEASE-${version}.md`, 'utf8'),
    readFile(`docs/LIMITATIONS-${version}.md`, 'utf8'),
    readFile(`docs/VERIFICATION-REPORT-${version}.md`, 'utf8'),
    readFile(`docs/REMAINING-GAPS-${version}.md`, 'utf8'),
  ]);
  for (const document of [readme, releaseNotes, limitations, verification, gaps]) {
    assert.ok(document.includes(`Nolane Agent ${version}`));
  }
  assert.ok(readme.includes(`docs/RELEASE-${version}.md`));
  assert.ok(readme.includes(`docs/LIMITATIONS-${version}.md`));
  assert.ok(readme.includes(`docs/VERIFICATION-REPORT-${version}.md`));
  assert.ok(readme.includes(`docs/REMAINING-GAPS-${version}.md`));
});
