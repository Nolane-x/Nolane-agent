#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createBuiltInModelProfiles, ModelProfileRegistry } from '../src/model-profiles/index.mjs';
import { ModelHealthLedger, ModelManagementService, ModelPolicyEngine } from '../src/model-management/index.mjs';

const root = path.resolve(process.argv[2] ?? '.');
for (const relative of [
  'src/model-management/model-management-service.mjs',
  'src/model-management/model-policy-engine.mjs',
  'src/model-management/model-health-ledger.mjs',
  'src/model-management/model-profile-dossier.mjs',
  'docs/MODEL-MANAGEMENT-CONTROL-PLANE.md',
  'docs/RELEASE-NOTES-CHECKPOINT-11-MODEL-INTELLIGENCE.md',
  'config/model-management/default-policy.v1.json',
]) await readFile(path.join(root, relative));

const profiles = createBuiltInModelProfiles();
assert.ok(profiles.length >= 500, 'expected at least 500 exact profiles');
const registry = new ModelProfileRegistry({ profiles, clock: () => '2026-08-03T02:24:00.000Z' });
const catalog = registry.exportCatalog();
assert.ok(catalog.families.length >= 70, 'expected broad family and size templates');
const exact = registry.resolve('openai/gpt-5.3-codex');
assert.equal(exact.capabilities.coding, true);
assert.equal(exact.toolCalling.supported, true);
const unknown = registry.resolve({ id: 'future-lab/not-yet-profiled', providerFamily: 'openai-compatible' });
assert.equal(unknown.resolution.kind, 'provisional');
assert.equal(unknown.pricing.inputPerMillion, null);

const ledger = new ModelHealthLedger({ clock: () => '2026-08-03T02:24:00.000Z' });
const engine = new ModelPolicyEngine();
const manager = new ModelManagementService({ registry, healthLedger: ledger, policyEngine: engine, clock: () => '2026-08-03T02:24:00.000Z' });
const recommendation = manager.recommend({ candidateIds: ['openai/gpt-5.3-codex', 'future-lab/not-yet-profiled'], request: { requiredCapabilities: ['coding', 'toolCalling', 'structuredOutput'], taskClass: 'large' } });
assert.equal(recommendation.candidates.find((item) => item.modelId === 'future-lab/not-yet-profiled').eligible, false);
assert.match(recommendation.receiptSha256, /^[a-f0-9]{64}$/);
const dossier = manager.dossier('openai/gpt-5.3-codex');
assert.equal(dossier.canonicalId, 'openai/gpt-5.3-codex');
assert.match(dossier.receiptSha256, /^[a-f0-9]{64}$/);

const routes = await readFile(path.join(root, 'src/server/routes.mjs'), 'utf8');
for (const endpoint of ['/api/model-management/snapshot', '/api/model-management/recommend', '/api/model-management/portfolio', '/api/model-management/observations', '/api/model-management/dossier']) assert.match(routes, new RegExp(endpoint.replaceAll('/', '\\/')));

console.log(JSON.stringify({
  status: 'pass', schema: 'nolane.model-intelligence-verification.v1',
  exactProfiles: catalog.profiles.length, templates: catalog.families.length,
  catalogReceiptSha256: catalog.receiptSha256,
  recommendationReceiptSha256: recommendation.receiptSha256,
  dossierReceiptSha256: dossier.receiptSha256,
}, null, 2));
