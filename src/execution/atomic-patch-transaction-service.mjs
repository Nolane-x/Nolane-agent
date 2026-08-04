import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmod, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { WorkspacePolicy } from '../security/path-policy.mjs';
import { applyUnifiedPatch, parseUnifiedPatch } from './unified-patch.mjs';

const GENERATED_PATH = /(?:^|\/)(?:dist|build|generated|gen|coverage|vendor|node_modules|\.next)(?:\/|$)|(?:\.generated\.|\.g\.)/i;
const GENERATED_HEADER = /@generated|auto[- ]generated|generated file|do not edit/i;
const PROTECTED_COMMENT = /(?:KEEP\s*:|DO NOT REMOVE|@important|eslint-disable|@ts-ignore|@ts-expect-error|copyright|license)/i;
const CONFLICT_START = /^<<<<<<<(?:\s|$)/;
const CONFLICT_MIDDLE = /^=======$/;
const CONFLICT_END = /^>>>>>>>(?:\s|$)/;

function bounded(value, fallback, min, max, label) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new TypeError(`${label} must be between ${min} and ${max}`);
  return number;
}

function freeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freeze(child, seen);
  return Object.freeze(value);
}

function protectedComments(content) {
  return String(content).replaceAll('\r\n', '\n').split('\n').map((line) => line.trim()).filter((line) => PROTECTED_COMMENT.test(line));
}

function assertProtectedComments(before, after, relativePath) {
  const finalLines = new Set(String(after).replaceAll('\r\n', '\n').split('\n').map((line) => line.trim()));
  for (const comment of protectedComments(before)) {
    if (!finalLines.has(comment)) throw new Error(`Protected comment removed from ${relativePath}: ${comment.slice(0, 120)}`);
  }
}

function assertNotGenerated(relativePath, content) {
  if (GENERATED_PATH.test(relativePath) || GENERATED_HEADER.test(String(content).split(/\r?\n/).slice(0, 12).join('\n'))) {
    throw new Error(`Generated code cannot be patched: ${relativePath}`);
  }
}

export function analyzeConflictMarkers(content) {
  const lines = String(content ?? '').replaceAll('\r\n', '\n').split('\n');
  let state = 'outside'; let count = 0; let markerLines = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (CONFLICT_START.test(line)) {
      markerLines += 1;
      if (state !== 'outside') return freeze({ valid: false, count, markerLines, errorLine: index + 1 });
      state = 'ours'; count += 1; continue;
    }
    if (CONFLICT_MIDDLE.test(line)) {
      markerLines += 1;
      if (state !== 'ours') return freeze({ valid: false, count, markerLines, errorLine: index + 1 });
      state = 'theirs'; continue;
    }
    if (CONFLICT_END.test(line)) {
      markerLines += 1;
      if (state !== 'theirs') return freeze({ valid: false, count, markerLines, errorLine: index + 1 });
      state = 'outside'; continue;
    }
  }
  return freeze({ valid: state === 'outside', count, markerLines, errorLine: state === 'outside' ? null : lines.length });
}

function assertConflictPolicy(before, after, policy, relativePath) {
  const beforeState = analyzeConflictMarkers(before);
  const afterState = analyzeConflictMarkers(after);
  if (!beforeState.valid || !afterState.valid) throw new Error(`Malformed conflict markers in ${relativePath}`);
  if (policy === 'reject') {
    if (afterState.count > 0) throw new Error(`Conflict markers are not allowed in ${relativePath}`);
  } else if (policy === 'preserve') {
    if (afterState.count > beforeState.count) throw new Error(`New conflict markers are not allowed in ${relativePath}`);
  } else if (policy === 'resolve') {
    if (beforeState.count < 1) throw new Error(`Conflict resolution requires pre-existing conflict markers in ${relativePath}`);
    if (afterState.count > 0) throw new Error(`Conflict markers remain unresolved in ${relativePath}`);
  } else throw new TypeError('conflictPolicy must be reject, preserve, or resolve');
  return { beforeState, afterState };
}

function splitDocument(value) {
  const text = String(value ?? '').replaceAll('\r\n', '\n');
  const trailing = text.endsWith('\n');
  const lines = text.split('\n');
  if (trailing) lines.pop();
  return { lines, trailing };
}

function fallbackOperations(beforeLines, afterLines) {
  let prefix = 0;
  while (prefix < beforeLines.length && prefix < afterLines.length && beforeLines[prefix] === afterLines[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < beforeLines.length - prefix && suffix < afterLines.length - prefix && beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]) suffix += 1;
  const operations = [];
  for (let i = 0; i < prefix; i += 1) operations.push({ type: 'equal', line: beforeLines[i] });
  for (let i = prefix; i < beforeLines.length - suffix; i += 1) operations.push({ type: 'delete', line: beforeLines[i] });
  for (let i = prefix; i < afterLines.length - suffix; i += 1) operations.push({ type: 'insert', line: afterLines[i] });
  for (let i = beforeLines.length - suffix; i < beforeLines.length; i += 1) operations.push({ type: 'equal', line: beforeLines[i] });
  return operations;
}

function diffOperations(beforeLines, afterLines) {
  const cells = (beforeLines.length + 1) * (afterLines.length + 1);
  if (cells > 4_000_000) return fallbackOperations(beforeLines, afterLines);
  const rows = Array.from({ length: beforeLines.length + 1 }, () => new Uint32Array(afterLines.length + 1));
  for (let i = beforeLines.length - 1; i >= 0; i -= 1) {
    for (let j = afterLines.length - 1; j >= 0; j -= 1) {
      rows[i][j] = beforeLines[i] === afterLines[j] ? rows[i + 1][j + 1] + 1 : Math.max(rows[i + 1][j], rows[i][j + 1]);
    }
  }
  const operations = []; let i = 0; let j = 0;
  while (i < beforeLines.length && j < afterLines.length) {
    if (beforeLines[i] === afterLines[j]) { operations.push({ type: 'equal', line: beforeLines[i] }); i += 1; j += 1; }
    else if (rows[i + 1][j] >= rows[i][j + 1]) { operations.push({ type: 'delete', line: beforeLines[i] }); i += 1; }
    else { operations.push({ type: 'insert', line: afterLines[j] }); j += 1; }
  }
  while (i < beforeLines.length) { operations.push({ type: 'delete', line: beforeLines[i] }); i += 1; }
  while (j < afterLines.length) { operations.push({ type: 'insert', line: afterLines[j] }); j += 1; }
  return operations;
}

export function createMinimalUnifiedPatch(before, after, relativePath, { contextLines = 3 } = {}) {
  const beforeDoc = splitDocument(before); const afterDoc = splitDocument(after);
  const operations = diffOperations(beforeDoc.lines, afterDoc.lines);
  const changeIndexes = operations.map((operation, index) => operation.type === 'equal' ? -1 : index).filter((index) => index >= 0);
  if (!changeIndexes.length) return freeze({ patch: '', hunks: 0, additions: 0, deletions: 0, changedLines: 0, contextLines: 0, bytes: 0 });
  const oldAt = new Uint32Array(operations.length + 1); const newAt = new Uint32Array(operations.length + 1);
  for (let index = 0; index < operations.length; index += 1) {
    oldAt[index + 1] = oldAt[index] + (operations[index].type === 'insert' ? 0 : 1);
    newAt[index + 1] = newAt[index] + (operations[index].type === 'delete' ? 0 : 1);
  }
  const windows = [];
  for (const changeIndex of changeIndexes) {
    const start = Math.max(0, changeIndex - contextLines); const end = Math.min(operations.length, changeIndex + contextLines + 1);
    const previous = windows.at(-1);
    if (previous && start <= previous.end) previous.end = Math.max(previous.end, end); else windows.push({ start, end });
  }
  const body = []; let additions = 0; let deletions = 0; let contexts = 0;
  for (const window of windows) {
    const slice = operations.slice(window.start, window.end);
    const oldCount = slice.filter((operation) => operation.type !== 'insert').length;
    const newCount = slice.filter((operation) => operation.type !== 'delete').length;
    body.push(`@@ -${oldAt[window.start] + 1},${oldCount} +${newAt[window.start] + 1},${newCount} @@`);
    for (const operation of slice) {
      if (operation.type === 'insert') { body.push(`+${operation.line}`); additions += 1; }
      else if (operation.type === 'delete') { body.push(`-${operation.line}`); deletions += 1; }
      else { body.push(` ${operation.line}`); contexts += 1; }
    }
  }
  const patch = `--- a/${relativePath}\n+++ b/${relativePath}\n${body.join('\n')}\n`;
  return freeze({ patch, hunks: windows.length, additions, deletions, changedLines: additions + deletions, contextLines: contexts, bytes: Buffer.byteLength(patch) });
}

function formatterSpec(input, allowedCommands) {
  if (input == null) return null;
  if (!input || typeof input !== 'object') throw new TypeError('formatter must be an object');
  const command = String(input.command ?? '').trim();
  if (!allowedCommands.has(command)) throw new Error(`Formatter command is not allowlisted: ${command}`);
  if (!Array.isArray(input.args) || input.args.some((item) => typeof item !== 'string')) throw new TypeError('formatter args must be strings');
  const placeholders = input.args.reduce((sum, item) => sum + (item.match(/\{file\}/g)?.length ?? 0), 0);
  if (placeholders !== 1) throw new Error('Formatter args must contain exactly one {file} placeholder');
  for (const arg of input.args) {
    if (arg === '.' || arg === './' || arg === '..' || arg === '../' || /[*?\[\]]/.test(arg) || /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(arg)) throw new Error('Formatter args may not target a project directory or glob');
  }
  return { command, args: [...input.args] };
}

async function runFormatter({ root, spec, relativeTemp, timeoutMs }) {
  const args = spec.args.map((arg) => arg.replaceAll('{file}', relativeTemp));
  const safeEnv = { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? '' };
  const child = spawn(spec.command, args, { cwd: root, env: safeEnv, shell: false, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let stderr = ''; child.stderr.on('data', (chunk) => { if (stderr.length < 16_384) stderr += chunk.toString('utf8'); });
  const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs); timer.unref?.();
  const result = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal })); });
  clearTimeout(timer);
  if (result.code !== 0) throw new Error(`Formatter exited with ${result.code ?? result.signal}: ${stderr.trim().slice(0, 500)}`);
}

async function atomicWrite(file, content, mode) {
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${randomUUID()}.forge-write.tmp`);
  try { await writeFile(temp, content, { encoding: 'utf8', flag: 'wx' }); await chmod(temp, mode); await rename(temp, file); }
  finally { await rm(temp, { force: true }).catch(() => {}); }
}

export class AtomicPatchTransactionService {
  constructor({ workspaceRoot, allowedPaths, deniedPaths, allowedCommands = [], formatterTimeoutMs = 30_000 } = {}) {
    this.policy = new WorkspacePolicy(workspaceRoot, { allowedPaths, deniedPaths });
    this.root = this.policy.root;
    this.allowedCommands = new Set(allowedCommands.map(String));
    this.formatterTimeoutMs = bounded(formatterTimeoutMs, 30_000, 10, 600_000, 'formatterTimeoutMs');
  }

  async apply({ patches, maxFiles = 8, maxChangedLines = 2_000, formatter = null, conflictPolicy = 'reject', dryRun = false, semanticAuthorization = null } = {}) {
    if (!Array.isArray(patches) || patches.length < 1) throw new TypeError('patches must contain at least one patch');
    if (semanticAuthorization && semanticAuthorization.allowed !== true) throw new Error(`Semantic patch authorization denied: ${(semanticAuthorization.reasons ?? []).join(', ') || 'blocked'}`);
    const fileLimit = bounded(maxFiles, 8, 1, 32, 'maxFiles');
    const lineLimit = bounded(maxChangedLines, 2_000, 1, 20_000, 'maxChangedLines');
    if (patches.length > fileLimit) throw new Error(`Patch set exceeds maxFiles limit of ${fileLimit}`);
    const format = formatterSpec(formatter, this.allowedCommands);
    const seen = new Set(); const projected = [];

    for (const entry of patches) {
      if (!entry || typeof entry !== 'object') throw new TypeError('Each patch entry must be an object');
      const parsed = parseUnifiedPatch(entry.patch);
      if (!parsed.oldPath || !parsed.newPath || parsed.renameOnly || parsed.oldPath !== parsed.newPath) throw new Error('fs.patchSet only supports content changes to existing files');
      if (seen.has(parsed.oldPath)) throw new Error(`Duplicate patch path: ${parsed.oldPath}`);
      seen.add(parsed.oldPath);
      const absolute = await this.policy.resolveRead(parsed.oldPath); const info = await stat(absolute);
      if (!info.isFile()) throw new Error(`Patch target is not a regular file: ${parsed.oldPath}`);
      const before = await readFile(absolute, 'utf8'); assertNotGenerated(parsed.oldPath, before);
      if (entry.expectedSha256 !== undefined && entry.expectedSha256 !== canonicalSha256(before)) throw new Error(`File hash mismatch for ${parsed.oldPath}: expected ${entry.expectedSha256}, got ${canonicalSha256(before)}`);
      const applied = applyUnifiedPatch(before, parsed, { dryRun: true });
      assertProtectedComments(before, applied.content, parsed.oldPath);
      const conflicts = assertConflictPolicy(before, applied.content, conflictPolicy, parsed.oldPath);
      projected.push({ relativePath: parsed.oldPath, absolute, mode: info.mode & 0o777, before, content: applied.content, inputHunks: applied.appliedHunks, conflicts });
    }

    const inputChanges = projected.reduce((sum, item) => sum + createMinimalUnifiedPatch(item.before, item.content, item.relativePath).changedLines, 0);
    if (inputChanges > lineLimit) throw new Error(`Patch set exceeds changed-line budget of ${lineLimit}: ${inputChanges}`);

    const formatTemps = [];
    try {
      if (format) {
        for (const item of projected) {
          const extension = path.extname(item.absolute); const stem = path.basename(item.absolute, extension);
          const tempName = `.${stem}.${randomUUID()}.forge-format${extension}`;
          const tempAbsolute = path.join(path.dirname(item.absolute), tempName);
          const relativeTemp = this.policy.relative(tempAbsolute).replaceAll('\\', '/');
          await writeFile(tempAbsolute, item.content, { encoding: 'utf8', flag: 'wx' }); await chmod(tempAbsolute, item.mode); formatTemps.push(tempAbsolute);
          await runFormatter({ root: this.root, spec: format, relativeTemp, timeoutMs: this.formatterTimeoutMs });
          item.content = await readFile(tempAbsolute, 'utf8');
          assertProtectedComments(item.before, item.content, item.relativePath);
          item.conflicts = assertConflictPolicy(item.before, item.content, conflictPolicy, item.relativePath);
        }
      }

      const files = projected.map((item) => {
        const minimal = createMinimalUnifiedPatch(item.before, item.content, item.relativePath);
        return freeze({ path: item.relativePath, beforeSha256: canonicalSha256(item.before), afterSha256: canonicalSha256(item.content), inputHunks: item.inputHunks, minimalPatch: minimal.patch, minimalPatchSha256: canonicalSha256(minimal.patch), metrics: minimal });
      });
      const metrics = files.reduce((out, file, index) => {
        out.filesChanged += file.metrics.changedLines > 0 ? 1 : 0; out.hunks += file.metrics.hunks; out.additions += file.metrics.additions; out.deletions += file.metrics.deletions; out.changedLines += file.metrics.changedLines; out.contextLines += file.metrics.contextLines; out.patchBytes += file.metrics.bytes;
        out.conflictBlocksBefore += projected[index].conflicts.beforeState.count; out.conflictBlocksAfter += projected[index].conflicts.afterState.count;
        return out;
      }, { filesChanged: 0, hunks: 0, additions: 0, deletions: 0, changedLines: 0, contextLines: 0, patchBytes: 0, conflictBlocksBefore: 0, conflictBlocksAfter: 0 });
      if (metrics.changedLines > lineLimit) throw new Error(`Formatted patch set exceeds changed-line budget of ${lineLimit}: ${metrics.changedLines}`);

      if (!dryRun) {
        const written = [];
        try {
          for (const item of projected) { await atomicWrite(item.absolute, item.content, item.mode); written.push(item); }
        } catch (error) {
          const rollbackErrors = [];
          for (const item of projected) { try { await atomicWrite(item.absolute, item.before, item.mode); } catch (rollbackError) { rollbackErrors.push(`${item.relativePath}: ${rollbackError.message}`); } }
          if (rollbackErrors.length) error.message = `${error.message}; rollback failures: ${rollbackErrors.join('; ')}`;
          throw error;
        }
      }

      const base = {
        schema: 'forge.atomic-patch-transaction.v1', status: dryRun ? 'projected' : 'committed', dryRun: dryRun === true,
        conflictPolicy, limits: { maxFiles: fileLimit, maxChangedLines: lineLimit }, formatter: { used: Boolean(format), filesFormatted: format ? projected.length : 0, scope: 'transaction-temp-files-only' }, metrics, files,
      };
      return freeze({ ...base, receiptSha256: canonicalSha256(base) });
    } finally {
      await Promise.all(formatTemps.map((file) => rm(file, { force: true }).catch(() => {})));
    }
  }
}
