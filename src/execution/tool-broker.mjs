import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, readdir, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { redactSecrets } from '../security/redaction.mjs';
import { WorkspacePolicy } from '../security/path-policy.mjs';
import { applyUnifiedPatch, parseUnifiedPatch } from './unified-patch.mjs';
import { AtomicPatchTransactionService } from './atomic-patch-transaction-service.mjs';
import { ManagedProcessRegistry } from './managed-process-registry.mjs';
import { ExecutionBackendRegistry } from '../native-core/execution-backend-registry.mjs';
import { ToolExecutionFabric } from '../native-core/tool-execution-fabric.mjs';

const stamp = () => new Date().toISOString();

function bounded(value, fallback, min, max, label) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new TypeError(`${label} must be between ${min} and ${max}`);
  return number;
}

export class ToolBroker {
  constructor({ workspaceRoot, allowedPaths, deniedPaths, allowedCommands = [], allowedEnv = [], timeoutMs = 30_000, maxOutputBytes = 1_000_000, maxFileBytes = 2_000_000, maxStdinBytes = 1_000_000, dynamicContextStore = null, artifactThresholdBytes = 250_000, commandGovernance = null, managedProcessRegistry = null } = {}) {
    this.policy = new WorkspacePolicy(workspaceRoot, { allowedPaths, deniedPaths });
    this.allowedCommands = new Set(allowedCommands.map(String));
    this.allowedEnv = new Set(allowedEnv.map(String));
    this.timeoutMs = bounded(timeoutMs, 30_000, 10, 24 * 60 * 60_000, 'timeoutMs');
    this.maxOutputBytes = bounded(maxOutputBytes, 1_000_000, 256, 100_000_000, 'maxOutputBytes');
    this.maxFileBytes = bounded(maxFileBytes, 2_000_000, 256, 100_000_000, 'maxFileBytes');
    this.maxStdinBytes = bounded(maxStdinBytes, 1_000_000, 0, 100_000_000, 'maxStdinBytes');
    this.dynamicContextStore = dynamicContextStore;
    this.artifactThresholdBytes = bounded(artifactThresholdBytes, 250_000, 64, 100_000_000, 'artifactThresholdBytes');
    this.atomicPatchService = new AtomicPatchTransactionService({ workspaceRoot, allowedPaths, deniedPaths, allowedCommands, formatterTimeoutMs: this.timeoutMs });
    this.commandGovernance = commandGovernance;
    this.managedProcesses = managedProcessRegistry ?? new ManagedProcessRegistry({ maxOutputBytes: this.maxOutputBytes });
    this.nativeExecutionBackends = new ExecutionBackendRegistry();
    this.nativeExecutionBackends.register({
      id: 'tool-broker',
      kind: 'nolane-tool-broker',
      capabilities: ['filesystem', 'process'],
      execute: ({ request, context, signal }) => this.#executeDirect(request, { ...context, signal }),
    });
    this.nativeExecutionFabric = new ToolExecutionFabric({ registry: this.nativeExecutionBackends, defaultTimeoutMs: this.timeoutMs + 1_000, maxOutputBytes: this.maxOutputBytes });
  }

  async execute(request, context = {}) {
    const envelope = await this.nativeExecutionFabric.execute({
      backendId: 'tool-broker',
      action: { request, context },
      timeoutMs: Math.max(10, Number(request?.input?.timeoutMs ?? this.timeoutMs) + 1_000),
      signal: context.signal,
      policy: { risk: 'low', reversible: true, approved: true },
    });
    if (!envelope.output || typeof envelope.output !== 'object') throw new Error(`Tool broker execution ${envelope.status}`);
    const { output, ...executionReceipt } = envelope;
    return Object.freeze({ ...output, executionReceipt: Object.freeze(executionReceipt) });
  }

  async #executeDirect(request, context = {}) {
    if (!request || typeof request !== 'object') throw new TypeError('tool request is required');
    const tool = String(request.tool ?? '');
    const input = request.input && typeof request.input === 'object' ? request.input : {};
    const startedAt = stamp(); const started = Date.now();
    let status = 'pass'; let output;
    if (tool === 'fs.read') output = await this.#read(input);
    else if (tool === 'fs.readMany') output = await this.#readMany(input);
    else if (tool === 'fs.search') output = await this.#search(input);
    else if (tool === 'fs.write') output = await this.#write(input);
    else if (tool === 'fs.patch') output = await this.#patch(input);
    else if (tool === 'fs.patchSet') output = await this.atomicPatchService.apply(input);
    else if (tool === 'fs.delete') output = await this.#delete(input);
    else if (tool === 'fs.rename') output = await this.#rename(input);
    else if (tool === 'fs.mkdir') output = await this.#mkdir(input);
    else if (tool === 'fs.rmdir') output = await this.#rmdir(input);
    else if (tool === 'process.run') { output = await this.#run(input, context); status = output.timedOut ? 'timeout' : output.exitCode === 0 ? 'pass' : 'fail'; }
    else if (tool === 'process.startManaged') output = await this.#startManaged(input, context);
    else if (tool === 'process.stopManaged') output = await this.#stopManaged(input, context);
    else if (tool === 'process.listManaged') output = { items: this.managedProcesses.list() };
    else throw new Error(`Unsupported tool: ${tool}`);
    const safeOutput = redactSecrets(output, { secretValues: context.secretValues ?? [] });
    const serializedSafeOutput = typeof safeOutput === 'string' ? safeOutput : JSON.stringify(safeOutput, null, 2);
    let returnedOutput = safeOutput;
    let contextArtifact = null;
    if (this.dynamicContextStore && Buffer.byteLength(serializedSafeOutput) > this.artifactThresholdBytes) {
      contextArtifact = await this.dynamicContextStore.artifactize(
        { kind: 'tool-output', content: serializedSafeOutput, metadata: { tool, status } },
        { ...(context.refs ?? {}), refs: context.refs ?? {}, secretValues: context.secretValues ?? [] },
      );
      returnedOutput = {
        artifact: contextArtifact,
        preview: contextArtifact.preview,
        originalType: Array.isArray(safeOutput) ? 'array' : typeof safeOutput,
        instructions: 'Use the context artifact read/search APIs to inspect additional output without loading it all into model context.',
      };
    }
    const finishedAt = stamp();
    const base = {
      schema: 'forge.tool.receipt.v1',
      id: `receipt_${randomUUID().replaceAll('-', '').slice(0, 24)}`,
      tool,
      status,
      startedAt,
      finishedAt,
      durationMs: Date.now() - started,
      requestSha256: canonicalSha256(redactSecrets({ tool, input }, { secretValues: context.secretValues ?? [] })),
      outputSha256: canonicalSha256(safeOutput),
      ...(contextArtifact ? { artifactSha256: contextArtifact.sha256, artifactId: contextArtifact.id } : {}),
      refs: redactSecrets(context.refs ?? {}, { secretValues: context.secretValues ?? [] }),
    };
    const receipt = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
    return Object.freeze({ status, output: Object.freeze(returnedOutput), receipt });
  }

  async #read(input) {
    const file = await this.policy.resolveRead(input.path);
    const info = await stat(file);
    if (!info.isFile()) throw new Error('fs.read only supports regular files');
    if (info.size > this.maxFileBytes) throw new Error(`File exceeds ${this.maxFileBytes} byte read limit`);
    const encoding = input.encoding ?? 'utf8';
    if (encoding !== 'utf8' && encoding !== 'utf-8') throw new Error('fs.read only supports UTF-8 text');
    const fullContent = await readFile(file, 'utf8');
    const lines = fullContent.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    const totalLines = lines.length;
    const paging = input.pageSizeLines !== undefined || input.pageToken !== undefined;
    const selectors = [input.startLine !== undefined || input.endLine !== undefined, input.headLines !== undefined, input.tailLines !== undefined, paging].filter(Boolean).length;
    if (selectors > 1) throw new Error('start/end, headLines, tailLines, and paging are mutually exclusive');

    const fileSha256 = canonicalSha256(fullContent);
    let startLine = totalLines === 0 ? 0 : 1;
    let endLine = totalLines;
    let pageSizeLines = null;
    if (paging) {
      pageSizeLines = bounded(input.pageSizeLines, 200, 1, 10_000, 'pageSizeLines');
      if (input.pageToken !== undefined) {
        let token;
        try { token = JSON.parse(Buffer.from(String(input.pageToken), 'base64url').toString('utf8')); }
        catch { throw new Error('Invalid fs.read page token'); }
        if (token.path !== this.policy.relative(file) || token.sha256 !== fileSha256 || token.pageSizeLines !== pageSizeLines || !Number.isInteger(token.nextLine)) throw new Error('Stale or invalid fs.read page token');
        startLine = token.nextLine;
      }
      if (totalLines === 0 || startLine < 1 || startLine > totalLines) throw new Error('Requested page is outside file');
      endLine = Math.min(totalLines, startLine + pageSizeLines - 1);
    } else if (input.headLines !== undefined) {
      const count = bounded(input.headLines, 1, 1, Math.max(1, totalLines), 'headLines');
      endLine = Math.min(totalLines, count);
    } else if (input.tailLines !== undefined) {
      const count = bounded(input.tailLines, 1, 1, Math.max(1, totalLines), 'tailLines');
      startLine = totalLines === 0 ? 0 : Math.max(1, totalLines - count + 1);
    } else if (input.startLine !== undefined || input.endLine !== undefined) {
      if (totalLines === 0) throw new Error('Requested line range is outside file');
      const requestedStart = input.startLine === undefined ? 1 : Number(input.startLine);
      const requestedEnd = input.endLine === undefined ? totalLines : Number(input.endLine);
      if (!Number.isInteger(requestedStart) || !Number.isInteger(requestedEnd)) throw new TypeError('Line range values must be integers');
      if (requestedStart < 1 || requestedStart > totalLines || requestedEnd < requestedStart || requestedEnd > totalLines) {
        throw new Error(`Requested line range ${requestedStart}-${requestedEnd} is outside file with ${totalLines} lines`);
      }
      startLine = requestedStart;
      endLine = requestedEnd;
    }
    const content = totalLines === 0 ? '' : lines.slice(startLine - 1, endLine).join('');
    const relative = this.policy.relative(file);
    const nextPageToken = pageSizeLines && endLine < totalLines
      ? Buffer.from(JSON.stringify({ path: relative, sha256: fileSha256, nextLine: endLine + 1, pageSizeLines })).toString('base64url')
      : null;
    return {
      path: relative,
      bytes: Buffer.byteLength(content),
      fileBytes: info.size,
      content,
      sha256: fileSha256,
      startLine,
      endLine,
      totalLines,
      nextPageToken,
    };
  }

  async #readMany(input) {
    const paths = input.paths;
    if (!Array.isArray(paths) || paths.length < 1 || paths.length > 64 || paths.some((item) => typeof item !== 'string')) throw new TypeError('fs.readMany paths must contain between 1 and 64 strings');
    const concurrency = bounded(input.concurrency, 8, 1, 32, 'concurrency');
    const items = new Array(paths.length); let cursor = 0;
    const worker = async () => {
      while (true) {
        const index = cursor; cursor += 1;
        if (index >= paths.length) return;
        items[index] = await this.#read({ path: paths[index], ...(input.pageSizeLines === undefined ? {} : { pageSizeLines: input.pageSizeLines }) });
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, paths.length) }, () => worker()));
    return { items, count: items.length };
  }

  async #search(input) {
    const query = String(input.query ?? '');
    if (!query) throw new TypeError('fs.search query is required');
    if (query.length > 4_000) throw new Error('fs.search query exceeds 4000 characters');
    const roots = input.paths === undefined ? ['.'] : input.paths;
    if (!Array.isArray(roots) || roots.length === 0 || roots.length > 32 || roots.some((item) => typeof item !== 'string')) {
      throw new TypeError('fs.search paths must contain between 1 and 32 strings');
    }
    const maxResults = bounded(input.maxResults, 100, 1, 500, 'maxResults');
    const maxFiles = bounded(input.maxFiles, 10_000, 1, 100_000, 'maxFiles');
    const caseSensitive = input.caseSensitive === true;
    const useRegex = input.regex === true;
    let expression = null;
    if (useRegex) {
      try { expression = new RegExp(query, caseSensitive ? 'g' : 'gi'); }
      catch (error) { throw new Error(`Invalid search regex: ${error.message}`); }
    }

    const ignoredDirectories = new Set(['.git', 'node_modules', '.cache', '.worktrees', 'release']);
    const files = new Map();
    let truncatedFiles = false;
    const visit = async (absolute) => {
      if (files.size >= maxFiles) { truncatedFiles = true; return; }
      const info = await stat(absolute);
      if (info.isFile()) {
        files.set(this.policy.relative(absolute), absolute);
        return;
      }
      if (!info.isDirectory()) return;
      const entries = await readdir(absolute, { withFileTypes: true });
      entries.sort((left, right) => left.name.localeCompare(right.name));
      for (const entry of entries) {
        if (files.size >= maxFiles) { truncatedFiles = true; break; }
        if (entry.isSymbolicLink() || (entry.isDirectory() && ignoredDirectories.has(entry.name))) continue;
        const candidate = path.join(absolute, entry.name);
        const relative = this.policy.relative(candidate);
        let resolved;
        try { resolved = await this.policy.resolveRead(relative); }
        catch (error) {
          if (/denied task path|outside task-owned paths/i.test(String(error?.message ?? error))) continue;
          throw error;
        }
        await visit(resolved);
      }
    };

    for (const root of roots) {
      const resolved = await this.policy.resolveRead(root);
      await visit(resolved);
      if (files.size >= maxFiles) break;
    }

    const matches = [];
    const needle = caseSensitive ? query : query.toLocaleLowerCase('en-US');
    for (const [relative, file] of [...files.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      const info = await stat(file);
      if (!info.isFile() || info.size > this.maxFileBytes) continue;
      const buffer = await readFile(file);
      if (buffer.includes(0)) continue;
      const content = buffer.toString('utf8');
      const lines = content.match(/[^\n]*\n|[^\n]+$/g) ?? [];
      for (let index = 0; index < lines.length; index += 1) {
        const text = lines[index].replace(/\r?\n$/, '');
        if (useRegex) {
          expression.lastIndex = 0;
          let match;
          while ((match = expression.exec(text)) !== null) {
            matches.push({ path: relative, line: index + 1, column: match.index + 1, text });
            if (matches.length >= maxResults) break;
            if (match[0].length === 0) expression.lastIndex += 1;
          }
        } else {
          const haystack = caseSensitive ? text : text.toLocaleLowerCase('en-US');
          let offset = 0;
          while (offset <= haystack.length) {
            const position = haystack.indexOf(needle, offset);
            if (position === -1) break;
            matches.push({ path: relative, line: index + 1, column: position + 1, text });
            if (matches.length >= maxResults) break;
            offset = position + Math.max(1, needle.length);
          }
        }
        if (matches.length >= maxResults) break;
      }
      if (matches.length >= maxResults) break;
    }
    return {
      query,
      regex: useRegex,
      caseSensitive,
      searchedFiles: files.size,
      matches,
      truncated: matches.length >= maxResults || truncatedFiles,
    };
  }

  async #write(input) {
    const file = await this.policy.resolveWrite(input.path);
    const content = String(input.content ?? '');
    if (Buffer.byteLength(content) > this.maxFileBytes) throw new Error(`File exceeds ${this.maxFileBytes} byte write limit`);
    let before = null; let beforeMode = null;
    try { const info = await stat(file); beforeMode = info.mode & 0o777; before = await readFile(file, 'utf8'); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
    if (input.expectedSha256 !== undefined) {
      const actual = before === null ? null : canonicalSha256(before);
      if (actual !== input.expectedSha256) throw new Error(`File hash mismatch: expected ${input.expectedSha256}, got ${actual}`);
    }
    await mkdir(path.dirname(file), { recursive: true });
    const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${randomUUID()}.tmp`);
    try { await writeFile(temp, content, { encoding: 'utf8', flag: 'wx' }); if (beforeMode !== null) await chmod(temp, beforeMode); await rename(temp, file); }
    finally { await rm(temp, { force: true }).catch(() => {}); }
    return { path: this.policy.relative(file), bytes: Buffer.byteLength(content), beforeSha256: before === null ? null : canonicalSha256(before), afterSha256: canonicalSha256(content) };
  }

  async #patch(input) {
    const parsed = parseUnifiedPatch(input.patch);
    if (!parsed.oldPath || !parsed.newPath) throw new Error('fs.patch requires concrete source and destination paths');
    const file = await this.policy.resolveRead(parsed.oldPath);
    const before = await readFile(file, 'utf8');
    if (input.expectedSha256 !== undefined) {
      const actual = canonicalSha256(before);
      if (actual !== input.expectedSha256) throw new Error(`File hash mismatch: expected ${input.expectedSha256}, got ${actual}`);
    }
    const applied = applyUnifiedPatch(before, parsed, { dryRun: input.dryRun === true });
    if (input.dryRun === true) return { path: parsed.newPath, beforeSha256: canonicalSha256(before), afterSha256: canonicalSha256(applied.content), appliedHunks: applied.appliedHunks, dryRun: true, renameOnly: parsed.renameOnly };
    if (parsed.renameOnly) {
      const renamed = await this.#rename({ from: parsed.oldPath, to: parsed.newPath });
      return { ...renamed, beforeSha256: canonicalSha256(before), afterSha256: canonicalSha256(before), appliedHunks: 0, renameOnly: true };
    }
    if (parsed.oldPath !== parsed.newPath) throw new Error('Content-changing rename patches are not supported in one call');
    const written = await this.#write({ path: parsed.newPath, content: applied.content, expectedSha256: canonicalSha256(before) });
    return { ...written, appliedHunks: applied.appliedHunks, dryRun: false, renameOnly: false };
  }

  async #delete(input) {
    const file = await this.policy.resolveRead(input.path);
    const info = await stat(file);
    if (!info.isFile()) throw new Error('fs.delete only supports regular files');
    await rm(file, { force: false });
    return { path: this.policy.relative(file), bytes: info.size };
  }

  async #rename(input) {
    const source = await this.policy.resolveRead(input.from);
    const destination = await this.policy.resolveWrite(input.to);
    try { await stat(destination); throw new Error(`Rename destination already exists: ${input.to}`); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
    await mkdir(path.dirname(destination), { recursive: true });
    await rename(source, destination);
    return { from: this.policy.relative(source), to: this.policy.relative(destination) };
  }

  async #mkdir(input) {
    const directory = await this.policy.resolveWrite(input.path);
    await mkdir(directory, { recursive: input.recursive !== false });
    return { path: this.policy.relative(directory) };
  }

  async #rmdir(input) {
    const directory = await this.policy.resolveRead(input.path);
    const info = await stat(directory);
    if (!info.isDirectory()) throw new Error('fs.rmdir only supports directories');
    await rmdir(directory);
    return { path: this.policy.relative(directory) };
  }

  #safeCommandInput(input) {
    const command = String(input.command ?? '');
    if (!this.allowedCommands.has(command)) throw new Error(`Command is not allowlisted: ${command}`);
    if (!Array.isArray(input.args) || input.args.some((item) => typeof item !== 'string')) throw new TypeError('Command args must be strings');
    return { command, args: [...input.args] };
  }

  async #commandEnvironment(input) {
    const cwd = await this.policy.resolveRead(input.cwd ?? '.');
    const safeEnv = { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? '' };
    for (const key of this.allowedEnv) if (Object.hasOwn(input.env ?? {}, key)) safeEnv[key] = String(input.env[key]);
    const stdin = input.stdin === undefined ? '' : String(input.stdin);
    if (Buffer.byteLength(stdin) > this.maxStdinBytes) throw new Error(`stdin exceeds ${this.maxStdinBytes} byte limit`);
    return { cwd, safeEnv, stdin };
  }

  #authorizeCommand(input, context) {
    if (!this.commandGovernance) return null;
    return this.commandGovernance.authorize({
      principalId: context.principalId,
      projectId: context.projectId,
      taskId: context.taskId,
      sessionId: context.sessionId,
      origin: context.origin ?? 'agent',
      ...input,
    });
  }

  async #run(input, context = {}) {
    if (String(input.commandClass ?? '') === 'dev-server') throw new Error('Development servers must use process.startManaged');
    const { command, args } = this.#safeCommandInput(input);
    const { cwd, safeEnv, stdin } = await this.#commandEnvironment(input);
    const governance = this.#authorizeCommand({ ...input, command, args, cwd: this.policy.relative(cwd), env: safeEnv, stdin }, context);
    const timeoutMs = bounded(input.timeoutMs, this.timeoutMs, 10, 24 * 60 * 60_000, 'timeoutMs');
    let stdout = ''; let stderr = ''; let keptBytes = 0; let truncated = false; let timedOut = false;
    const child = spawn(command, args, { cwd, env: safeEnv, shell: false, stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32', windowsHide: true });
    const append = (kind, chunk) => {
      const buffer = Buffer.from(chunk);
      const available = Math.max(0, this.maxOutputBytes - keptBytes);
      const kept = buffer.subarray(0, available);
      keptBytes += kept.length;
      if (buffer.length > available) truncated = true;
      if (kind === 'stdout') stdout += kept.toString('utf8'); else stderr += kept.toString('utf8');
    };
    child.stdin.on('error', () => {});
    child.stdin.end(stdin);
    child.stdout.on('data', (chunk) => append('stdout', chunk));
    child.stderr.on('data', (chunk) => append('stderr', chunk));
    const kill = () => {
      try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); }
      catch { try { child.kill('SIGKILL'); } catch {} }
    };
    const timer = setTimeout(() => { timedOut = true; kill(); }, timeoutMs); timer.unref?.();
    const abort = () => kill();
    const signal = context.signal;
    if (signal?.aborted) abort(); else signal?.addEventListener?.('abort', abort, { once: true });
    const result = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (exitCode, signalName) => resolve({ exitCode, signalName }));
    }).finally(() => { clearTimeout(timer); signal?.removeEventListener?.('abort', abort); });
    return { command, args, cwd: this.policy.relative(cwd), exitCode: result.exitCode, signal: result.signalName ?? null, timedOut, truncated, stdout, stderr, governanceReceiptSha256: governance?.receiptSha256 ?? null };
  }

  async #startManaged(input, context = {}) {
    const { command, args } = this.#safeCommandInput(input);
    if (String(input.commandClass ?? '') !== 'dev-server') throw new Error('process.startManaged requires commandClass=dev-server');
    const { cwd, safeEnv, stdin } = await this.#commandEnvironment(input);
    const governance = this.#authorizeCommand({ ...input, command, args, cwd: this.policy.relative(cwd), env: safeEnv, stdin, server: true }, context);
    const started = await this.managedProcesses.start({
      id: input.id,
      command,
      args,
      cwd,
      env: safeEnv,
      stdin,
      startupDelayMs: input.startupDelayMs,
      metadata: {
        projectId: context.projectId ?? null,
        taskId: context.taskId ?? null,
        principalId: context.principalId ?? null,
        governanceReceiptSha256: governance?.receiptSha256 ?? null,
      },
    });
    return { ...started, governanceReceiptSha256: governance?.receiptSha256 ?? null };
  }

  async #stopManaged(input, context = {}) {
    const id = String(input.id ?? '');
    const record = this.managedProcesses.list().find((item) => item.id === id);
    if (!record) throw new Error(`Unknown managed process: ${id}`);
    const owner = record.metadata ?? {};
    if (owner.projectId && context.projectId && owner.projectId !== context.projectId) throw new Error('Managed process belongs to another project');
    if (owner.principalId && context.principalId && owner.principalId !== context.principalId) throw new Error('Managed process belongs to another principal');
    return this.managedProcesses.stop(id);
  }

  async close() { await this.managedProcesses.close(); }
}
