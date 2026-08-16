import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_PERFECTION_CATALOG, loadPerfectionCatalog } from '../src/product-perfection/catalog.mjs';

const root = process.cwd();
const sourcePath = path.resolve(root, DEFAULT_PERFECTION_CATALOG);
const outPath = path.resolve(root, 'requirements/product-perfection-catalog.json');
const sourceBytes = await readFile(sourcePath);
const catalog = await loadPerfectionCatalog(root);

const sections = [...catalog.sections.entries()].map(([name, ids]) => ({
  name,
  items: ids.map((id) => {
    const item = catalog.ids.get(id);
    return { id: item.id, description: item.description };
  }),
}));

const output = {
  schema: 'nolane.product-perfection.catalog.v1',
  source: DEFAULT_PERFECTION_CATALOG.replaceAll('\\', '/'),
  sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
  total: catalog.ids.size,
  sections,
};

await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`product-perfection catalog: ${output.total} items -> ${path.relative(root, outPath)}`);
