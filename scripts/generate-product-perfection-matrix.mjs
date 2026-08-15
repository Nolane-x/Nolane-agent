import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadPerfectionCatalog } from '../src/product-perfection/catalog.mjs';
import { buildPerfectionMatrix } from '../src/product-perfection/matrix-store.mjs';

const root = process.cwd();
const catalog = await loadPerfectionCatalog(root);
const matrix = buildPerfectionMatrix({ catalog, observations: [] });
const outPath = path.resolve(root, 'requirements/product-perfection-matrix.json');
await writeFile(outPath, `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');
console.log(`product-perfection matrix: ${matrix.total} items; UNKNOWN=${matrix.counts.UNKNOWN}`);
