import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PRODUCT_IDENTITY, canonicalEnvironmentName, isLegacyProductName } from '../src/product-identity.mjs';

test('Nolane Agent 0.0.0 is the canonical release identity', async () => {
  assert.equal(PRODUCT_IDENTITY.product, 'Nolane Agent');
  assert.equal(PRODUCT_IDENTITY.packageName, 'nolane-agent');
  assert.equal(PRODUCT_IDENTITY.version, '0.0.0');
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

test('the current public release documents are the Nolane Agent 0.0.0 set', async () => {
  const [readme, releaseNotes, limitations, verification, gaps] = await Promise.all([
    readFile('README.md', 'utf8'),
    readFile('docs/RELEASE-0.0.0.md', 'utf8'),
    readFile('docs/LIMITATIONS-0.0.0.md', 'utf8'),
    readFile('docs/VERIFICATION-REPORT-0.0.0.md', 'utf8'),
    readFile('docs/REMAINING-GAPS-0.0.0.md', 'utf8'),
  ]);
  for (const document of [readme, releaseNotes, limitations, verification, gaps]) {
    assert.match(document, /Nolane Agent 0\.0\.0/);
  }
  assert.match(readme, /docs\/RELEASE-0\.0\.0\.md/);
  assert.match(readme, /docs\/LIMITATIONS-0\.0\.0\.md/);
  assert.match(readme, /docs\/VERIFICATION-REPORT-0\.0\.0\.md/);
  assert.match(readme, /docs\/REMAINING-GAPS-0\.0\.0\.md/);
});
