import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { redactSecrets } from '../security/redaction.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function boundedInteger(value, fallback, min, max, label) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new TypeError(`${label} must be between ${min} and ${max}`);
  return parsed;
}

function safeSegment(value, fallback) {
  const normalized = String(value ?? fallback).normalize('NFKC').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '').slice(0, 96);
  return normalized || fallback;
}

function serializeContent(content) {
  if (typeof content === 'string') return content;
  if (Buffer.isBuffer(content) || content instanceof Uint8Array) return Buffer.from(content).toString('utf8');
  return JSON.stringify(content, null, 2);
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

export class DynamicContextStore {
  constructor({ root, previewBytes = 4_096, maxArtifactBytes = 50_000_000 } = {}) {
    if (!root) throw new TypeError('DynamicContextStore root is required');
    this.root = path.resolve(root);
    this.previewBytes = boundedInteger(previewBytes, 4_096, 32, 1_000_000, 'previewBytes');
    this.maxArtifactBytes = boundedInteger(maxArtifactBytes, 50_000_000, 256, 500_000_000, 'maxArtifactBytes');
    this.records = new Map();
  }

  async artifactize({ kind = 'tool-output', content, metadata = {} } = {}, scope = {}) {
    const raw = serializeContent(content ?? '');
    const safe = redactSecrets(raw, { secretValues: scope.secretValues ?? [] });
    const bytes = Buffer.byteLength(safe);
    if (bytes > this.maxArtifactBytes) throw new Error(`Context artifact size limit exceeded: ${bytes} > ${this.maxArtifactBytes}`);

    const projectId = safeSegment(scope.projectId ?? scope.refs?.projectId, 'project');
    const taskId = safeSegment(scope.taskId ?? scope.refs?.taskId, 'task');
    const runId = safeSegment(scope.runId ?? scope.refs?.runId, 'run');
    const directory = path.join(this.root, projectId, taskId, runId);
    await mkdir(directory, { recursive: true, mode: 0o700 });

    const contentSha256 = sha256(safe);
    const id = `ctx_${contentSha256.slice(0, 20)}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
    const filePath = path.join(directory, `${id}.txt`);
    const metadataPath = path.join(directory, `${id}.json`);
    const tempContent = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    const tempMetadata = `${metadataPath}.${process.pid}.${randomUUID()}.tmp`;
    const preview = Buffer.from(safe).subarray(0, this.previewBytes).toString('utf8');
    const createdAt = new Date().toISOString();
    const record = {
      schema: 'forge.context-artifact.v1',
      id,
      kind: String(kind),
      bytes,
      sha256: contentSha256,
      preview,
      filePath,
      metadataPath,
      createdAt,
      refs: redactSecrets({ projectId, taskId, runId, ...(scope.refs ?? {}) }, { secretValues: scope.secretValues ?? [] }),
      metadata: redactSecrets(clone(metadata) ?? {}, { secretValues: scope.secretValues ?? [] }),
    };

    try {
      await writeFile(tempContent, safe, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      await writeFile(tempMetadata, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      await rename(tempContent, filePath);
      await rename(tempMetadata, metadataPath);
    } finally {
      await Promise.all([rm(tempContent, { force: true }).catch(() => {}), rm(tempMetadata, { force: true }).catch(() => {})]);
    }
    this.records.set(id, Object.freeze(record));
    return Object.freeze(clone(record));
  }

  async read(id, { startByte = 0, maxBytes = 64_000 } = {}) {
    const record = await this.#loadRecord(id);
    const start = boundedInteger(startByte, 0, 0, record.bytes, 'startByte');
    const limit = boundedInteger(maxBytes, 64_000, 1, Math.min(this.maxArtifactBytes, 10_000_000), 'maxBytes');
    const length = Math.min(limit, Math.max(0, record.bytes - start));
    const handle = await open(record.filePath, 'r');
    try {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, start);
      return Object.freeze({
        schema: 'forge.context-artifact-page.v1',
        id: record.id,
        startByte: start,
        endByte: start + bytesRead,
        totalBytes: record.bytes,
        content: buffer.subarray(0, bytesRead).toString('utf8'),
        nextByte: start + bytesRead < record.bytes ? start + bytesRead : null,
        sha256: record.sha256,
      });
    } finally {
      await handle.close();
    }
  }

  async search(id, query, { limit = 100, caseSensitive = false, regex = false } = {}) {
    const record = await this.#loadRecord(id);
    const needle = String(query ?? '');
    if (!needle) throw new TypeError('context artifact search query is required');
    const maxResults = boundedInteger(limit, 100, 1, 1_000, 'limit');
    const content = await readFile(record.filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const items = [];
    let expression;
    if (regex) {
      try { expression = new RegExp(needle, caseSensitive ? 'g' : 'gi'); }
      catch (error) { throw new Error(`Invalid context artifact regex: ${error.message}`); }
    }
    const normalizedNeedle = caseSensitive ? needle : needle.toLocaleLowerCase('en-US');
    for (let index = 0; index < lines.length && items.length < maxResults; index += 1) {
      const text = lines[index];
      if (regex) {
        expression.lastIndex = 0;
        let match;
        while ((match = expression.exec(text)) !== null && items.length < maxResults) {
          items.push({ line: index + 1, column: match.index + 1, text });
          if (match[0].length === 0) expression.lastIndex += 1;
        }
      } else {
        const haystack = caseSensitive ? text : text.toLocaleLowerCase('en-US');
        let offset = 0;
        while (items.length < maxResults) {
          const position = haystack.indexOf(normalizedNeedle, offset);
          if (position === -1) break;
          items.push({ line: index + 1, column: position + 1, text });
          offset = position + Math.max(1, normalizedNeedle.length);
        }
      }
    }
    return Object.freeze({ schema: 'forge.context-artifact-search.v1', id: record.id, query: needle, items, truncated: items.length >= maxResults });
  }

  async get(id) {
    return Object.freeze(clone(await this.#loadRecord(id)));
  }

  async #loadRecord(id) {
    const normalizedId = String(id ?? '');
    if (!/^ctx_[a-f0-9]{20}_[a-f0-9]{8}$/.test(normalizedId)) throw new Error('Invalid context artifact id');
    const cached = this.records.get(normalizedId);
    if (cached) return cached;

    const candidates = [];
    // Records are normally read in the same process. The bounded recursive lookup
    // keeps resume/restart support without trusting a caller-supplied path.
    const walk = async (directory, depth = 0) => {
      if (depth > 3) return;
      let entries;
      try { entries = await import('node:fs/promises').then(({ readdir }) => readdir(directory, { withFileTypes: true })); }
      catch (error) { if (error?.code === 'ENOENT') return; throw error; }
      for (const entry of entries) {
        const candidate = path.join(directory, entry.name);
        if (entry.isDirectory()) await walk(candidate, depth + 1);
        else if (entry.isFile() && entry.name === `${normalizedId}.json`) candidates.push(candidate);
      }
    };
    await walk(this.root);
    if (candidates.length !== 1) throw new Error(candidates.length === 0 ? 'Context artifact not found' : 'Context artifact id is ambiguous');
    const parsed = JSON.parse(await readFile(candidates[0], 'utf8'));
    const resolvedFile = path.resolve(parsed.filePath);
    const relative = path.relative(this.root, resolvedFile);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Context artifact metadata escapes store root');
    const info = await stat(resolvedFile);
    if (!info.isFile() || info.size !== parsed.bytes) throw new Error('Context artifact metadata does not match content');
    const content = await readFile(resolvedFile);
    if (sha256(content) !== parsed.sha256) throw new Error('Context artifact integrity check failed');
    const record = Object.freeze(parsed);
    this.records.set(normalizedId, record);
    return record;
  }
}
