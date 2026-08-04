import { canonicalSha256 } from '../core/canonical-json.mjs';
import { PRODUCT } from '../core/constants.mjs';
import { assertNoSecrets, assertSafeValue } from '../core/security.mjs';
import { assertPrincipal, principalRecord } from '../core/principals.mjs';
import { assertSafeFederationUrl } from './canonical-source.mjs';

const PROTOCOL = '2025-11-25';
function tenantScope(principal, tenantId) { return principal.scopes?.includes('*') || principal.scopes?.includes(`tenant:${tenantId}`); }
function bounded(value, maxBytes) { assertSafeValue(value); const bytes = Buffer.byteLength(JSON.stringify(value)); if (bytes > maxBytes) throw new RangeError(`MCP tool output exceeds ${maxBytes} bytes`); return bytes; }
function withTimeout(promise, milliseconds, controller) {
  const signal = controller.signal;
  if (signal.aborted) return Promise.reject(signal.reason ?? new Error('MCP execution aborted'));
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      handler(value);
    };
    const onAbort = () => finish(reject, signal.reason ?? new Error('MCP execution aborted'));
    const timer = setTimeout(() => {
      const error = Object.assign(new Error('MCP tool execution timed out'), { code: 'MCP_TIMEOUT' });
      controller.abort(error);
      finish(reject, error);
    }, milliseconds);
    timer.unref?.();
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(promise).then((value) => finish(resolve, value), (error) => finish(reject, error));
  });
}

async function readRpcResponse(response, requestId, maxBytes = 1_000_000) {
  const contentType = String(response.headers?.get?.('content-type') ?? '').toLowerCase();
  if (!contentType.includes('text/event-stream')) return response.json();
  if (!response.body?.getReader) throw new Error('MCP SSE response body is unavailable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let bytes = 0;
  const inspect = async (frame) => {
    const data = frame.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
    if (!data || data === '[DONE]') return null;
    const parsed = JSON.parse(data);
    const messages = Array.isArray(parsed) ? parsed : [parsed];
    return messages.find((message) => message?.id === requestId) ?? null;
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (value) {
        bytes += value.byteLength;
        if (bytes > maxBytes) throw new RangeError(`MCP SSE response exceeds ${maxBytes} bytes`);
        buffer += decoder.decode(value, { stream: !done });
      }
      let boundary;
      while ((boundary = buffer.search(/\r?\n\r?\n/)) >= 0) {
        const separator = /^\r\n/.test(buffer.slice(boundary)) ? 4 : 2;
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + separator);
        const message = await inspect(frame);
        if (message) { await reader.cancel().catch(() => {}); return message; }
      }
      if (done) break;
    }
    const message = await inspect(buffer);
    if (message) return message;
    throw new Error(`MCP SSE stream ended without JSON-RPC response ${requestId}`);
  } finally {
    reader.releaseLock?.();
  }
}

export class McpBroker {
  constructor({ providerLoader, transportFactory, secretResolver = null, timeoutMs = 20_000, maxOutputBytes = 1_000_000, auditSink = null, clock = Date.now } = {}) {
    if (typeof providerLoader !== 'function') throw new TypeError('providerLoader is required');
    if (!transportFactory?.connect) throw new TypeError('transportFactory.connect is required');
    this.providerLoader = providerLoader; this.transportFactory = transportFactory; this.secretResolver = secretResolver;
    this.timeoutMs = timeoutMs; this.maxOutputBytes = maxOutputBytes; this.auditSink = auditSink; this.clock = clock;
  }
  async execute(input, { principal, signal } = {}) {
    assertPrincipal(principal);
    if(signal?.aborted)throw signal.reason ?? new Error('MCP execution aborted');
    const tenantId = String(input?.tenantId ?? '').trim(); if (!tenantId || !tenantScope(principal, tenantId)) throw new Error('Principal is not authorized for this tenant');
    assertSafeValue(input.arguments ?? {}); assertNoSecrets(input.arguments ?? {});
    const provider = (await this.providerLoader(tenantId)).find((item) => item.providerId === input.providerId);
    if (!provider || provider.kind !== 'mcp') throw new Error(`Unknown MCP provider: ${input.providerId}`);
    if (provider.status !== 'stable' || provider.trust?.blockers?.length || provider.scanReceipt?.status !== 'pass' || provider.scanReceipt?.providerDigest !== provider.providerDigest) throw new Error('MCP provider is not stable and currently trusted');
    const tool = provider.material?.server?.tools?.find((item) => item.name === input.toolName);
    if (!tool) throw new Error(`Tool ${input.toolName} is not declared by provider ${provider.providerId}`);
    const readOnly = tool.annotations?.readOnlyHint === true;
    if (!readOnly && (principal.type !== 'human' || !principal.roles?.some((role) => ['mcp-operator', 'federation-admin'].includes(role)))) throw new Error('Write-capable MCP tools require a human MCP operator');
    const headers = input.credentialRef ? await this.secretResolver?.resolve(input.credentialRef, { tenantId, providerId: provider.providerId, principal }) : {};
    if (input.credentialRef && !this.secretResolver) throw new Error('MCP credential resolver is not configured');
    const started = this.clock(); let transport; let output; let receipt = null; let status = 'pass'; let errorCode = null;
    const controller = new AbortController();
    const forwardAbort = () => controller.abort(signal?.reason ?? new Error('MCP execution aborted'));
    if (signal?.aborted) forwardAbort(); else signal?.addEventListener?.('abort', forwardAbort, { once: true });
    try {
      transport = await this.transportFactory.connect(provider, { headers: headers ?? {}, signal: controller.signal });
      output = await withTimeout(transport.callTool(tool.name, structuredClone(input.arguments ?? {}), { signal: controller.signal }), this.timeoutMs, controller);
      bounded(output, this.maxOutputBytes);
    } catch (error) { status = 'fail'; errorCode = error.code ?? 'MCP_EXECUTION_FAILED'; throw error; }
    finally {
      signal?.removeEventListener?.('abort', forwardAbort);
      try { await transport?.close(); } catch {}
      const receiptBase = {
        schemaVersion: 1, type: 'mcp-tool-execution', providerId: provider.providerId, providerDigest: provider.providerDigest,
        toolName: tool.name, readOnly, tenantId, principal: principalRecord(principal),
        inputSha256: canonicalSha256(input.arguments ?? {}), outputSha256: status === 'pass' && output !== undefined ? canonicalSha256(output) : null,
        status, errorCode, startedAt: new Date(started).toISOString(), completedAt: new Date(this.clock()).toISOString(),
      };
      receipt = { ...receiptBase, receiptSha256: canonicalSha256(receiptBase) };
      try { await this.auditSink?.record?.(receipt); } catch {}
    }
    return { output, receipt };
  }
}

export class StreamableHttpMcpTransportFactory {
  constructor({ fetchImpl = globalThis.fetch, protocolVersion = PROTOCOL, clientInfo = { name: 'forgeos-mcp-broker', version: PRODUCT.version } } = {}) {
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required'); this.fetchImpl = fetchImpl; this.protocolVersion = protocolVersion; this.clientInfo = clientInfo;
  }
  async connect(provider, { headers = {}, signal } = {}) {
    const remote = provider.material?.server?.remotes?.find((item) => ['streamable-http', 'streamable_http', 'http'].includes(String(item.type).toLowerCase()));
    if (!remote?.url) throw new Error('Provider has no Streamable HTTP remote');
    const endpoint = assertSafeFederationUrl(remote.url); let sessionId = null; let id = 0;
    const baseHeaders = { accept: 'application/json, text/event-stream', 'content-type': 'application/json', ...Object.fromEntries(Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), String(value)])) };
    const rpc = async (method, params, { notification = false } = {}) => {
      const request = { jsonrpc: '2.0', method, ...(params === undefined ? {} : { params }), ...(notification ? {} : { id: ++id }) };
      const requestHeaders = { ...baseHeaders, ...(sessionId ? { 'mcp-session-id': sessionId, 'mcp-protocol-version': this.protocolVersion } : {}) };
      const response = await this.fetchImpl(endpoint, { method: 'POST', headers: requestHeaders, body: JSON.stringify(request), signal });
      const created = response.headers?.get?.('mcp-session-id'); if (created) sessionId = created;
      if (!response.ok && !(notification && response.status === 202)) throw new Error(`MCP transport failed: ${response.status}`);
      if (notification || response.status === 202 || response.status === 204) return null;
      const body = await readRpcResponse(response, request.id); if (body.error) throw Object.assign(new Error(body.error.message ?? 'MCP protocol error'), { code: body.error.code }); return body.result;
    };
    const initialized = await rpc('initialize', { protocolVersion: this.protocolVersion, capabilities: {}, clientInfo: this.clientInfo });
    if (initialized?.protocolVersion !== this.protocolVersion || !sessionId) throw new Error('MCP server did not negotiate the required protocol/session');
    await rpc('notifications/initialized', undefined, { notification: true });
    return {
      callTool: (name, args) => rpc('tools/call', { name, arguments: args }),
      close: async () => {
        if (!sessionId) return;
        const requestHeaders = { ...baseHeaders, 'mcp-session-id': sessionId, 'mcp-protocol-version': this.protocolVersion };
        const response = await this.fetchImpl(endpoint, { method: 'DELETE', headers: requestHeaders });
        if (![204, 404].includes(response.status)) throw new Error(`MCP session termination failed: ${response.status}`);
        sessionId = null;
      },
    };
  }
}

export class EnvironmentSecretResolver {
  constructor({ allowedNames = [], environment = process.env } = {}) { this.allowed = new Set(allowedNames); this.environment = environment; }
  async resolve(reference) {
    const match = /^env:([A-Z][A-Z0-9_]{1,127})$/.exec(String(reference ?? ''));
    if (!match || !this.allowed.has(match[1])) throw new Error('Credential reference is not allowed');
    const value = this.environment[match[1]]; if (!value) throw new Error('Credential reference is unavailable');
    return { authorization: `Bearer ${value}` };
  }
}
