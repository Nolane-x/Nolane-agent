import { canonicalSha256, deepFreeze } from './shared.mjs';

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const OPEN = new Map([['(', ')'], ['[', ']'], ['{', '}']]);
const CLOSE = new Map([[')', '('], [']', '['], ['}', '{']]);

function tokenize(source) {
  const tokens = [];
  const stack = [];
  let index = 0;
  let scopeDepth = 0;
  const push = (type, start, end, extra = {}) => tokens.push({ type, value: source.slice(start, end), start, end, braceDepth: scopeDepth, ...extra });
  const previousCodeToken = () => {
    for (let cursor = tokens.length - 1; cursor >= 0; cursor -= 1) {
      if (!['whitespace', 'comment'].includes(tokens[cursor].type)) return tokens[cursor];
    }
    return null;
  };

  while (index < source.length) {
    const start = index;
    const char = source[index];
    const next = source[index + 1];
    if (/\s/.test(char)) {
      index += 1;
      while (index < source.length && /\s/.test(source[index])) index += 1;
      push('whitespace', start, index);
      continue;
    }
    if (char === '/' && next === '/') {
      index += 2;
      while (index < source.length && source[index] !== '\n') index += 1;
      push('comment', start, index);
      continue;
    }
    if (char === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index += 1;
      if (index >= source.length) throw new SyntaxError('Unterminated block comment');
      index += 2;
      push('comment', start, index);
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      const quote = char;
      index += 1;
      let escaped = false;
      while (index < source.length) {
        const current = source[index];
        if (escaped) escaped = false;
        else if (current === '\\') escaped = true;
        else if (current === quote) { index += 1; break; }
        index += 1;
      }
      if (source[index - 1] !== quote) throw new SyntaxError('Unterminated string or template literal');
      push(quote === '`' ? 'template' : 'string', start, index, { quote, content: source.slice(start + 1, index - 1) });
      continue;
    }
    if (/[A-Za-z_$]/.test(char)) {
      index += 1;
      while (index < source.length && /[A-Za-z0-9_$]/.test(source[index])) index += 1;
      push('identifier', start, index);
      continue;
    }
    if (/[0-9]/.test(char)) {
      index += 1;
      while (index < source.length && /[A-Za-z0-9._]/.test(source[index])) index += 1;
      push('number', start, index);
      continue;
    }
    if (OPEN.has(char)) {
      const previous = previousCodeToken();
      const scopeBrace = char === '{' && (previous?.value === ')' || previous?.value === 'else' || previous?.value === 'try' || previous?.value === 'finally' || previous?.value === 'do' || previous?.value === '=>');
      stack.push({ char, scopeBrace });
      push('punctuator', start, start + 1);
      if (scopeBrace) scopeDepth += 1;
      index += 1;
      continue;
    }
    if (CLOSE.has(char)) {
      const expected = CLOSE.get(char);
      const opened = stack.pop();
      if (opened?.char !== expected) throw new SyntaxError(`Unbalanced JavaScript delimiter: ${char}`);
      if (opened.scopeBrace) scopeDepth = Math.max(0, scopeDepth - 1);
      push('punctuator', start, start + 1);
      index += 1;
      continue;
    }
    index += 1;
    push('punctuator', start, index);
  }
  if (stack.length > 0) throw new SyntaxError(`Unbalanced JavaScript delimiter: ${stack.at(-1).char}`);
  return tokens;
}

function previousSignificant(tokens, index) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (!['whitespace', 'comment'].includes(tokens[cursor].type)) return tokens[cursor];
  }
  return null;
}

function isModuleSource(tokens, index) {
  const previous = previousSignificant(tokens, index);
  if (previous?.type === 'identifier' && previous.value === 'from') return true;
  if (!previous || previous.value === ';' || previous.value === '}') return false;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const token = tokens[cursor];
    if (token.type === 'comment' || token.type === 'whitespace') continue;
    if (token.value === ';' || token.value === '{' || token.value === '}') break;
    if (token.type === 'identifier' && token.value === 'import') return true;
  }
  return false;
}

function validateOperation(operation) {
  if (!operation?.op) throw new TypeError('Codemod operation is required');
  if (operation.op === 'rename-identifier') {
    if (!IDENTIFIER.test(String(operation.from ?? '')) || !IDENTIFIER.test(String(operation.to ?? ''))) throw new TypeError('Valid JavaScript identifier names are required');
    if (!['program', 'all'].includes(operation.scope ?? 'program')) throw new TypeError('Identifier scope must be program or all');
  } else if (operation.op === 'rewrite-import-source') {
    if (!String(operation.from ?? '') || !String(operation.to ?? '')) throw new TypeError('Import source values are required');
    if (/['"`\r\n]/.test(String(operation.to))) throw new TypeError('Import source contains unsafe characters');
  } else throw new TypeError(`Unsupported codemod operation: ${operation.op}`);
}

export class AstCodemodEngine {
  parse({ language = 'javascript', source } = {}) {
    if (!['javascript', 'js', 'mjs', 'cjs'].includes(String(language).toLowerCase())) throw new TypeError('Only JavaScript codemods are supported');
    if (typeof source !== 'string') throw new TypeError('Codemod source must be text');
    const tokens = tokenize(source);
    const base = {
      schema: 'nolane.small-model.lossless-js-token-tree.v1',
      language: 'javascript',
      valid: true,
      tokenCount: tokens.length,
      codeTokenCount: tokens.filter((token) => !['whitespace', 'comment', 'string', 'template'].includes(token.type)).length,
      sourceSha256: canonicalSha256(source),
    };
    return { ...base, tokens };
  }

  apply({ language = 'javascript', source, operations } = {}) {
    if (!Array.isArray(operations) || operations.length === 0) throw new TypeError('At least one codemod operation is required');
    operations.forEach(validateOperation);
    const parsed = this.parse({ language, source });
    const replacements = new Map();
    let changedTokens = 0;

    for (const operation of operations) {
      if (operation.op === 'rename-identifier') {
        const matches = parsed.tokens.map((token, index) => ({ token, index })).filter(({ token }) => token.type === 'identifier' && token.value === operation.from);
        if ((operation.scope ?? 'program') === 'all') {
          const depths = new Set(matches.map(({ token }) => token.braceDepth));
          if (depths.size > 1) throw new Error(`Identifier ${operation.from} is shadowed or ambiguous across scopes`);
        }
        for (const { token, index } of matches) {
          if ((operation.scope ?? 'program') === 'program' && token.braceDepth !== 0) continue;
          replacements.set(index, String(operation.to));
          changedTokens += 1;
        }
      } else if (operation.op === 'rewrite-import-source') {
        parsed.tokens.forEach((token, index) => {
          if (token.type !== 'string' || token.content !== operation.from || !isModuleSource(parsed.tokens, index)) return;
          replacements.set(index, `${token.quote}${operation.to}${token.quote}`);
          changedTokens += 1;
        });
      }
    }

    const output = parsed.tokens.map((token, index) => replacements.get(index) ?? token.value).join('');
    const reparsed = this.parse({ language, source: output });
    const base = {
      schema: 'nolane.small-model.ast-codemod-receipt.v1',
      language: 'javascript',
      inputSha256: canonicalSha256(source),
      outputSha256: canonicalSha256(output),
      operations: operations.map((operation) => ({ ...operation })),
      changedTokens,
      parse: { valid: reparsed.valid, tokenCount: reparsed.tokenCount, codeTokenCount: reparsed.codeTokenCount },
      output,
      soundnessScope: ['javascript lexical tokens', 'balanced delimiters', 'program-depth identifier rewrite', 'ES module source literals'],
      knownIncompleteness: ['template-expression identifiers are intentionally not rewritten', 'full ECMAScript semantic binding analysis is not claimed'],
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
