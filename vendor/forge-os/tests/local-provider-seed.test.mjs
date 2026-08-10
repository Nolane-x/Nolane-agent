import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { loadCapabilityCatalog } from '../src/federation/capability-catalog.mjs';
import { buildBuiltInProviders, seedBuiltInProviders } from '../src/federation/local-provider-seed.mjs';
import { canonicalTextContent } from '../src/core/canonical-text.mjs';
import { FederationCatalogStore } from '../src/federation/catalog-store.mjs';
import { resolveCapabilityBundle } from '../src/federation/resolver.mjs';

test('built-in provider seed exposes 275 procedural skills and one knowledge mapping per capability', async () => {
  const catalog = await loadCapabilityCatalog();
  const providers = await buildBuiltInProviders();
  const skillProviders = providers.filter((provider) => provider.kind === 'skill');
  const knowledgeProviders = providers.filter((provider) => provider.kind === 'knowledge');

  assert.equal(skillProviders.length, 275);
  assert.equal(knowledgeProviders.length, 1024);
  assert.equal(new Set(providers.map((provider) => provider.providerId)).size, providers.length);
  assert.equal(new Set(providers.map((provider) => provider.providerDigest)).size, providers.length);
  assert.deepEqual(new Set(knowledgeProviders.map((provider) => provider.capabilityId)), new Set(catalog.map((capability) => capability.capabilityId)));
  assert.ok(new Set(skillProviders.flatMap((provider) => provider.capabilityIds ?? [provider.capabilityId])).size >= 100, 'many-to-many skill mappings must cover meaningfully different capabilities');
  assert.ok(skillProviders.some((provider) => provider.status === 'candidate'), 'candidate first-party skills must remain candidate');
  assert.ok(skillProviders.some((provider) => provider.status === 'stable'), 'stable first-party skills must remain stable');
  assert.ok(providers.every((provider) => provider.sourceId === 'forgeos-local'));
  assert.ok(providers.every((provider) => provider.contentDigest === provider.providerDigest || /^[a-f0-9]{64}$/.test(provider.contentDigest)));
});

test('built-in provider generation is deterministic and bundles resolve without loading remote bodies', async () => {
  const first = await buildBuiltInProviders();
  const second = await buildBuiltInProviders();
  assert.deepEqual(first, second);

  const capabilityId = first.find((provider) => provider.kind === 'skill' && provider.status === 'stable').capabilityId;
  const capability = (await loadCapabilityCatalog()).find((item) => item.capabilityId === capabilityId);
  const bundle = resolveCapabilityBundle(capability, { agent: 'generic', tools: capability.requiredTools, allowExternal: false, activeProviders: [] }, first);

  assert.ok(bundle.providers.some((provider) => provider.kind === 'skill'));
  assert.ok(bundle.providers.some((provider) => provider.kind === 'knowledge'));
  assert.equal(bundle.approvalsRequired.length, 0);
  assert.ok(bundle.providers.every((provider) => !provider.instructionBody));
});

test('provider source content is canonical across Windows and Unix line endings', () => {
  assert.equal(canonicalTextContent('first\r\nsecond\rthird\n'), 'first\nsecond\nthird\n');
});

test('catalog seeding is idempotent and never overwrites an existing provider', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forgeos-provider-seed-'));
  const store = new FederationCatalogStore(root);
  await store.initialize();
  const builtIns = await buildBuiltInProviders();

  const first = await seedBuiltInProviders(store, builtIns);
  const revisionAfterFirst = first.revision;
  const second = await seedBuiltInProviders(store, builtIns);
  assert.equal(second.revision, revisionAfterFirst, 'idempotent seed must not create a new revision');
  assert.equal(second.providers.length, 1299);

  const existing = second.providers[0];
  await store.replaceProvider({ ...existing, title: 'Operator override' });
  await seedBuiltInProviders(store, builtIns);
  const finalState = await store.read();
  assert.equal(finalState.providers.find((provider) => provider.providerId === existing.providerId).title, 'Operator override');
});

import { FederationService } from '../src/federation/service.mjs';

test('FederationService bootstraps built-in providers before reporting readiness', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forgeos-provider-service-'));
  const service = new FederationService({ catalogStore: new FederationCatalogStore(root) });
  const status = await service.initialize();
  assert.equal(status.providerCount, 1299);
  assert.equal(status.builtInProviderCount, 1299);
  assert.equal(status.externalProviderCount, 0);
  assert.equal(status.proceduralProviderCount, 275);
  assert.equal(status.knowledgeProviderCount, 1024);
});
