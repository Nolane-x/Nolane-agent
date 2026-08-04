import { createHash } from 'node:crypto';
import path from 'node:path';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const DECLARATIONS = {
  javascript: [
    ['class', /^\s*(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)\b/],
    ['function', /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/],
    ['function', /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/],
    ['type', /^\s*(?:export\s+)?(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)\b/],
  ],
  typescript: [],
  python: [
    ['class', /^\s*class\s+([A-Za-z_$][\w$]*)\b/],
    ['function', /^\s*(?:async\s+)?def\s+([A-Za-z_$][\w$]*)\s*\(/],
  ],
  go: [
    ['type', /^\s*type\s+([A-Za-z_$][\w$]*)\s+(?:struct|interface)\b/],
    ['function', /^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_$][\w$]*)\s*\(/],
  ],
  rust: [
    ['type', /^\s*(?:pub\s+)?(?:struct|enum|trait)\s+([A-Za-z_$][\w$]*)\b/],
    ['function', /^\s*(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_$][\w$]*)\s*\(/],
  ],
};
DECLARATIONS.typescript = DECLARATIONS.javascript;

function languageFromPath(filePath) {
  const extension = path.extname(String(filePath)).toLowerCase();
  return ({ '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.mts': 'typescript', '.cts': 'typescript', '.tsx': 'typescript', '.py': 'python', '.go': 'go', '.rs': 'rust' })[extension] ?? 'text';
}

function braceEnd(lines, start) {
  let depth = 0;
  let opened = false;
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index].replace(/(['"`]).*?\1/g, '');
    for (const char of line) {
      if (char === '{') { depth += 1; opened = true; }
      if (char === '}') depth -= 1;
    }
    if (opened && depth <= 0) return index;
  }
  return start;
}

function pythonEnd(lines, start) {
  const indent = (lines[start].match(/^\s*/) ?? [''])[0].length;
  let end = start;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (!lines[index].trim()) { end = index; continue; }
    const current = (lines[index].match(/^\s*/) ?? [''])[0].length;
    if (current <= indent) break;
    end = index;
  }
  return end;
}

function sliceChunks({ filePath, language, lines, start, end, kind, symbol, maxChunkChars }) {
  const output = [];
  let cursor = start;
  while (cursor <= end) {
    let next = cursor;
    let chars = 0;
    while (next <= end) {
      const addition = lines[next].length + 1;
      if (next > cursor && chars + addition > maxChunkChars) break;
      chars += addition;
      next += 1;
    }
    const chunkEnd = Math.max(cursor, next - 1);
    const text = lines.slice(cursor, chunkEnd + 1).join('\n').trimEnd();
    if (text.trim()) {
      const startLine = cursor + 1;
      const endLine = chunkEnd + 1;
      const contentSha256 = sha256(text);
      output.push(Object.freeze({
        id: sha256(`${filePath}\0${startLine}\0${endLine}\0${contentSha256}`),
        path: filePath,
        language,
        kind,
        symbol,
        startLine,
        endLine,
        text,
        sha256: contentSha256,
      }));
    }
    cursor = chunkEnd + 1;
  }
  return output;
}

export class SyntaxChunker {
  constructor({ maxChunkChars = 8_000 } = {}) {
    this.maxChunkChars = Math.max(256, Number(maxChunkChars) || 8_000);
  }

  chunk({ path: filePath, language = null, content } = {}) {
    const normalizedPath = String(filePath ?? '').replaceAll('\\', '/');
    const selectedLanguage = language ?? languageFromPath(normalizedPath);
    const lines = String(content ?? '').split(/\r?\n/);
    const patterns = DECLARATIONS[selectedLanguage] ?? [];
    const declarations = [];
    for (let index = 0; index < lines.length; index += 1) {
      for (const [kind, regex] of patterns) {
        const match = lines[index].match(regex);
        if (!match) continue;
        const end = selectedLanguage === 'python' ? pythonEnd(lines, index) : braceEnd(lines, index);
        declarations.push({ start: index, end: Math.max(index, end), kind, symbol: match[1] });
        index = Math.max(index, end);
        break;
      }
    }
    const output = [];
    let cursor = 0;
    for (const declaration of declarations) {
      if (cursor < declaration.start) output.push(...sliceChunks({ filePath: normalizedPath, language: selectedLanguage, lines, start: cursor, end: declaration.start - 1, kind: 'module', symbol: null, maxChunkChars: this.maxChunkChars }));
      output.push(...sliceChunks({ filePath: normalizedPath, language: selectedLanguage, lines, ...declaration, maxChunkChars: this.maxChunkChars }));
      cursor = declaration.end + 1;
    }
    if (cursor < lines.length) output.push(...sliceChunks({ filePath: normalizedPath, language: selectedLanguage, lines, start: cursor, end: lines.length - 1, kind: 'module', symbol: null, maxChunkChars: this.maxChunkChars }));
    return Object.freeze(output);
  }
}
