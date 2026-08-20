import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadPerfectionCatalog } from '../src/product-perfection/catalog.mjs';
import { normalizePerfectionObservation, PERFECTION_STATUSES } from '../src/product-perfection/matrix-store.mjs';

const root = process.cwd();
const matrixPath = path.resolve(root, 'requirements/product-perfection-matrix.json');
const catalog = await loadPerfectionCatalog(root);
const matrix = JSON.parse(await readFile(matrixPath, 'utf8'));

if (matrix?.schema !== 'nolane.product-perfection.matrix.v1') throw new Error('invalid product-perfection matrix schema');
if (!Array.isArray(matrix.items)) throw new Error('product-perfection matrix items must be an array');
if (matrix.items.length !== catalog.ids.size) throw new Error(`matrix coverage mismatch: ${matrix.items.length}/${catalog.ids.size}`);

const knownIds = new Set(catalog.ids.keys());
const seen = new Set();
const counts = Object.fromEntries(PERFECTION_STATUSES.map((status) => [status, 0]));
for (const raw of matrix.items) {
  if (seen.has(raw.id)) throw new Error(`duplicate matrix id: ${raw.id}`);
  const item = normalizePerfectionObservation(raw, { knownIds });
  seen.add(item.id);
  counts[item.status] += 1;
}
for (const id of knownIds) if (!seen.has(id)) throw new Error(`matrix missing catalog id: ${id}`);
if (matrix.total !== matrix.items.length) throw new Error(`matrix total mismatch: ${matrix.total}/${matrix.items.length}`);
for (const status of PERFECTION_STATUSES) {
  if (Number(matrix.counts?.[status] ?? -1) !== counts[status]) throw new Error(`matrix count mismatch for ${status}`);
}
console.log(`product-perfection matrix verified: ${matrix.items.length} items; PASS=${counts.PASS}; UNKNOWN=${counts.UNKNOWN}; BLOCKED=${counts.BLOCKED}`);
