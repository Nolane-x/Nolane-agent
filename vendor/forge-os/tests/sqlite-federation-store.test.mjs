import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SqliteFederationCatalogStore } from '../src/storage/sqlite-federation-store.mjs';
import { buildBuiltInProviders } from '../src/federation/local-provider-seed.mjs';

test('SQLite federation catalog seeds 1,299 built-ins atomically and preserves operator overrides', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-federation-sqlite-'));
  const store = new SqliteFederationCatalogStore(path.join(root, 'forgeos.db'));
  try {
    await store.initialize();
    const providers = await buildBuiltInProviders();
    const seeded = await store.seedProviders(providers);
    assert.equal(seeded.providers.length, 1299);
    const revision = seeded.revision;
    assert.equal((await store.seedProviders(providers)).revision, revision);
    const overridden = { ...seeded.providers[0], title: 'Operator override' };
    await store.replaceProvider(overridden);
    await store.seedProviders(providers);
    assert.equal((await store.read()).providers.find((provider) => provider.providerId === overridden.providerId).title, 'Operator override');
    assert.equal((await store.health()).ok, true);
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('independent SQLite federation stores detect revision conflicts instead of losing provider updates', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-federation-conflict-'));
  const file = path.join(root, 'forgeos.db');
  const first = new SqliteFederationCatalogStore(file);
  const second = new SqliteFederationCatalogStore(file);
  try {
    await first.initialize();
    const [providerA, providerB] = (await buildBuiltInProviders()).slice(0, 2);
    const baseline = await first.read();
    const results = await Promise.allSettled([
      first.importProvider(providerA, { expectedRevision: baseline.revision }),
      second.importProvider(providerB, { expectedRevision: baseline.revision }),
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
    assert.equal((await first.read()).providers.length, 1);
  } finally {
    first.close(); second.close();
    await rm(root, { recursive: true, force: true });
  }
});
