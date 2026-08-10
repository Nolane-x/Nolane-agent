import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FederationCatalogStore } from '../src/federation/catalog-store.mjs';
import { loadBuiltInProviders, seedBuiltInProviders } from '../src/federation/local-provider-seed.mjs';
import { buildFederationAuditReport } from '../src/evals/federation-audit-report.mjs';

test('federation release audit derives provider, coverage, source trust, and adversarial evidence without hardcoded counts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-fed-audit-'));
  const store = new FederationCatalogStore(root);
  await store.initialize();
  await seedBuiltInProviders(store, await loadBuiltInProviders());
  const corpus = JSON.parse(await readFile('evals/federation/adversarial-corpus.json', 'utf8'));
  const report = await buildFederationAuditReport({ store, corpus, now: Date.parse('2026-07-25T00:00:00Z') });

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.inventory.capabilities, 1024);
  assert.equal(report.inventory.firstPartyProcedural, 275);
  assert.equal(report.inventory.stableFirstPartyProcedural, 33);
  assert.equal(report.inventory.candidateFirstPartyProcedural, 242);
  assert.equal(report.inventory.knowledgeProviderMappings, 1024);
  assert.equal(report.inventory.builtInProviderMappings, 1299);
  assert.equal(report.inventory.externalProvidersImported, 0);
  assert.equal(report.coverage.missingKnowledge, 0);
  assert.equal(report.coverage.missingProcedural, 832);
  assert.equal(report.coverage.missingStableProcedural, 978);
  assert.equal(report.adversarial.total, corpus.length);
  assert.equal(report.adversarial.failed, 0);
  assert.equal(Object.values(report.sources.byTrust).reduce((a,b)=>a+b,0), report.inventory.sources);
  assert.match(report.reportSha256, /^[a-f0-9]{64}$/);
});
