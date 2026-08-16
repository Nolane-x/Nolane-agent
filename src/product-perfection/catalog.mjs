import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_PERFECTION_CATALOG = path.join(
  'docs', 'product-perfection', 'MICRO-DETAIL-CLOSURE-CATALOG.md'
);

const ITEM_RE = /^-\s+`(PFX-[A-Z]+-\d{3})`\s+(.+?)\s*$/;
const SECTION_RE = /^#\s+([A-Z])\.\s+(.+?)\s*$/;

export function parsePerfectionCatalog(markdown, { source = DEFAULT_PERFECTION_CATALOG } = {}) {
  const ids = new Map();
  const sections = new Map();
  let currentSection = null;

  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const sectionMatch = line.match(SECTION_RE);
    if (sectionMatch) {
      currentSection = `${sectionMatch[1]}. ${sectionMatch[2]}`;
      if (!sections.has(currentSection)) sections.set(currentSection, []);
      continue;
    }

    const itemMatch = line.match(ITEM_RE);
    if (!itemMatch) continue;

    const [, id, description] = itemMatch;
    if (!currentSection) {
      throw new Error(`${source}:${index + 1}: perfection item ${id} has no owning section`);
    }
    if (ids.has(id)) {
      const first = ids.get(id);
      throw new Error(`${source}:${index + 1}: duplicate perfection id ${id}; first declared at line ${first.line}`);
    }

    const item = Object.freeze({
      id,
      description: description.trim(),
      section: currentSection,
      line: index + 1,
    });
    ids.set(id, item);
    sections.get(currentSection).push(id);
  }

  if (ids.size === 0) {
    throw new Error(`${source}: no PFX items found`);
  }

  return Object.freeze({ source, ids, sections });
}

export async function loadPerfectionCatalog(root = process.cwd(), relativePath = DEFAULT_PERFECTION_CATALOG) {
  const absolutePath = path.resolve(root, relativePath);
  const markdown = await readFile(absolutePath, 'utf8');
  return parsePerfectionCatalog(markdown, { source: relativePath });
}
