import { functionTool, normalizeMessages, postJson, required, resolveCredential, secureBaseUrl } from './http-provider-utils.mjs';
import { effortTransportForKind } from './provider-effort-metadata.mjs';

const EFFORT_LEVELS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
function outputEffort(value) {
  const effort = String(value ?? '').trim().toLowerCase();
  if (!effort) return null;
  if (!EFFORT_LEVELS.has(effort)) throw new TypeError('Unsupported Anthropic effort');
  return effort;
}

export class AnthropicMessagesProvider {
  constructor({ id, model, baseUrl = 'https://api.anthropic.com/v1', apiKey = null, credentialRef = null, credentialResolver = null, timeoutMs = 120_000, maxTokens = 8192, fetchImpl = fetch, profile = {} } = {}) {
    this.id = required(id, 'provider id'); this.kind = 'anthropic-messages'; this.model = required(model, 'model'); this.baseUrl = secureBaseUrl(baseUrl, 'https://api.anthropic.com/v1'); this.url = `${this.baseUrl}/messages`;
    this.apiKey = apiKey == null ? null : String(apiKey); this.credentialRef = credentialRef; this.credentialResolver = credentialResolver; this.timeoutMs = Number(timeoutMs); this.maxTokens = Number(maxTokens); this.fetchImpl = fetchImpl;
    this.profile = Object.freeze({ capabilities: Object.freeze([...(profile.capabilities ?? ['coding', 'tool-calling', 'structured-output', 'long-context', 'governed-actions'])]), qualityTier: Number(profile.qualityTier ?? 4.5), costTier: Number(profile.costTier ?? 2), latencyTier: Number(profile.latencyTier ?? 2), local: false });
  }
  publicView() { return Object.freeze({ id: this.id, kind: this.kind, label: 'Anthropic API', model: this.model, baseUrl: this.baseUrl, effort: effortTransportForKind(this.kind), ...this.profile }); }
  async detect() { try { await resolveCredential(this); return Object.freeze({ ...this.publicView(), available: true, authenticated: true, healthy: true }); } catch (error) { return Object.freeze({ ...this.publicView(), available: true, authenticated: false, healthy: false, error: String(error.message ?? error) }); } }
  async complete({ messages = [], tools = [], signal = null, model = this.model, effort = null } = {}) {
    const key = await resolveCredential(this); const clean = normalizeMessages(messages);
    const selectedEffort = outputEffort(effort);
    const system = clean.filter((item) => item.role === 'system' || item.role === 'developer').map((item) => item.content).join('\n\n');
    const conversation = clean.filter((item) => item.role !== 'system' && item.role !== 'developer').map((item) => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: item.content }));
    const payload = await postJson({ url: this.url, headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: { model, max_tokens: this.maxTokens, ...(system ? { system } : {}), messages: conversation, ...(selectedEffort ? { output_config: { effort: selectedEffort } } : {}), ...(tools.length ? { tools: tools.map((tool) => { const value = functionTool(tool); return { name: value.name, description: value.description, input_schema: value.parameters }; }) } : {}) }, timeoutMs: this.timeoutMs, signal, fetchImpl: this.fetchImpl, secretValues: [key] });
    const content = Array.isArray(payload.content) ? payload.content : [];
    const text = content.filter((part) => part.type === 'text').map((part) => part.text ?? '').join('');
    const toolCalls = content.filter((part) => part.type === 'tool_use').map((part, index) => Object.freeze({ id: String(part.id ?? `call_${index + 1}`), name: required(part.name, 'tool call name'), arguments: structuredClone(part.input ?? {}), rawArguments: JSON.stringify(part.input ?? {}) }));
    const promptTokens = Number(payload.usage?.input_tokens ?? 0); const completionTokens = Number(payload.usage?.output_tokens ?? 0);
    return Object.freeze({ providerId: this.id, model: payload.model ?? model, text, toolCalls: Object.freeze(toolCalls), finishReason: payload.stop_reason ?? null, usage: Object.freeze({ promptTokens, completionTokens, totalTokens: promptTokens + completionTokens }), raw: payload });
  }
}
