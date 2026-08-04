#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createBuiltInModelProfiles, ModelProfileRegistry } from '../src/model-profiles/index.mjs';
import { ModelManagementService, dossierToMarkdown } from '../src/model-management/index.mjs';
import { sha256Receipt } from '../src/model-profiles/model-profile-schema.mjs';

const output = path.resolve(process.argv[2] ?? 'release/model-intelligence');
await mkdir(output, { recursive: true });
const clock = () => '2026-08-03T02:24:00.000Z';
const registry = new ModelProfileRegistry({ profiles: createBuiltInModelProfiles(), clock });
const manager = new ModelManagementService({ registry, clock });
const catalog = registry.exportCatalog();
const dossiers = catalog.profiles.map((profile) => manager.dossier(profile.canonicalId));
const stats = {
  schema: 'nolane.model-profile-statistics.v1', generatedAt: clock(),
  exactProfiles: catalog.profiles.length, templates: catalog.families.length,
  publishers: [...new Set(catalog.profiles.map((item) => item.identity?.publisher).filter(Boolean))].sort(),
  providerFamilies: [...new Set(catalog.profiles.map((item) => item.providerFamily).filter(Boolean))].sort(),
  lifecycle: Object.fromEntries([...new Set(catalog.profiles.map((item) => item.lifecycle?.status ?? 'unknown'))].sort().map((status) => [status, catalog.profiles.filter((item) => (item.lifecycle?.status ?? 'unknown') === status).length])),
  localProfiles: catalog.profiles.filter((item) => item.deployment?.local === true).length,
  toolCallingVerified: catalog.profiles.filter((item) => item.toolCalling?.supported === true).length,
  structuredOutputVerified: catalog.profiles.filter((item) => item.capabilities?.structuredOutput === true).length,
  codingVerified: catalog.profiles.filter((item) => item.capabilities?.coding === true).length,
  unknownPricing: catalog.profiles.filter((item) => item.pricing?.inputPerMillion == null || item.pricing?.outputPerMillion == null).length,
  catalogReceiptSha256: catalog.receiptSha256,
};
stats.receiptSha256 = sha256Receipt(stats);
const markdown = [
  '# Nolane Model Profile Dossiers', '',
  `Generated: ${clock()}`, `Exact profiles: ${catalog.profiles.length}`, `Family/size templates: ${catalog.families.length}`, `Catalog receipt: \`${catalog.receiptSha256}\``, '',
  'This document is generated from the normalized catalog. Null and unknown fields are retained rather than invented.', '',
  ...dossiers.flatMap((dossier) => [dossierToMarkdown(dossier), '---', '']),
].join('\n');
await writeFile(path.join(output, 'model-profile-catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
await writeFile(path.join(output, 'model-profile-dossiers.json'), `${JSON.stringify({ schema: 'nolane.model-profile-dossiers.v1', generatedAt: clock(), dossiers, receiptSha256: sha256Receipt(dossiers) }, null, 2)}\n`);
await writeFile(path.join(output, 'model-profile-dossiers.md'), markdown);
await writeFile(path.join(output, 'model-profile-statistics.json'), `${JSON.stringify(stats, null, 2)}\n`);
await writeFile(path.join(output, 'model-management-snapshot.json'), `${JSON.stringify(manager.snapshot(), null, 2)}\n`);
console.log(JSON.stringify({ output, ...stats }, null, 2));
