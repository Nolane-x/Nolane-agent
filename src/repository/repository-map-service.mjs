import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const normalize = (value) => String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
const IMPORT_PATTERNS = [
  /\b(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
  /^\s*from\s+([A-Za-z0-9_./-]+)\s+import\b/gm,
  /^\s*import\s+([A-Za-z0-9_./-]+)\b/gm,
  /^\s*use\s+([A-Za-z0-9_:]+)\b/gm,
];

function importsOf(content) {
  const found = new Set();
  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(String(content ?? ''))) !== null) found.add(match[1]);
  }
  return [...found];
}

function resolveImport(fromPath, specifier, paths) {
  if (!specifier.startsWith('.')) return null;
  const base = normalize(path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), specifier)));
  const candidates = [base, `${base}.mjs`, `${base}.js`, `${base}.cjs`, `${base}.ts`, `${base}.tsx`, `${base}.jsx`, `${base}.py`, `${base}.go`, `${base}.rs`, `${base}/index.mjs`, `${base}/index.js`, `${base}/index.ts`];
  return candidates.find((candidate) => paths.has(candidate)) ?? null;
}

function pageRank(nodes, outgoing, { damping = 0.85, iterations = 24 } = {}) {
  const count = nodes.length;
  if (!count) return new Map();
  let ranks = new Map(nodes.map((node) => [node, 1 / count]));
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = new Map(nodes.map((node) => [node, (1 - damping) / count]));
    let dangling = 0;
    for (const node of nodes) {
      const targets = outgoing.get(node) ?? [];
      if (!targets.length) { dangling += ranks.get(node) ?? 0; continue; }
      const contribution = damping * (ranks.get(node) ?? 0) / targets.length;
      for (const target of targets) next.set(target, (next.get(target) ?? 0) + contribution);
    }
    const danglingContribution = damping * dangling / count;
    for (const node of nodes) next.set(node, (next.get(node) ?? 0) + danglingContribution);
    ranks = next;
  }
  return ranks;
}

export class RepositoryMapService {
  constructor({ store } = {}) {
    if (!store?.db) throw new TypeError('RepositoryMapService requires a StudioStore');
    this.store = store;
  }

  build(projectId, { maxFiles = 200, maxSymbolsPerFile = 20, maxChars = 32_000 } = {}) {
    const fileLimit = Math.max(1, Math.min(2_000, Number(maxFiles) || 200));
    const symbolLimit = Math.max(0, Math.min(100, Number(maxSymbolsPerFile) || 20));
    const charLimit = Math.max(1_000, Math.min(1_000_000, Number(maxChars) || 32_000));
    const rows = this.store.db.prepare('SELECT path,language,content FROM repository_files WHERE project_id=? ORDER BY path').all(String(projectId));
    const paths = new Set(rows.map((row) => normalize(row.path)));
    const outgoing = new Map(rows.map((row) => [normalize(row.path), []]));
    const incoming = new Map(rows.map((row) => [normalize(row.path), []]));
    for (const row of rows) {
      const source = normalize(row.path);
      for (const specifier of importsOf(row.content)) {
        const target = resolveImport(source, specifier, paths);
        if (!target || outgoing.get(source).includes(target)) continue;
        outgoing.get(source).push(target);
        incoming.get(target).push(source);
      }
    }
    for (const values of [...outgoing.values(), ...incoming.values()]) values.sort();
    const ranks = pageRank([...paths].sort(), outgoing);
    const symbolsByPath = new Map();
    for (const symbol of this.store.db.prepare('SELECT path,kind,name,line,signature FROM repository_symbols WHERE project_id=? ORDER BY path,line,kind,name').all(String(projectId))) {
      const key = normalize(symbol.path);
      if (!symbolsByPath.has(key)) symbolsByPath.set(key, []);
      if (symbolsByPath.get(key).length < symbolLimit) symbolsByPath.get(key).push({ kind: symbol.kind, name: symbol.name, line: Number(symbol.line), signature: symbol.signature });
    }
    const ranked = rows.map((row) => {
      const filePath = normalize(row.path);
      const importedBy = incoming.get(filePath) ?? [];
      const imports = outgoing.get(filePath) ?? [];
      const rank = Number(ranks.get(filePath) ?? 0);
      return { path: filePath, language: row.language, imports: [...imports], importedBy: [...importedBy], centrality: rank, importance: rank + importedBy.length * 0.25 + imports.length * 0.02, symbols: symbolsByPath.get(filePath) ?? [] };
    }).sort((left, right) => right.importance - left.importance || right.importedBy.length - left.importedBy.length || left.path.localeCompare(right.path));

    const files = [];
    for (const file of ranked.slice(0, fileLimit)) {
      const candidate = { path: file.path, language: file.language, imports: file.imports, importedBy: file.importedBy, centrality: Number(file.centrality.toFixed(8)), symbols: file.symbols };
      const next = [...files, candidate];
      if (JSON.stringify(next).length > charLimit) break;
      files.push(Object.freeze(candidate));
    }
    const base = { schema: 'forge.repository-map.v1', projectId: String(projectId), files: Object.freeze(files), totalFiles: rows.length, omittedFiles: Math.max(0, rows.length - files.length), maxChars: charLimit, totalChars: JSON.stringify(files).length };
    return Object.freeze({ ...base, mapSha256: canonicalSha256(base) });
  }
}
