import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PRODUCT_IDENTITY, canonicalEnvironmentName, isLegacyProductName } from '../src/product-identity.mjs';

test('Nolane Agent 0.0.0 is the single canonical product identity for the clean baseline', async () => {
  assert.equal(PRODUCT_IDENTITY.product, 'Nolane Agent');
  assert.equal(PRODUCT_IDENTITY.packageName, 'nolane-agent');
  assert.equal(PRODUCT_IDENTITY.version, '0.0.0');
  assert.equal(PRODUCT_IDENTITY.channel, 'stable');
  assert.equal(PRODUCT_IDENTITY.artifactPrefix, 'NolaneAgent');
  assert.equal(canonicalEnvironmentName('UI_VERSION'), 'NOLANE_AGENT_UI_VERSION');
  assert.equal(isLegacyProductName('Forge Studio'), false);
  assert.equal(isLegacyProductName('Nolane Agent'), false);

  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(pkg.name, PRODUCT_IDENTITY.packageName);
  assert.equal(pkg.version, PRODUCT_IDENTITY.version);

  const manifest = JSON.parse(await readFile('project-manifest.json', 'utf8'));
  assert.equal(manifest.schema, 'nolane.agent.project-manifest.v1');
  assert.equal(manifest.product, PRODUCT_IDENTITY.product);
});
