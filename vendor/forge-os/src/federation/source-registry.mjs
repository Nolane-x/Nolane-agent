import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeFederationSource } from './contracts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FILES = ['config/federation-sources.json','config/knowledge-sources.json','config/mcp-registry-sources.json'];
let cache = null;

export async function loadFederationSources({ refresh = false } = {}) {
  if (cache && !refresh) return cache.map((entry) => ({...entry}));
  const entries=[];
  for (const file of FILES) entries.push(...JSON.parse(await readFile(path.join(ROOT,file),'utf8')));
  cache = entries.map(normalizeFederationSource);
  const report = validateSourceRegistry(cache);
  if (report.errors.length) throw new TypeError(`Invalid federation source registry: ${report.errors.join('; ')}`);
  return cache.map((entry) => ({...entry}));
}

export function getFederationSource(sources, id) {
  const source = sources.find((entry) => entry.id === id);
  if (!source) throw new Error(`Unknown federation source: ${id}`);
  return source;
}

export function validateSourceRegistry(entries) {
  const errors=[]; const ids=new Set();
  for (const source of entries ?? []) {
    if (ids.has(source.id)) errors.push(`duplicate source id: ${source.id}`); ids.add(source.id);
    if (source.kind === 'mcp-awesome-list' && (source.authority !== 'community' || source.trust !== 'discovery')) errors.push(`${source.id}: awesome lists must remain community discovery sources`);
    if (source.revision === 'resolve-on-sync' && source.trust !== 'discovery') errors.push(`${source.id}: unresolved revision cannot be trusted`);
    if (source.license.mode === 'vendor-allowed' && source.license.spdx === 'UNKNOWN') errors.push(`${source.id}: unknown license cannot be vendored`);
  }
  return { errors, count:entries?.length ?? 0, official:entries?.filter((s)=>s.authority==='official').length ?? 0 };
}
