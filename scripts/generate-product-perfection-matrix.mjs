import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadPerfectionCatalog } from '../src/product-perfection/catalog.mjs';
import { buildPerfectionMatrix } from '../src/product-perfection/matrix-store.mjs';

const root = process.cwd();
const catalog = await loadPerfectionCatalog(root);
const observationsPath = path.resolve(root, 'requirements/product-perfection-observations.json');
let observations = [];
try {
  const parsed = JSON.parse(await readFile(observationsPath, 'utf8'));
  observations = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : (() => { throw new Error('product-perfection observations must be an array or observations payload'); })();
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
const matrix = buildPerfectionMatrix({ catalog, observations });
const outPath = path.resolve(root, 'requirements/product-perfection-matrix.json');
await writeFile(outPath, `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');
console.log(`product-perfection matrix: ${matrix.total} items; PASS=${matrix.counts.PASS}; UNKNOWN=${matrix.counts.UNKNOWN}`);
