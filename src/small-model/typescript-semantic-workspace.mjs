import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalSha256, deepFreeze } from './shared.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ts = require(path.join(root, 'third_party/typescript/lib/typescript.js'));
const PINNED = '5.8.3';
const PROJECT = '/nolane-project';
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function safePath(value) {
  const text = String(value ?? '').trim().replaceAll('\\', '/').replace(/^\.\//, '');
  if (!text || path.posix.isAbsolute(text) || text.split('/').includes('..') || !/\.(?:ts|tsx|mts|cts)$/.test(text)) throw new Error('TypeScript workspace path traversal or unsupported extension is forbidden');
  return path.posix.normalize(text);
}
function flatten(diag) { return ts.flattenDiagnosticMessageText(diag.messageText, '\n'); }
function projectPath(relative) { return path.posix.join(PROJECT, relative); }
function relativePath(absolute) { return path.posix.relative(PROJECT, absolute); }

export class TypeScriptSemanticWorkspace {
  constructor({ files } = {}) {
    if (String(ts.version) !== PINNED) throw new Error(`Expected TypeScript ${PINNED}, got ${ts.version}`);
    if (!Array.isArray(files) || files.length < 1) throw new Error('TypeScript workspace files are required');
    this.files = new Map();
    for (const entry of files) {
      const filePath = safePath(entry?.path);
      if (this.files.has(filePath)) throw new Error(`Duplicate TypeScript workspace file: ${filePath}`);
      const source = String(entry?.source ?? '');
      if (canonicalSha256(source) !== String(entry?.sha256 ?? '')) throw new Error(`TypeScript workspace source hash mismatch: ${filePath}`);
      this.files.set(filePath, source);
    }
    const internalLib = `interface Array<T>{length:number;[n:number]:T}\ninterface String{}\ninterface Number{}\ninterface Boolean{}\ninterface Object{}\ninterface Function{}\ninterface CallableFunction extends Function{}\ninterface NewableFunction extends Function{}\ninterface IArguments{}\ninterface RegExp{}\n`;
    this.virtual = new Map([...this.files].map(([name, source]) => [projectPath(name), source]));
    this.virtual.set(projectPath('__nolane_lib.d.ts'), internalLib);
    const options = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, noLib: true, allowJs: false, skipLibCheck: true };
    const host = {
      getCompilationSettings: () => options,
      getScriptFileNames: () => [...this.virtual.keys()],
      getScriptVersion: () => '1',
      getScriptSnapshot: (fileName) => this.virtual.has(fileName) ? ts.ScriptSnapshot.fromString(this.virtual.get(fileName)) : undefined,
      getCurrentDirectory: () => PROJECT,
      getDefaultLibFileName: () => projectPath('__nolane_lib.d.ts'),
      fileExists: (fileName) => this.virtual.has(fileName),
      readFile: (fileName) => this.virtual.get(fileName),
      readDirectory: () => [...this.virtual.keys()],
      directoryExists: (dir) => dir === PROJECT || [...this.virtual.keys()].some((file) => file.startsWith(`${dir}/`)),
      getDirectories: () => [],
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
      resolveModuleNames: (names, containingFile) => names.map((specifier) => {
        if (!specifier.startsWith('.')) return undefined;
        const raw = path.posix.normalize(path.posix.join(path.posix.dirname(containingFile), specifier));
        const candidates = [raw, `${raw}.ts`, `${raw}.tsx`, path.posix.join(raw, 'index.ts')];
        const resolvedFileName = candidates.find((candidate) => this.virtual.has(candidate));
        return resolvedFileName ? { resolvedFileName, extension: resolvedFileName.endsWith('.tsx') ? ts.Extension.Tsx : ts.Extension.Ts } : undefined;
      }),
    };
    this.service = ts.createLanguageService(host, ts.createDocumentRegistry(true, PROJECT));
    const diagnostics = [];
    for (const fileName of [...this.virtual.keys()].filter((name) => !name.endsWith('.d.ts'))) {
      diagnostics.push(...this.service.getSyntacticDiagnostics(fileName), ...this.service.getSemanticDiagnostics(fileName));
    }
    this.diagnostics = diagnostics.map((diag) => ({ code: diag.code, path: diag.file ? relativePath(diag.file.fileName) : null, start: diag.start ?? 0, message: flatten(diag) }));
    if (this.diagnostics.length) throw Object.assign(new Error('TypeScript semantic diagnostics are not empty'), { diagnostics: this.diagnostics });
  }

  findInterfaceDeclaration({ path: targetPath, name } = {}) {
    const filePath = safePath(targetPath);
    const identifier = String(name ?? '');
    if (!IDENTIFIER.test(identifier)) throw new Error('TypeScript target identifier is invalid');
    const source = this.files.get(filePath);
    if (source === undefined) throw new Error('TypeScript target file is missing');
    const sf = this.service.getProgram()?.getSourceFile(projectPath(filePath));
    let result = null;
    const visit = (node) => {
      if (ts.isInterfaceDeclaration(node) && node.name?.text === identifier) result = { path: filePath, start: node.name.getStart(sf), length: node.name.getWidth(sf) };
      ts.forEachChild(node, visit);
    };
    if (sf) visit(sf);
    if (!result) throw new Error('TypeScript refactor target identifier is missing or is not a supported interface declaration');
    return result;
  }

  findRenameLocations({ path: targetPath, name } = {}) {
    const declaration = this.findInterfaceDeclaration({ path: targetPath, name });
    const queue = [{ fileName: projectPath(declaration.path), position: declaration.start }];
    const seenQueries = new Set();
    const locations = new Map();
    while (queue.length) {
      const query = queue.shift();
      const key = `${query.fileName}:${query.position}`;
      if (seenQueries.has(key)) continue;
      seenQueries.add(key);
      const info = this.service.getRenameInfo(query.fileName, query.position, { allowRenameOfImportPath: false });
      if (!info.canRename) throw new Error(`TypeScript symbol cannot be renamed: ${info.localizedErrorMessage ?? 'unknown reason'}`);
      const found = this.service.findRenameLocations(query.fileName, query.position, false, false, true) ?? [];
      for (const location of found) {
        if (!location.fileName.startsWith(`${PROJECT}/`) || location.fileName.endsWith('.d.ts')) continue;
        const rel = relativePath(location.fileName);
        if (!this.files.has(rel)) continue;
        const locKey = `${rel}:${location.textSpan.start}:${location.textSpan.length}`;
        locations.set(locKey, { path: rel, start: location.textSpan.start, length: location.textSpan.length });
        queue.push({ fileName: location.fileName, position: location.textSpan.start });
      }
    }
    const sorted = [...locations.values()].sort((a, b) => a.path.localeCompare(b.path) || a.start - b.start);
    if (!sorted.length) throw new Error('TypeScript rename locations are empty');
    return deepFreeze(sorted);
  }

  snapshot() {
    const base = { schema: 'nolane.small-model.typescript-semantic-workspace.v1', compilerVersion: PINNED, files: [...this.files].map(([path, source]) => ({ path, sha256: canonicalSha256(source) })), diagnostics: this.diagnostics };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
