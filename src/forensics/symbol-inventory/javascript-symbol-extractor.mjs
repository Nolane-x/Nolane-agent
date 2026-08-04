import { stableForensicId } from '../stable-id.mjs';

function lineAt(text, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) if (text.charCodeAt(cursor) === 10) line += 1;
  return line;
}

function maskStringsAndComments(source) {
  const output = [...source];
  let state = 'code';
  let quote = null;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (state === 'line-comment') {
      if (char === '\n') state = 'code';
      else output[index] = ' ';
      continue;
    }
    if (state === 'block-comment') {
      if (char === '*' && next === '/') { output[index] = output[index + 1] = ' '; index += 1; state = 'code'; }
      else if (char !== '\n') output[index] = ' ';
      continue;
    }
    if (state === 'string') {
      if (char === '\\') { output[index] = ' '; if (index + 1 < source.length && source[index + 1] !== '\n') output[index + 1] = ' '; index += 1; continue; }
      if (char === quote) { output[index] = ' '; state = 'code'; quote = null; }
      else if (char !== '\n') output[index] = ' ';
      continue;
    }
    if (char === '/' && next === '/') { output[index] = output[index + 1] = ' '; index += 1; state = 'line-comment'; continue; }
    if (char === '/' && next === '*') { output[index] = output[index + 1] = ' '; index += 1; state = 'block-comment'; continue; }
    if (char === '"' || char === "'" || char === '`') { output[index] = ' '; state = 'string'; quote = char; }
  }
  return output.join('');
}

function matchingBrace(masked, openingIndex) {
  if (openingIndex < 0 || masked[openingIndex] !== '{') return null;
  let depth = 0;
  for (let index = openingIndex; index < masked.length; index += 1) {
    if (masked[index] === '{') depth += 1;
    else if (masked[index] === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return null;
}

function depthBetween(masked, start, end) {
  let depth = 0;
  for (let index = start; index < end; index += 1) {
    if (masked[index] === '{') depth += 1;
    else if (masked[index] === '}') depth -= 1;
  }
  return depth;
}

function signatureFrom(source, start, openingBrace) {
  return source.slice(start, openingBrace >= 0 ? openingBrace : Math.min(source.length, start + 180)).replace(/\s+/g, ' ').trim().slice(0, 240);
}

function makeSymbol({ relativePath, fileSha256, kind, name, exported, start, end, source, openingBrace, parserMode }) {
  const startLine = lineAt(source, start);
  const endLine = lineAt(source, end ?? start);
  const identity = `${relativePath}:${kind}:${name}:${startLine}:${endLine}:${fileSha256}`;
  return Object.freeze({
    schema: 'nolane.forensics.symbol.v1',
    id: stableForensicId('symbol', identity),
    relativePath,
    fileSha256,
    language: 'javascript',
    parserMode,
    kind,
    name,
    exported: exported === true,
    signature: signatureFrom(source, start, openingBrace ?? -1),
    startLine,
    endLine,
  });
}

function collectPattern(source, relativePath, fileSha256, kind, pattern, transform, parserMode, symbols, seen) {
  for (const match of source.matchAll(pattern)) {
    const value = transform(match);
    const openingBrace = value.openingBrace ?? source.indexOf('{', match.index + match[0].length - 1);
    const closingBrace = openingBrace >= 0 ? matchingBrace(source, openingBrace) : null;
    const start = match.index;
    const end = closingBrace ?? (source.indexOf('\n', start) >= 0 ? source.indexOf('\n', start) : source.length - 1);
    const key = `${kind}:${value.name}:${start}`;
    if (seen.has(key)) continue;
    seen.add(key);
    symbols.push(makeSymbol({ relativePath, fileSha256, kind, name: value.name, exported: value.exported, start, end, source: value.originalSource, openingBrace, parserMode }));
  }
}

function surfaceRecord({ relativePath, fileSha256, kind, value, line, evidence }) {
  return Object.freeze({
    schema: 'nolane.forensics.surface.v1',
    id: stableForensicId('surface', `${relativePath}:${kind}:${value}:${line}`),
    relativePath,
    fileSha256,
    kind,
    value,
    line,
    evidence: evidence.replace(/\s+/g, ' ').trim().slice(0, 280),
  });
}

function addSurfaceMatches({ sourceText, relativePath, fileSha256, kind, pattern, valueOf, surfaces }) {
  for (const match of sourceText.matchAll(pattern)) {
    surfaces.push(surfaceRecord({ relativePath, fileSha256, kind, value: valueOf(match), line: lineAt(sourceText, match.index), evidence: match[0] }));
  }
}

export function extractJavaScriptSymbols({ sourceText, relativePath, fileSha256, parserMode = 'lexical-structural-v1' } = {}) {
  if (typeof sourceText !== 'string') throw new TypeError('sourceText is required');
  if (typeof relativePath !== 'string' || relativePath.length === 0) throw new TypeError('relativePath is required');
  if (!/^[a-f0-9]{64}$/.test(fileSha256 ?? '')) throw new TypeError('fileSha256 is required');
  const masked = maskStringsAndComments(sourceText);
  const symbols = [];
  const surfaces = [];
  const seen = new Set();

  collectPattern(masked, relativePath, fileSha256, 'function', /\b(export\s+)?(?:default\s+)?(async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g, (match) => ({ name: match[3], exported: Boolean(match[1]), originalSource: sourceText, openingBrace: match.index + match[0].lastIndexOf('{') }), parserMode, symbols, seen);
  collectPattern(masked, relativePath, fileSha256, 'function', /\b(export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*(\{)?/g, (match) => ({ name: match[2], exported: Boolean(match[1]), originalSource: sourceText, openingBrace: match[3] ? match.index + match[0].lastIndexOf('{') : -1 }), parserMode, symbols, seen);
  collectPattern(masked, relativePath, fileSha256, 'function', /\b(export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\s*\([^)]*\)\s*\{/g, (match) => ({ name: match[2], exported: Boolean(match[1]), originalSource: sourceText, openingBrace: match.index + match[0].lastIndexOf('{') }), parserMode, symbols, seen);

  const classPattern = /\b(export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)[^\{]*\{/g;
  for (const match of masked.matchAll(classPattern)) {
    const className = match[2];
    const openingBrace = match.index + match[0].lastIndexOf('{');
    const closingBrace = matchingBrace(masked, openingBrace) ?? openingBrace;
    symbols.push(makeSymbol({ relativePath, fileSha256, kind: 'class', name: className, exported: Boolean(match[1]), start: match.index, end: closingBrace, source: sourceText, openingBrace, parserMode }));
    const classBody = masked.slice(openingBrace + 1, closingBrace);
    const methodPattern = /(?:^|\n)\s*(?:static\s+)?(?:async\s+)?(?:get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g;
    for (const methodMatch of classBody.matchAll(methodPattern)) {
      const absoluteStart = openingBrace + 1 + methodMatch.index + methodMatch[0].search(/[A-Za-z_$]/);
      const absoluteOpening = openingBrace + 1 + methodMatch.index + methodMatch[0].lastIndexOf('{');
      if (depthBetween(masked, openingBrace, absoluteOpening) !== 1) continue;
      const absoluteClosing = matchingBrace(masked, absoluteOpening) ?? absoluteOpening;
      symbols.push(makeSymbol({ relativePath, fileSha256, kind: 'method', name: `${className}.${methodMatch[1]}`, exported: Boolean(match[1]), start: absoluteStart, end: absoluteClosing, source: sourceText, openingBrace: absoluteOpening, parserMode }));
    }
  }

  addSurfaceMatches({ sourceText, relativePath, fileSha256, kind: 'http-route', pattern: /\b(?:router|app|server|http)\s*\.\s*(get|post|put|patch|delete|head|options)\s*\(\s*['"`]([^'"`]+)['"`]/gi, valueOf: (match) => `${match[1].toUpperCase()} ${match[2]}`, surfaces });
  addSurfaceMatches({ sourceText, relativePath, fileSha256, kind: 'command', pattern: /\b(?:commands?|commandRegistry|registry)\s*\.\s*(?:register|registerCommand)\s*\(\s*['"`]([^'"`]+)['"`]/g, valueOf: (match) => match[1], surfaces });
  addSurfaceMatches({ sourceText, relativePath, fileSha256, kind: 'command', pattern: /\bregisterCommand\s*\(\s*['"`]([^'"`]+)['"`]/g, valueOf: (match) => match[1], surfaces });
  addSurfaceMatches({ sourceText, relativePath, fileSha256, kind: 'event', pattern: /\.\s*(?:on|once|emit)\s*\(\s*['"`]([^'"`]+)['"`]/g, valueOf: (match) => match[1], surfaces });
  addSurfaceMatches({ sourceText, relativePath, fileSha256, kind: 'configuration-key', pattern: /\bprocess\.env\.([A-Z][A-Z0-9_]*)\b/g, valueOf: (match) => match[1], surfaces });
  addSurfaceMatches({ sourceText, relativePath, fileSha256, kind: 'configuration-key', pattern: /\bprocess\.env\[['"`]([A-Z][A-Z0-9_]*)['"`]\]/g, valueOf: (match) => match[1], surfaces });
  addSurfaceMatches({ sourceText, relativePath, fileSha256, kind: 'schema', pattern: /\bschema\s*:\s*['"`]([^'"`]+)['"`]/g, valueOf: (match) => match[1], surfaces });
  addSurfaceMatches({ sourceText, relativePath, fileSha256, kind: 'ui-action', pattern: /\baddEventListener\s*\(\s*['"`](click|change|input|submit|keydown|keyup|pointerdown|pointerup)['"`]/g, valueOf: (match) => match[1], surfaces });
  addSurfaceMatches({ sourceText, relativePath, fileSha256, kind: 'ui-action', pattern: /\bdata-action\s*=\s*['"`]([^'"`]+)['"`]/g, valueOf: (match) => match[1], surfaces });

  symbols.sort((a, b) => a.id.localeCompare(b.id));
  surfaces.sort((a, b) => a.id.localeCompare(b.id));
  return Object.freeze({ parserMode, symbols: Object.freeze(symbols), surfaces: Object.freeze(surfaces) });
}
