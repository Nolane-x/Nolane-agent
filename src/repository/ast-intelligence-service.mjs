import { randomUUID } from 'node:crypto';
import { chmod, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { WorkspacePolicy } from '../security/path-policy.mjs';
import { parseAstSource } from './typescript-ast-loader.mjs';

const MAX_LIMIT = 200;
const MAX_PREVIEW = 1_200;
const MAX_REPLACEMENT_BYTES = 256 * 1024;
const GENERATED = /(?:^|\/)(?:generated|dist|build|coverage|node_modules)(?:\/|$)|\.generated\./i;

function coded(code, message, statusCode = 400, details = {}) {
  return Object.assign(new Error(message), { code, statusCode, ...details });
}

function normalizeRelative(value) {
  return String(value ?? '').trim().replaceAll('\\', '/').replace(/^\.\//, '');
}

function boundedLimit(value) {
  const limit = value == null || value === '' ? 50 : Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw coded('AST_LIMIT_INVALID', `AST query limit must be an integer from 1 to ${MAX_LIMIT}`);
  return limit;
}

function normalizedOptional(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function kindName(compiler, node) {
  return String(compiler.SyntaxKind[node.kind] ?? `SyntaxKind${node.kind}`);
}

function resolveKind(compiler, value, requiredCode = 'AST_NODE_TYPE_REQUIRED') {
  const requested = String(value ?? '').trim();
  if (!requested) throw coded(requiredCode, 'AST nodeType is required');
  const target = requested.toLowerCase();
  for (const [name, numeric] of Object.entries(compiler.SyntaxKind)) {
    if (typeof numeric === 'number' && name.toLowerCase() === target) return Object.freeze({ name, numeric });
  }
  throw coded('AST_NODE_TYPE_UNKNOWN', `Unknown AST node type: ${requested}`);
}

function optionalKind(compiler, value) {
  const requested = normalizedOptional(value);
  if (!requested) return null;
  const target = requested.toLowerCase();
  for (const [name, numeric] of Object.entries(compiler.SyntaxKind)) {
    if (typeof numeric === 'number' && name.toLowerCase() === target) return Object.freeze({ name, numeric });
  }
  throw coded('AST_ANCESTOR_TYPE_UNKNOWN', `Unknown AST ancestor type: ${requested}`);
}

function nodeName(node, sourceFile) {
  const candidate = node?.name;
  if (!candidate) return null;
  if (typeof candidate.text === 'string') return candidate.text;
  try {
    const text = candidate.getText(sourceFile).trim();
    return text || null;
  } catch {
    return null;
  }
}

function hasAncestor(node, ancestorNumeric) {
  if (ancestorNumeric == null) return true;
  let cursor = node.parent;
  while (cursor) {
    if (cursor.kind === ancestorNumeric) return true;
    cursor = cursor.parent;
  }
  return false;
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function normalizeReplacement(value, lineEnding) {
  const replacement = String(value ?? '');
  const bytes = Buffer.byteLength(replacement, 'utf8');
  if (bytes > MAX_REPLACEMENT_BYTES) throw coded('AST_REPLACEMENT_TOO_LARGE', `AST replacement exceeds ${MAX_REPLACEMENT_BYTES} bytes`);
  if (replacement.includes('\0')) throw coded('AST_REPLACEMENT_NUL_DENIED', 'AST replacement contains a NUL byte');
  return replacement.replaceAll('\r\n', '\n').replaceAll('\r', '\n').replaceAll('\n', lineEnding);
}

function countLines(value) {
  if (!value) return 0;
  return String(value).split(/\r?\n/).length;
}

export class AstIntelligenceService {
  constructor({ workspaceRoot, allowedPaths = ['**'], deniedPaths = [] } = {}) {
    if (!workspaceRoot) throw new TypeError('workspaceRoot is required');
    this.policy = new WorkspacePolicy(workspaceRoot, { allowedPaths, deniedPaths });
  }

  async #load(relativePath) {
    const requested = normalizeRelative(relativePath);
    if (!requested) throw coded('AST_PATH_REQUIRED', 'AST path is required');
    const absolutePath = await this.policy.resolveRead(requested);
    const [source, metadata] = await Promise.all([readFile(absolutePath, 'utf8'), stat(absolutePath)]);
    const parsed = parseAstSource({ path: requested, source });
    return Object.freeze({
      path: requested,
      absolutePath,
      source,
      sourceSha256: canonicalSha256(source),
      mode: metadata.mode,
      ...parsed,
    });
  }

  #selectors(compiler, input) {
    const nodeType = resolveKind(compiler, input.nodeType);
    const ancestorType = optionalKind(compiler, input.ancestorType);
    const name = normalizedOptional(input.name);
    const textContains = normalizedOptional(input.textContains);
    return Object.freeze({ nodeType, ancestorType, name, textContains, limit: boundedLimit(input.limit) });
  }

  #matches(loaded, selectors) {
    const items = [];
    const visit = (node) => {
      if (items.length >= selectors.limit) return;
      if (node.kind === selectors.nodeType.numeric && hasAncestor(node, selectors.ancestorType?.numeric)) {
        const startOffset = node.getStart(loaded.sourceFile, false);
        const endOffset = node.getEnd();
        const content = loaded.source.slice(startOffset, endOffset);
        const name = nodeName(node, loaded.sourceFile);
        const nameMatches = selectors.name == null || name === selectors.name;
        const textMatches = selectors.textContains == null || content.toLowerCase().includes(selectors.textContains.toLowerCase());
        if (nameMatches && textMatches) {
          const start = loaded.sourceFile.getLineAndCharacterOfPosition(startOffset);
          const end = loaded.sourceFile.getLineAndCharacterOfPosition(endOffset);
          items.push(Object.freeze({
            path: loaded.path,
            nodeType: kindName(loaded.compiler, node),
            name,
            startOffset,
            endOffset,
            startLine: start.line + 1,
            startColumn: start.character + 1,
            endLine: end.line + 1,
            endColumn: end.character + 1,
            preview: content.slice(0, MAX_PREVIEW),
            nodeSha256: canonicalSha256(content),
          }));
        }
      }
      loaded.compiler.forEachChild(node, visit);
    };
    visit(loaded.sourceFile);
    return Object.freeze(items);
  }

  async query(input = {}) {
    const loaded = await this.#load(input.path);
    const selectors = this.#selectors(loaded.compiler, input);
    const items = this.#matches(loaded, selectors);
    const base = {
      schema: 'forge.ast-query.v1',
      path: loaded.path,
      compiler: `typescript@${loaded.compilerVersion}`,
      selectors: {
        nodeType: selectors.nodeType.name,
        ancestorType: selectors.ancestorType?.name ?? null,
        name: selectors.name,
        textContains: selectors.textContains,
        limit: selectors.limit,
      },
      sourceSha256: loaded.sourceSha256,
      matched: items.length,
      items,
    };
    return freezeDeep({ ...base, receiptSha256: canonicalSha256(base) });
  }

  async patch(input = {}) {
    const expectedSha256 = String(input.expectedSha256 ?? '').trim();
    if (!/^[a-f0-9]{64}$/i.test(expectedSha256)) throw coded('AST_EXPECTED_SHA256_REQUIRED', 'AST patch requires expectedSha256');
    const loaded = await this.#load(input.path);
    if (GENERATED.test(loaded.path)) throw coded('AST_GENERATED_CODE_DENIED', `Generated code cannot be AST patched: ${loaded.path}`);
    if (loaded.sourceSha256 !== expectedSha256) throw coded('AST_STALE_FILE', `AST file hash mismatch: expected ${expectedSha256}, got ${loaded.sourceSha256}`, 409);

    const selectors = this.#selectors(loaded.compiler, { ...input, limit: 2 });
    const matches = this.#matches(loaded, selectors);
    if (matches.length === 0) throw coded('AST_NODE_NOT_FOUND', 'AST selector matched no nodes', 404);
    if (matches.length !== 1) throw coded('AST_NODE_AMBIGUOUS', `AST selector matched ${matches.length} nodes`, 409);
    const match = matches[0];
    const expectedNodeSha256 = normalizedOptional(input.expectedNodeSha256);
    if (expectedNodeSha256 && expectedNodeSha256 !== match.nodeSha256) throw coded('AST_STALE_NODE', `AST node hash mismatch: expected ${expectedNodeSha256}, got ${match.nodeSha256}`, 409);

    const lineEnding = loaded.source.includes('\r\n') ? '\r\n' : '\n';
    const replacement = normalizeReplacement(input.replacement, lineEnding);
    const beforeNode = loaded.source.slice(match.startOffset, match.endOffset);
    const after = loaded.source.slice(0, match.startOffset) + replacement + loaded.source.slice(match.endOffset);
    parseAstSource({ path: loaded.path, source: after });

    const base = {
      schema: 'forge.ast-patch.v1',
      path: loaded.path,
      compiler: `typescript@${loaded.compilerVersion}`,
      nodeType: match.nodeType,
      name: match.name,
      startOffset: match.startOffset,
      endOffset: match.endOffset,
      beforeSha256: loaded.sourceSha256,
      afterSha256: canonicalSha256(after),
      nodeSha256: match.nodeSha256,
      replacementSha256: canonicalSha256(replacement),
      changedLines: Math.max(countLines(beforeNode), countLines(replacement)),
      dryRun: input.dryRun === true,
      applied: input.dryRun !== true,
      preview: Object.freeze({ before: beforeNode.slice(0, MAX_PREVIEW), after: replacement.slice(0, MAX_PREVIEW) }),
    };

    if (input.dryRun !== true) {
      const destination = await this.policy.resolveWrite(loaded.path);
      const temporary = path.join(path.dirname(destination), `.${path.basename(destination)}.${process.pid}.${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, after, { flag: 'wx', mode: loaded.mode });
        await chmod(temporary, loaded.mode);
        await rename(temporary, destination);
      } finally {
        await rm(temporary, { force: true }).catch(() => {});
      }
    }

    return freezeDeep({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
