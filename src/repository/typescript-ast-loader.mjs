import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const compilerPath = path.join(root, 'third_party', 'typescript', 'lib', 'typescript.js');
const ts = require(compilerPath);

const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const PINNED_COMPILER_VERSION = '5.8.3';

export const SUPPORTED_AST_EXTENSIONS = Object.freeze(['.cjs', '.cts', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx']);

const SCRIPT_KIND_BY_EXTENSION = new Map([
  ['.js', ts.ScriptKind.JS],
  ['.mjs', ts.ScriptKind.JS],
  ['.cjs', ts.ScriptKind.JS],
  ['.jsx', ts.ScriptKind.JSX],
  ['.ts', ts.ScriptKind.TS],
  ['.mts', ts.ScriptKind.TS],
  ['.cts', ts.ScriptKind.TS],
  ['.tsx', ts.ScriptKind.TSX],
]);

function coded(code, message, details = {}) {
  return Object.assign(new Error(message), { code, ...details });
}

function normalizePath(value) {
  return String(value ?? '').trim().replaceAll('\\', '/').replace(/^\.\//, '');
}

function projectDiagnostics(sourceFile) {
  return Object.freeze((sourceFile.parseDiagnostics ?? []).map((diagnostic) => Object.freeze({
    code: Number(diagnostic.code),
    category: Number(diagnostic.category),
    start: Number(diagnostic.start ?? 0),
    length: Number(diagnostic.length ?? 0),
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  })));
}

export class TypeScriptAstLoader {
  constructor() {
    if (String(ts.version) !== PINNED_COMPILER_VERSION) {
      throw coded('AST_COMPILER_VERSION_MISMATCH', `Expected TypeScript ${PINNED_COMPILER_VERSION}, got ${ts.version}`);
    }
    this.compilerVersion = String(ts.version);
  }

  parse({ path: relativePath, source } = {}) {
    const filePath = normalizePath(relativePath);
    const extension = path.extname(filePath).toLowerCase();
    const scriptKind = SCRIPT_KIND_BY_EXTENSION.get(extension);
    if (scriptKind === undefined) throw coded('AST_EXTENSION_UNSUPPORTED', `Unsupported AST extension: ${extension || '(none)'}`);
    const text = String(source ?? '');
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes > MAX_SOURCE_BYTES) throw coded('AST_SOURCE_TOO_LARGE', `AST source exceeds ${MAX_SOURCE_BYTES} bytes`, { maxBytes: MAX_SOURCE_BYTES, actualBytes: bytes });
    if (text.includes('\0')) throw coded('AST_SOURCE_NUL_DENIED', 'AST source contains a NUL byte');
    const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, scriptKind);
    const diagnostics = projectDiagnostics(sourceFile);
    if (diagnostics.length) throw coded('AST_PARSE_FAILED', `AST parse failed for ${filePath}`, { diagnostics });
    return Object.freeze({
      compilerVersion: this.compilerVersion,
      scriptKind,
      sourceFile,
      diagnostics,
      compiler: ts,
    });
  }
}

const defaultLoader = new TypeScriptAstLoader();
export function parseAstSource(input) { return defaultLoader.parse(input); }
