import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('checked-in v0.6 graph provider digests match the provider catalog', async () => {
  // This test is deliberately read-only. Generator execution belongs in the
  // sequential CI/release gate; mutating generated trees from a parallel test
  // can delete files while unrelated tests are reading them.
  const catalog = JSON.parse(await readFile('providers/built-in-providers.json', 'utf8'));
  const graph = JSON.parse(await readFile('capabilities-v2/providers.json', 'utf8'));
  const expected = new Map(
    catalog
      .filter((provider) => provider.kind === 'skill')
      .map((provider) => [provider.providerId, provider.providerDigest]),
  );

  assert.ok(expected.size > 0, 'provider catalog must include skill providers');
  for (const node of graph) {
    if (node.kind !== 'skill') continue;
    assert.equal(
      node.providerDigest,
      expected.get(node.providerId),
      `provider digest drift for ${node.providerId}`,
    );
  }
});

test('v0.6 release generation orders providers before graph compilation and skips legacy generation', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.ok(
    pkg.scripts['generate:v06'].indexOf('generate-local-providers')
      < pkg.scripts['generate:v06'].indexOf('compile-capability-graph-v2'),
  );
  const { RELEASE_COMMANDS } = await import('../scripts/release-verify.mjs');
  assert.ok(RELEASE_COMMANDS.includes('npm run generate:v06'));
  assert.ok(!RELEASE_COMMANDS.includes('npm run generate:v2'));
});
