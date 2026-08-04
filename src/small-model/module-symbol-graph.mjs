import path from 'node:path';
import { AstCodemodEngine } from './ast-codemod-engine.mjs';
import { canonicalSha256, deepFreeze } from './shared.mjs';

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const SHA256 = /^[a-f0-9]{64}$/;
const DECLARATION = new Set(['const', 'let', 'var', 'function', 'class']);
const SKIP_TYPES = new Set(['whitespace', 'comment']);

function safePath(value, label = 'module') {
  const text = String(value ?? '').replaceAll('\\', '/');
  if (!text || path.posix.isAbsolute(text) || text.split('/').includes('..')) throw new Error(`${label} path traversal is forbidden`);
  return path.posix.normalize(text);
}

function significant(tokens) {
  return tokens.map((token, rawIndex) => ({ ...token, rawIndex })).filter((token) => !SKIP_TYPES.has(token.type));
}

function resolveImport(fromPath, specifier) {
  const source = String(specifier ?? '');
  if (!source.startsWith('./') && !source.startsWith('../')) return null;
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), source));
  return resolved;
}

function tokenRecord(token, extra = {}) {
  return { start: token.start, end: token.end, name: token.value, ...extra };
}

function parseImport(tokens, start) {
  if (tokens[start]?.value !== 'import') return null;
  let cursor = start + 1;
  if (tokens[cursor]?.value !== '{') return null;
  cursor += 1;
  const items = [];
  while (cursor < tokens.length && tokens[cursor].value !== '}') {
    const importedToken = tokens[cursor];
    if (importedToken.type !== 'identifier') throw new Error('Only named imports are supported in the module graph');
    cursor += 1;
    let localToken = importedToken;
    if (tokens[cursor]?.value === 'as') {
      cursor += 1;
      localToken = tokens[cursor];
      if (localToken?.type !== 'identifier') throw new Error('Named import alias is invalid');
      cursor += 1;
    }
    items.push({ imported: importedToken.value, local: localToken.value, importedToken, localToken });
    if (tokens[cursor]?.value === ',') cursor += 1;
  }
  if (tokens[cursor]?.value !== '}') throw new Error('Named import is unterminated');
  cursor += 1;
  if (tokens[cursor]?.value !== 'from') throw new Error('Named import source is missing');
  cursor += 1;
  const sourceToken = tokens[cursor];
  if (sourceToken?.type !== 'string') throw new Error('Named import source must be a string literal');
  return { endIndex: cursor, source: sourceToken.content, sourceToken, items };
}

function parseExport(tokens, start) {
  if (tokens[start]?.value !== 'export') return null;
  const next = tokens[start + 1];
  if (!next) return null;
  if (DECLARATION.has(next.value)) {
    const name = tokens[start + 2];
    if (name?.type !== 'identifier') throw new Error('Export declaration name is invalid');
    return {
      endIndex: start + 2,
      items: [{ local: name.value, exported: name.value, localToken: name, exportedToken: name, declaration: true, declarationKind: next.value }],
    };
  }
  if (next.value === '{') {
    let cursor = start + 2;
    const items = [];
    while (cursor < tokens.length && tokens[cursor].value !== '}') {
      const localToken = tokens[cursor];
      if (localToken.type !== 'identifier') throw new Error('Export specifier is invalid');
      cursor += 1;
      let exportedToken = localToken;
      if (tokens[cursor]?.value === 'as') {
        cursor += 1;
        exportedToken = tokens[cursor];
        if (exportedToken?.type !== 'identifier') throw new Error('Export alias is invalid');
        cursor += 1;
      }
      items.push({ local: localToken.value, exported: exportedToken.value, localToken, exportedToken, declaration: false, declarationKind: 'specifier' });
      if (tokens[cursor]?.value === ',') cursor += 1;
    }
    if (tokens[cursor]?.value !== '}') throw new Error('Export list is unterminated');
    return { endIndex: cursor, items };
  }
  return null;
}

function isPropertyPosition(tokens, index) {
  const previous = tokens[index - 1];
  const next = tokens[index + 1];
  if (previous?.value === '.') return true;
  if (next?.value === ':' && previous?.value !== '?') return true;
  return false;
}

function parseModule(file) {
  const engine = new AstCodemodEngine();
  const parsed = engine.parse({ source: file.source });
  const tokens = significant(parsed.tokens);
  const imports = [];
  const exports = [];
  const declarations = [];
  const excludedRawIndices = new Set();

  for (let index = 0; index < tokens.length; index += 1) {
    const importRecord = parseImport(tokens, index);
    if (importRecord) {
      for (const item of importRecord.items) {
        imports.push({
          imported: item.imported,
          local: item.local,
          source: importRecord.source,
          importedOccurrence: tokenRecord(item.importedToken, { kind: 'imported-name' }),
          localOccurrence: tokenRecord(item.localToken, { kind: 'import-local' }),
        });
        excludedRawIndices.add(item.importedToken.rawIndex);
        excludedRawIndices.add(item.localToken.rawIndex);
      }
      index = importRecord.endIndex;
      continue;
    }
    const exportRecord = parseExport(tokens, index);
    if (exportRecord) {
      for (const item of exportRecord.items) {
        exports.push({
          local: item.local,
          exported: item.exported,
          declaration: item.declaration,
          declarationKind: item.declarationKind,
          localOccurrence: tokenRecord(item.localToken, { kind: item.declaration ? 'export-declaration' : 'export-local' }),
          exportedOccurrence: tokenRecord(item.exportedToken, { kind: item.declaration ? 'export-declaration' : 'exported-name' }),
        });
        excludedRawIndices.add(item.localToken.rawIndex);
        excludedRawIndices.add(item.exportedToken.rawIndex);
        if (item.declaration) declarations.push({ name: item.local, kind: item.declarationKind, occurrence: tokenRecord(item.localToken, { kind: 'declaration' }) });
      }
      index = exportRecord.endIndex;
      continue;
    }
    if (DECLARATION.has(tokens[index]?.value) && tokens[index + 1]?.type === 'identifier') {
      const name = tokens[index + 1];
      declarations.push({ name: name.value, kind: tokens[index].value, occurrence: tokenRecord(name, { kind: 'declaration' }) });
      excludedRawIndices.add(name.rawIndex);
    }
  }

  const boundNames = new Set([...imports.map((item) => item.local), ...declarations.map((item) => item.name)]);
  const uses = tokens
    .filter((token, index) => token.type === 'identifier' && boundNames.has(token.value) && !excludedRawIndices.has(token.rawIndex) && !isPropertyPosition(tokens, index))
    .map((token) => tokenRecord(token, { kind: 'binding-use', binding: token.value }));

  const exportNames = new Set();
  for (const item of exports) {
    if (exportNames.has(item.exported)) throw new Error(`Duplicate or ambiguous export: ${item.exported} in ${file.path}`);
    exportNames.add(item.exported);
  }

  return {
    path: file.path,
    sourceSha256: file.sha256,
    imports,
    exports,
    declarations,
    uses,
  };
}

export function buildModuleSymbolGraph({ files, entrypoints = [] } = {}) {
  if (!Array.isArray(files) || files.length === 0) throw new TypeError('Module graph files are required');
  const normalized = files.map((file) => {
    const filePath = safePath(file?.path);
    const source = String(file?.source ?? '');
    const sha256 = String(file?.sha256 ?? '');
    if (!SHA256.test(sha256) || canonicalSha256(source) !== sha256) throw new Error(`Module source hash mismatch: ${filePath}`);
    return { path: filePath, source, sha256 };
  }).sort((a, b) => a.path.localeCompare(b.path));
  const seen = new Set();
  for (const file of normalized) {
    if (seen.has(file.path)) throw new Error(`Duplicate module path: ${file.path}`);
    seen.add(file.path);
  }
  const entries = [...new Set(entrypoints.map((value) => safePath(value, 'entrypoint')))].sort();
  for (const entry of entries) if (!seen.has(entry)) throw new Error(`Entrypoint module is missing: ${entry}`);

  const modules = normalized.map(parseModule);
  const byPath = new Map(modules.map((module) => [module.path, module]));
  const edges = [];
  for (const module of modules) {
    for (const item of module.imports) {
      const resolvedPath = resolveImport(module.path, item.source);
      if (!resolvedPath || !byPath.has(resolvedPath)) throw new Error(`Import source cannot resolve to a packaged module: ${module.path} -> ${item.source}`);
      const target = byPath.get(resolvedPath);
      const matches = target.exports.filter((entry) => entry.exported === item.imported);
      if (matches.length !== 1) throw new Error(`Imported symbol is missing or ambiguous: ${item.imported} from ${resolvedPath}`);
      item.resolvedPath = resolvedPath;
      item.targetLocal = matches[0].local;
      edges.push({ from: module.path, to: resolvedPath, imported: item.imported, local: item.local, targetLocal: matches[0].local });
    }
  }
  const base = {
    schema: 'nolane.small-model.module-symbol-graph.v1',
    entrypoints: entries,
    modules: modules.map((module) => ({
      ...module,
      imports: module.imports.map((item) => ({ ...item })),
    })),
    edges: edges.sort((a, b) => `${a.from}:${a.local}`.localeCompare(`${b.from}:${b.local}`)),
    hiddenChainOfThoughtStored: false,
    claims: { boundedJavaScriptModuleGraph: true, typeScriptSemanticCompiler: false, externalRepositoryGeneralization: false, generalCodingIntelligence: false },
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
