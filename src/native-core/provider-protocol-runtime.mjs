import { createHash } from 'node:crypto';

const SUPPORTED = new Set(['openai-responses', 'openai-chat', 'anthropic-messages', 'gemini-content', 'local-openai']);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const freeze = (value) => Object.freeze(value);
const cleanMessages = (messages = []) => messages.map((message) => freeze({ role: String(message?.role ?? 'user'), content: typeof message?.content === 'string' ? message.content : JSON.stringify(message?.content ?? '') }));

function requestFor(protocol, messages, options) {
  if (protocol === 'openai-responses') return { input: messages, tools: options.tools ?? [], model: options.model ?? undefined };
  if (protocol === 'anthropic-messages') return { messages, tools: options.tools ?? [], model: options.model ?? undefined, max_tokens: options.maxTokens ?? 4_096 };
  if (protocol === 'gemini-content') return { contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })), tools: options.tools ?? [] };
  return { messages, tools: options.tools ?? [], model: options.model ?? undefined, stream: true };
}

export class ProviderProtocolRuntime {
  constructor({ clock = () => Date.now() } = {}) { this.clock = clock; this.providers = new Map(); }
  register({ id, protocol, credentialRef = null, transport, metadata = {} } = {}) {
    const providerId = String(id ?? '').trim();
    if (!providerId || typeof transport !== 'function') throw new TypeError('provider id and transport are required');
    if (!SUPPORTED.has(protocol)) throw new Error(`unsupported provider protocol: ${protocol}`);
    if (this.providers.has(providerId)) throw new Error(`provider already registered: ${providerId}`);
    this.providers.set(providerId, { id: providerId, protocol, credentialRef: credentialRef ? String(credentialRef) : null, transport, metadata: { ...metadata } });
    return freeze({ id: providerId, protocol });
  }
  async complete({ providerId, messages, tools = [], model = null, maxTokens = 4_096, signal = null } = {}) {
    const provider = this.providers.get(String(providerId));
    if (!provider) throw new Error(`unknown provider: ${providerId}`);
    const normalized = cleanMessages(messages);
    const request = requestFor(provider.protocol, normalized, { tools, model, maxTokens });
    const textParts = []; const calls = new Map(); let usage = { inputTokens: 0, outputTokens: 0 }; const events = [];
    const emit = (event = {}) => {
      if (signal?.aborted) throw Object.assign(new Error('provider request cancelled'), { code: 'ABORT_ERR' });
      const type = String(event.type ?? 'event');
      events.push(freeze({ sequence: events.length + 1, type, timestampMs: this.clock() }));
      if (type.includes('output_text.delta') || type === 'content_block_delta' || type === 'text-delta') textParts.push(String(event.delta ?? event.text ?? ''));
      if (type.includes('function_call_arguments.delta') || type === 'tool-call-delta') {
        const callId = String(event.callId ?? event.id ?? 'call');
        const current = calls.get(callId) ?? { id: callId, name: String(event.name ?? 'tool'), buffer: '' };
        current.name = String(event.name ?? current.name);
        current.buffer += String(event.delta ?? '');
        calls.set(callId, current);
      }
      if (event.usage) usage = { inputTokens: Number(event.usage.inputTokens ?? event.usage.input_tokens ?? event.usage.prompt_tokens ?? usage.inputTokens) || 0, outputTokens: Number(event.usage.outputTokens ?? event.usage.output_tokens ?? event.usage.completion_tokens ?? usage.outputTokens) || 0 };
    };
    await provider.transport({ request, emit, signal, credentialRef: provider.credentialRef });
    const toolCalls = [...calls.values()].map((call) => {
      let args; try { args = JSON.parse(call.buffer || '{}'); } catch { throw new Error(`invalid streamed tool arguments for ${call.id}`); }
      return freeze({ id: call.id, name: call.name, arguments: args });
    });
    const base = { schema: 'nolane.provider.protocol-result.v1', providerId: provider.id, protocol: provider.protocol, text: textParts.join(''), toolCalls, usage, events: events.length };
    return freeze({ ...base, receiptSha256: sha256(JSON.stringify(base)) });
  }
  snapshot() { return freeze({ schema: 'nolane.provider.protocol-snapshot.v1', providers: freeze([...this.providers.values()].map(({ id, protocol, metadata }) => freeze({ id, protocol, metadata: freeze({ ...metadata }) })).sort((a, b) => a.id.localeCompare(b.id))) }); }
}
