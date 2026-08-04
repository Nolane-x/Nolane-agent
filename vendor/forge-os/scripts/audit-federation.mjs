import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { FederationCatalogStore } from '../src/federation/catalog-store.mjs';
import { loadBuiltInProviders, seedBuiltInProviders } from '../src/federation/local-provider-seed.mjs';
import { buildFederationAuditReport } from '../src/evals/federation-audit-report.mjs';

const root = process.env.FORGEOS_FEDERATION_DATA ?? '.forgeos-data/.federation';
const out = process.argv[2] ?? process.env.FORGEOS_FEDERATION_AUDIT_OUTPUT ?? 'dist/federation-audit.json';
const corpus = JSON.parse(await readFile(new URL('../evals/federation/adversarial-corpus.json', import.meta.url), 'utf8'));
const store = new FederationCatalogStore(root);
await store.initialize();
await seedBuiltInProviders(store, await loadBuiltInProviders());
const report = await buildFederationAuditReport({ store, corpus });
await mkdir(path.dirname(path.resolve(out)), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ ...report.inventory, ...report.coverage, adversarial: `${report.adversarial.passed}/${report.adversarial.total}`, reportSha256: report.reportSha256 }));
