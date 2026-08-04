import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const stable = (value) => JSON.stringify(value, Object.keys(value).sort());
const SECRET_PATH = /(^|\/)(\.env(?:\..*)?|[^/]*\.(?:pem|key|p12|pfx)|id_rsa|credentials?(?:\.json)?)$/i;
const ALLOWED_SCHEMA_KEYS = new Set(['type', 'title', 'description', 'properties', 'required', 'items', 'enum', 'const', 'default', 'additionalProperties', 'oneOf', 'anyOf', 'allOf', 'minimum', 'maximum', 'minLength', 'maxLength', 'pattern', 'format']);

function safeRelative(candidate) {
  const normalized = path.posix.normalize(String(candidate ?? '').replaceAll('\\', '/'));
  return normalized !== '' && normalized !== '.' && !normalized.startsWith('../') && !path.posix.isAbsolute(normalized) && !SECRET_PATH.test(normalized) && !normalized.split('/').includes('.git');
}

function privateIpv4(host) {
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
}

export class ToolGovernanceRuntime {
  constructor({ workspaceRoot = process.cwd(), spillRoot = null, maxSchemaDepth = 12, maxInlineBytes = 16_384, maxDiffBytes = 2_000_000 } = {}) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.spillRoot = path.resolve(spillRoot ?? path.join(this.workspaceRoot, '.nolane', 'tool-output'));
    this.maxSchemaDepth = maxSchemaDepth;
    this.maxInlineBytes = maxInlineBytes;
    this.maxDiffBytes = maxDiffBytes;
  }

  sanitizeSchema(schema) {
    const visit = (value, depth) => {
      if (depth > this.maxSchemaDepth) throw new Error('schema exceeds maximum depth');
      if (Array.isArray(value)) return value.map((entry) => visit(entry, depth + 1));
      if (!value || typeof value !== 'object') return value;
      const out = {};
      for (const [key, entry] of Object.entries(value)) {
        if (!ALLOWED_SCHEMA_KEYS.has(key) || ['__proto__', 'constructor', 'prototype', 'examples'].includes(key)) continue;
        if (key === 'properties') {
          const properties = {};
          for (const [name, property] of Object.entries(entry ?? {})) {
            if (['__proto__', 'constructor', 'prototype'].includes(name)) continue;
            properties[name] = visit(property, depth + 1);
          }
          out.properties = properties;
        } else out[key] = visit(entry, depth + 1);
      }
      return out;
    };
    return visit(schema, 0);
  }

  authorizeUrl(value) {
    let url;
    try { url = new URL(String(value)); } catch { throw new Error('unsafe URL'); }
    if (url.protocol !== 'https:') throw new Error('unsupported URL protocol; HTTPS is required');
    if (url.username || url.password) throw new Error('URL credentials are forbidden');
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd') || privateIpv4(host) || (net.isIP(host) === 0 && !host.includes('.'))) throw new Error('unsafe private or local URL');
    return Object.freeze({ allowed: true, protocol: 'https:', host, url: url.toString(), receiptSha256: sha256(url.toString()) });
  }

  stripAnsi(value) { return String(value ?? '').replace(/[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g, ''); }

  prepareWorkingDiff(changes = []) {
    const files = []; const rejected = []; let bytes = 0;
    for (const change of changes) {
      const relative = String(change?.path ?? '').replaceAll('\\', '/');
      if (!safeRelative(relative)) { rejected.push({ path: relative, reason: 'unsafe-path' }); continue; }
      const before = String(change.before ?? ''); const after = String(change.after ?? '');
      const size = Buffer.byteLength(before) + Buffer.byteLength(after);
      if (bytes + size > this.maxDiffBytes) { rejected.push({ path: relative, reason: 'diff-budget' }); continue; }
      bytes += size;
      files.push({ path: path.posix.normalize(relative), before, after, beforeSha256: sha256(before), afterSha256: sha256(after), changed: before !== after });
    }
    if (files.length === 0) throw new Error('no safe files available for diff');
    const receipt = { schema: 'nolane.agent.working-diff.v1', files, rejected, bytes };
    receipt.receiptSha256 = sha256(stable(receipt));
    return Object.freeze(receipt);
  }

  createCheckpoint({ id, files } = {}) {
    if (!id || !Array.isArray(files) || files.length === 0) throw new Error('checkpoint id and files are required');
    const normalized = files.map((file) => ({ path: String(file.path), beforeSha256: String(file.beforeSha256 ?? sha256(String(file.before ?? ''))), afterSha256: String(file.afterSha256 ?? sha256(String(file.after ?? ''))) }));
    const receipt = { schema: 'nolane.agent.tool-checkpoint.v1', id: String(id), files: normalized };
    receipt.receiptSha256 = sha256(stable(receipt));
    return Object.freeze(receipt);
  }

  async captureOutput({ toolCallId, stdout = '', stderr = '' } = {}) {
    if (!toolCallId) throw new Error('toolCallId is required');
    const cleanStdout = this.stripAnsi(stdout); const cleanStderr = this.stripAnsi(stderr);
    const combined = cleanStderr ? `${cleanStdout}\n[stderr]\n${cleanStderr}` : cleanStdout;
    const bytes = Buffer.byteLength(combined);
    if (bytes <= this.maxInlineBytes) return Object.freeze({ schema: 'nolane.agent.tool-output.v1', toolCallId: String(toolCallId), inline: true, content: combined, bytes, contentSha256: sha256(combined) });
    await mkdir(this.spillRoot, { recursive: true });
    const safeId = String(toolCallId).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
    const outputPath = path.join(this.spillRoot, `${safeId}-${sha256(combined).slice(0, 16)}.log`);
    const relative = path.relative(this.spillRoot, outputPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('output spill path escaped root');
    await writeFile(outputPath, combined, { mode: 0o600 });
    return Object.freeze({ schema: 'nolane.agent.tool-output.v1', toolCallId: String(toolCallId), inline: false, path: outputPath, bytes, contentSha256: sha256(combined) });
  }

  classifyResult({ exitCode, stdout = '', stderr = '', error = null } = {}) {
    const text = `${stderr}\n${error?.message ?? ''}`.toLowerCase();
    let resultClass = 'failure';
    if (Number(exitCode) === 0 && !error) resultClass = 'success';
    else if (Number(exitCode) === 124 || text.includes('timeout') || text.includes('timed out')) resultClass = 'timeout';
    else if (text.includes('permission denied') || text.includes('access denied') || text.includes('eacces')) resultClass = 'permission';
    else if (text.includes('not found') || Number(exitCode) === 127) resultClass = 'missing_dependency';
    else if (text.includes('cancel')) resultClass = 'cancelled';
    return Object.freeze({ class: resultClass, exitCode: Number(exitCode), stdoutSha256: sha256(this.stripAnsi(stdout)), stderrSha256: sha256(this.stripAnsi(stderr)) });
  }

  normalizeBudget(input = {}) {
    const timeoutMs = Number(input.timeoutMs ?? 30_000); const maxOutputBytes = Number(input.maxOutputBytes ?? 1_000_000); const maxProcesses = Number(input.maxProcesses ?? 1);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new Error('timeoutMs must be a positive integer');
    if (!Number.isInteger(maxOutputBytes) || maxOutputBytes < 1) throw new Error('maxOutputBytes must be a positive integer');
    if (!Number.isInteger(maxProcesses) || maxProcesses < 1 || maxProcesses > 64) throw new Error('maxProcesses must be between 1 and 64');
    return Object.freeze({ timeoutMs, maxOutputBytes, maxProcesses });
  }

  snapshot() { return Object.freeze({ schema: 'nolane.agent.tool-governance-runtime-snapshot.v1', workspaceRoot: this.workspaceRoot, spillRoot: this.spillRoot, maxInlineBytes: this.maxInlineBytes, maxDiffBytes: this.maxDiffBytes }); }
}
