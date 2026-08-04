import { createHash } from 'node:crypto';

const PROTOCOLS = new Set(['openai-responses', 'openai-chat', 'anthropic-messages', 'gemini-native', 'bedrock-messages', 'azure-openai', 'codex-app-server', 'local-openai', 'mcp-tools-server', 'proxy-source']);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, canonical(value[key])]));
  return value;
};
const frozen = (value) => Object.freeze(value);
const clone = (value) => structuredClone(value);

export class ProviderError extends Error {
  constructor(message, { code = 'PROVIDER_ERROR', retryable = false, retryAfterMs = 0, statusCode = null, cause = undefined } = {}) {
    super(message, { cause }); this.name = 'ProviderError'; this.code = String(code); this.retryable = Boolean(retryable); this.retryAfterMs = Math.max(0, Number(retryAfterMs) || 0); this.statusCode = statusCode == null ? null : Number(statusCode);
  }
}

function normalizeError(error) {
  if (error instanceof ProviderError) return error;
  if (error?.name === 'AbortError' || error?.code === 'ABORT_ERR') return new ProviderError('Provider request cancelled', { code: 'ABORT_ERR', retryable: false, cause: error });
  const status = Number(error?.statusCode ?? error?.status ?? 0);
  if (status === 429) return new ProviderError(String(error?.message ?? 'Rate limited'), { code: 'RATE_LIMITED', retryable: true, retryAfterMs: Number(error?.retryAfterMs ?? 0), statusCode: status, cause: error });
  if (status >= 500) return new ProviderError(String(error?.message ?? 'Provider unavailable'), { code: 'PROVIDER_UNAVAILABLE', retryable: true, statusCode: status, cause: error });
  return new ProviderError(String(error?.message ?? error), { code: String(error?.code ?? 'PROVIDER_ERROR'), retryable: Boolean(error?.retryable), cause: error });
}

function normalizedMessages(messages = []) {
  if (!Array.isArray(messages)) throw new TypeError('messages must be an array');
  return messages.map((message) => ({ role: String(message?.role ?? 'user'), content: clone(message?.content ?? '') }));
}

function buildRequest(provider, input) {
  const base = { protocol: provider.protocol, model: input.model == null ? undefined : String(input.model), messages: normalizedMessages(input.messages), tools: clone(input.tools ?? []), stream: true };
  if (provider.schemaVersion >= 2) {
    base.responseSchema = clone(input.responseSchema ?? undefined);
    base.reasoning = clone(input.reasoning ?? undefined);
  }
  return canonical(base);
}

export class ProviderTransportRuntimeWave9 {
  constructor({ maxAttempts = 3, clock = () => Date.now() } = {}) {
    this.maxAttempts = Math.max(1, Math.min(10, Number(maxAttempts) || 3));
    this.clock = clock;
    this.providers = new Map();
  }

  register({ id, protocol, credentialRefs = [], transport, schemaVersion = 2, metadata = {} } = {}) {
    const providerId = String(id ?? '').trim();
    if (!providerId || typeof transport !== 'function') throw new TypeError('provider id and transport are required');
    if (!PROTOCOLS.has(protocol)) throw new TypeError(`unsupported provider protocol: ${protocol}`);
    if (this.providers.has(providerId)) throw new Error(`provider already registered: ${providerId}`);
    const provider = { id: providerId, protocol, credentialRefs: [...new Set((credentialRefs ?? []).map(String))], transport, schemaVersion: Math.max(1, Number(schemaVersion) || 1), metadata: canonical(metadata), cursor: 0 };
    this.providers.set(providerId, provider);
    return frozen({ id: providerId, protocol, schemaVersion: provider.schemaVersion, credentialCount: provider.credentialRefs.length });
  }

  async complete({ providerId, messages = [], tools = [], model = null, responseSchema = undefined, reasoning = undefined, signal = null } = {}) {
    const provider = this.providers.get(String(providerId));
    if (!provider) throw new ProviderError(`unknown provider: ${providerId}`, { code: 'PROVIDER_NOT_FOUND' });
    if (signal?.aborted) throw new ProviderError('Provider request cancelled', { code: 'ABORT_ERR' });
    const request = buildRequest(provider, { messages, tools, model, responseSchema, reasoning });
    const credentialPool = provider.credentialRefs.length ? provider.credentialRefs : [null];
    let lastError = null;
    const maxAttempts = this.maxAttempts;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (signal?.aborted) throw new ProviderError('Provider request cancelled', { code: 'ABORT_ERR' });
      const credentialIndex = (provider.cursor + attempt) % credentialPool.length;
      const credentialRef = credentialPool[credentialIndex];
      const text = []; const toolBuffers = new Map(); const events = [];
      let usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
      const emit = (event = {}) => {
        if (signal?.aborted) throw new ProviderError('Provider request cancelled', { code: 'ABORT_ERR' });
        const type = String(event.type ?? 'event');
        events.push({ sequence: events.length + 1, type, timestampMs: Number(this.clock()) });
        if (['text-delta', 'output_text.delta', 'content_block_delta'].includes(type)) text.push(String(event.delta ?? event.text ?? ''));
        if (['tool-call-delta', 'function_call_arguments.delta'].includes(type)) {
          const id = String(event.id ?? event.callId ?? 'call');
          const current = toolBuffers.get(id) ?? { id, name: String(event.name ?? 'tool'), buffer: '' };
          if (event.name) current.name = String(event.name);
          current.buffer += String(event.delta ?? ''); toolBuffers.set(id, current);
        }
        if (type === 'usage' || event.usage) {
          const source = event.usage ?? event;
          usage = { inputTokens: Number(source.inputTokens ?? source.input_tokens ?? source.prompt_tokens ?? usage.inputTokens) || 0, outputTokens: Number(source.outputTokens ?? source.output_tokens ?? source.completion_tokens ?? usage.outputTokens) || 0, costUsd: Number(source.costUsd ?? source.cost_usd ?? usage.costUsd) || 0 };
        }
      };
      try {
        await provider.transport({ request: clone(request), emit, signal, credentialRef, protocol: provider.protocol, attempt: attempt + 1 });
        const toolCalls = [...toolBuffers.values()].map((entry) => {
          let args;
          try { args = JSON.parse(entry.buffer || '{}'); }
          catch (error) { throw new ProviderError(`Invalid streamed tool arguments for ${entry.id}`, { code: 'INVALID_TOOL_ARGUMENTS', retryable: false, cause: error }); }
          return frozen({ id: entry.id, name: entry.name, arguments: canonical(args) });
        });
        provider.cursor = (credentialIndex + 1) % credentialPool.length;
        const base = { schema: 'nolane.provider-transport-wave9-result.v1', providerId: provider.id, protocol: provider.protocol, text: text.join(''), toolCalls, usage: frozen(usage), events: events.length, attempts: attempt + 1, requestSha256: sha256(JSON.stringify(canonical(request))) };
        return frozen({ ...base, receiptSha256: sha256(JSON.stringify(canonical(base))) });
      } catch (error) {
        const normalized = normalizeError(error); lastError = normalized;
        if (normalized.code === 'ABORT_ERR' || !normalized.retryable || attempt + 1 >= maxAttempts) throw normalized;
      }
    }
    throw lastError ?? new ProviderError('Provider request failed', { code: 'PROVIDER_ERROR' });
  }

  snapshot() {
    return frozen({ schema: 'nolane.provider-transport-runtime-wave9.v1', providers: frozen([...this.providers.values()].map((provider) => frozen({ id: provider.id, protocol: provider.protocol, schemaVersion: provider.schemaVersion, credentialCount: provider.credentialRefs.length, metadata: frozen(clone(provider.metadata)) })).sort((a, b) => a.id.localeCompare(b.id))), supportedProtocols: frozen([...PROTOCOLS].sort()) });
  }
}
