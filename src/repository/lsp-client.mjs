import { spawn } from 'node:child_process';

import { VERSION } from '../version.mjs';
function fail(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  throw error;
}

function freeze(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) { value.forEach(freeze); return Object.freeze(value); }
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

export class LspClient {
  constructor({ command, args = [], cwd = process.cwd(), env = {}, timeoutMs = 5_000, maxMessageBytes = 4 * 1024 * 1024 } = {}) {
    if (!String(command ?? '').trim()) fail('LSP_COMMAND_REQUIRED', 'language server command is required');
    this.command = String(command);
    this.args = args.map(String);
    this.cwd = cwd;
    this.env = { PATH: process.env.PATH ?? '', ...env };
    this.timeoutMs = Math.max(20, Math.min(120_000, Number(timeoutMs) || 5_000));
    this.maxMessageBytes = Math.max(1024, Math.min(64 * 1024 * 1024, Number(maxMessageBytes) || 4 * 1024 * 1024));
    this.process = null;
    this.buffer = Buffer.alloc(0);
    this.pending = new Map();
    this.nextId = 1;
    this.diagnosticMap = new Map();
    this.initialized = false;
    this.disposed = false;
    this.stderr = '';
  }

  async start() {
    if (this.process) return;
    if (this.disposed) fail('LSP_DISPOSED', 'client has been disposed');
    const child = spawn(this.command, this.args, { cwd: this.cwd, env: this.env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.process = child;
    child.stdout.on('data', (chunk) => this.#onData(chunk));
    child.stderr.on('data', (chunk) => { this.stderr = `${this.stderr}${chunk.toString('utf8')}`.slice(-32_768); });
    // A shutdown/dispose can race with an in-flight JSON-RPC write. Node
    // otherwise reports the resulting Windows EPIPE as an uncaught stream
    // error after the test/request has already completed.
    child.stdin.on('error', (error) => {
      if (this.disposed) return;
      this.#failAll(Object.assign(new Error(`LSP_WRITE_ERROR: ${error.message}`), { code: 'LSP_WRITE_ERROR' }));
    });
    child.on('error', (error) => this.#failAll(Object.assign(new Error(`LSP_PROCESS_ERROR: ${error.message}`), { code: 'LSP_PROCESS_ERROR' })));
    child.on('exit', (code, signal) => {
      this.process = null;
      if (!this.disposed && this.pending.size) this.#failAll(Object.assign(new Error(`LSP_PROCESS_EXIT: ${code ?? signal}: ${this.stderr}`), { code: 'LSP_PROCESS_EXIT' }));
    });
  }

  #failAll(error) {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.cleanup?.(); pending.reject(error); }
    this.pending.clear();
  }

  #onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (this.buffer.length > this.maxMessageBytes * 2) return this.#failAll(Object.assign(new Error('LSP_MESSAGE_LIMIT: buffered data exceeds limit'), { code: 'LSP_MESSAGE_LIMIT' }));
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) return;
      const header = this.buffer.subarray(0, headerEnd).toString('ascii');
      const match = header.match(/(?:^|\r\n)Content-Length:\s*(\d+)/i);
      if (!match) return this.#failAll(Object.assign(new Error('LSP_FRAME_INVALID: missing Content-Length'), { code: 'LSP_FRAME_INVALID' }));
      const length = Number(match[1]);
      if (!Number.isInteger(length) || length < 0 || length > this.maxMessageBytes) return this.#failAll(Object.assign(new Error(`LSP_MESSAGE_LIMIT: ${length}`), { code: 'LSP_MESSAGE_LIMIT' }));
      const end = headerEnd + 4 + length;
      if (this.buffer.length < end) return;
      const payload = this.buffer.subarray(headerEnd + 4, end);
      this.buffer = this.buffer.subarray(end);
      let message;
      try { message = JSON.parse(payload.toString('utf8')); } catch (error) { this.#failAll(Object.assign(new Error(`LSP_JSON_INVALID: ${error.message}`), { code: 'LSP_JSON_INVALID' })); continue; }
      this.#handle(message);
    }
  }

  #handle(message) {
    if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      pending.cleanup?.();
      if (message.error) pending.reject(Object.assign(new Error(`LSP_RESPONSE_ERROR: ${message.error.message ?? 'unknown error'}`), { code: 'LSP_RESPONSE_ERROR', data: message.error.data }));
      else pending.resolve(message.result);
      return;
    }
    if (message.method === 'textDocument/publishDiagnostics') {
      this.diagnosticMap.set(String(message.params?.uri ?? ''), freeze([...(message.params?.diagnostics ?? [])]));
    }
  }

  #send(message) {
    if (!this.process?.stdin?.writable) fail('LSP_NOT_RUNNING', 'language server is not running');
    const payload = Buffer.from(JSON.stringify(message));
    if (payload.length > this.maxMessageBytes) fail('LSP_MESSAGE_LIMIT', `outbound message is ${payload.length} bytes`);
    this.process.stdin.write(`Content-Length: ${payload.length}\r\n\r\n`);
    this.process.stdin.write(payload);
  }

  async request(method, params = {}, { signal, timeoutMs = this.timeoutMs } = {}) {
    await this.start();
    if (signal?.aborted) throw signal.reason ?? new Error('aborted');
    const id = this.nextId++;
    return await new Promise((resolve, reject) => {
      const cancel = () => {
        this.pending.delete(id);
        this.notify('$/cancelRequest', { id }).catch(() => undefined);
        reject(signal?.reason ?? Object.assign(new Error(`LSP_CANCELLED: ${method}`), { code: 'LSP_CANCELLED' }));
      };
      if (signal) signal.addEventListener('abort', cancel, { once: true });
      const timer = setTimeout(() => {
        this.pending.delete(id);
        if (signal) signal.removeEventListener('abort', cancel);
        this.notify('$/cancelRequest', { id }).catch(() => undefined);
        reject(Object.assign(new Error(`LSP_TIMEOUT: ${method} exceeded ${timeoutMs}ms`), { code: 'LSP_TIMEOUT' }));
      }, Math.max(20, Number(timeoutMs) || this.timeoutMs));
      this.pending.set(id, { resolve, reject, timer, cleanup: () => signal?.removeEventListener('abort', cancel) });
      try { this.#send({ jsonrpc: '2.0', id, method, params }); } catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }

  async notify(method, params = {}) {
    await this.start();
    this.#send({ jsonrpc: '2.0', method, params });
  }

  async initialize({ rootUri = null, capabilities = {}, workspaceFolders = null } = {}) {
    if (this.initialized) return this.serverInfo;
    const result = await this.request('initialize', { processId: process.pid, clientInfo: { name: 'Forge Studio', version: VERSION }, rootUri, capabilities, workspaceFolders });
    this.initialized = true;
    this.serverInfo = freeze(result ?? {});
    await this.notify('initialized', {});
    return this.serverInfo;
  }

  async openDocument({ uri, languageId, text, version = 1 }) {
    if (Buffer.byteLength(text) > this.maxMessageBytes / 2) fail('LSP_DOCUMENT_LIMIT', `document exceeds limit: ${uri}`);
    await this.notify('textDocument/didOpen', { textDocument: { uri, languageId, version, text } });
  }

  async workspaceSymbols(query) { return freeze([...(await this.request('workspace/symbol', { query }))]); }
  async definition({ uri, line, character }) {
    const result = await this.request('textDocument/definition', { textDocument: { uri }, position: { line, character } });
    return freeze(result ? (Array.isArray(result) ? result : [result]) : []);
  }
  async references({ uri, line, character, includeDeclaration = true }) {
    return freeze([...(await this.request('textDocument/references', { textDocument: { uri }, position: { line, character }, context: { includeDeclaration } }) ?? [])]);
  }
  async hover({ uri, line, character }) { return freeze(await this.request('textDocument/hover', { textDocument: { uri }, position: { line, character } }) ?? null); }
  async rename({ uri, line, character, newName }) { return freeze(await this.request('textDocument/rename', { textDocument: { uri }, position: { line, character }, newName: String(newName) }) ?? { changes: {} }); }
  async typeDefinition({ uri, line, character }) { const result = await this.request('textDocument/typeDefinition', { textDocument: { uri }, position: { line, character } }); return freeze(result ? (Array.isArray(result) ? result : [result]) : []); }
  async documentSymbols(uri) { return freeze([...(await this.request('textDocument/documentSymbol', { textDocument: { uri } }) ?? [])]); }
  diagnostics(uri) { return this.diagnosticMap.get(uri) ?? Object.freeze([]); }
  async callHierarchy({ uri, line, character }) {
    const items = [...(await this.request('textDocument/prepareCallHierarchy', { textDocument: { uri }, position: { line, character } }) ?? [])];
    const incoming = []; const outgoing = [];
    for (const item of items.slice(0, 32)) {
      incoming.push(...(await this.request('callHierarchy/incomingCalls', { item }) ?? []));
      outgoing.push(...(await this.request('callHierarchy/outgoingCalls', { item }) ?? []));
    }
    return freeze({ items, incoming, outgoing });
  }

  async shutdown() {
    if (!this.process) return;
    try { if (this.initialized) await this.request('shutdown', {}, { timeoutMs: Math.max(this.timeoutMs, 200) }); } catch {}
    try { await this.notify('exit', {}); } catch {}
    this.dispose();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.#failAll(Object.assign(new Error('LSP_DISPOSED: client disposed'), { code: 'LSP_DISPOSED' }));
    this.process?.kill('SIGKILL');
    this.process = null;
  }
}
