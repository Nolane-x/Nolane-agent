import { functionTool, normalizeMessages, parseArguments, postJson, required, resolveCredential, secureBaseUrl } from './http-provider-utils.mjs';
import { effortTransportForKind } from './provider-effort-metadata.mjs';

function reasoningEffort(value) {
  const effort = String(value ?? '').trim().toLowerCase();
  if (!effort) return null;
  if (effort.length > 64 || !/^[a-z0-9][a-z0-9._-]*$/.test(effort)) throw new TypeError('reasoning effort is invalid');
  return effort;
}

export class OpenAIResponsesProvider {
  constructor({ id, model, baseUrl = 'https://api.openai.com/v1', apiKey = null, credentialRef = null, credentialResolver = null, timeoutMs = 120_000, fetchImpl = fetch, profile = {} } = {}) {
    this.id = required(id, 'provider id'); this.kind = 'openai-responses'; this.model = required(model, 'model');
    this.baseUrl = secureBaseUrl(baseUrl, 'https://api.openai.com/v1'); this.url = `${this.baseUrl}/responses`;
    this.apiKey = apiKey == null ? null : String(apiKey); this.credentialRef = credentialRef; this.credentialResolver = credentialResolver;
    this.timeoutMs = Number(timeoutMs); this.fetchImpl = fetchImpl;
    this.profile = Object.freeze({ capabilities: Object.freeze([...(profile.capabilities ?? ['coding', 'tool-calling', 'structured-output', 'governed-actions'])]), qualityTier: Number(profile.qualityTier ?? 4.5), costTier: Number(profile.costTier ?? 2), latencyTier: Number(profile.latencyTier ?? 2), local: this.baseUrl.startsWith('http://localhost') || this.baseUrl.startsWith('http://127.0.0.1') });
  }
  publicView() { return Object.freeze({ id: this.id, kind: this.kind, label: 'OpenAI API', model: this.model, baseUrl: this.baseUrl, effort: effortTransportForKind(this.kind), ...this.profile }); }
  async detect() { try { await resolveCredential(this); return Object.freeze({ ...this.publicView(), available: true, authenticated: true, healthy: true }); } catch (error) { return Object.freeze({ ...this.publicView(), available: true, authenticated: false, healthy: false, error: String(error.message ?? error) }); } }
  async complete({ messages = [], tools = [], signal = null, model = this.model, effort = null } = {}) {
    const key = await resolveCredential(this); const clean = normalizeMessages(messages);
    const selectedEffort = reasoningEffort(effort);
    const instructions = clean.filter((item) => item.role === 'system' || item.role === 'developer').map((item) => item.content).join('\n\n');
    const input = clean.filter((item) => item.role !== 'system' && item.role !== 'developer').map((item) => ({ role: item.role === 'tool' ? 'user' : item.role, content: item.content }));
    const payload = await postJson({ url: this.url, headers: { authorization: `Bearer ${key}` }, body: { model, ...(instructions ? { instructions } : {}), input, ...(selectedEffort ? { reasoning: { effort: selectedEffort } } : {}), ...(tools.length ? { tools: tools.map((tool) => ({ type: 'function', ...functionTool(tool), strict: false })) } : {}), store: false }, timeoutMs: this.timeoutMs, signal, fetchImpl: this.fetchImpl, secretValues: [key] });
    const output = Array.isArray(payload.output) ? payload.output : [];
    const text = payload.output_text ?? output.flatMap((item) => item.type === 'message' ? (item.content ?? []).filter((part) => part.type === 'output_text' || part.type === 'text').map((part) => part.text ?? '') : []).join('');
    const toolCalls = output.filter((item) => item.type === 'function_call').map((item, index) => Object.freeze({ id: String(item.call_id ?? item.id ?? `call_${index + 1}`), name: required(item.name, 'tool call name'), arguments: parseArguments(item.arguments ?? '{}'), rawArguments: typeof item.arguments === 'string' ? item.arguments : JSON.stringify(item.arguments ?? {}) }));
    const usage = Object.freeze({ promptTokens: Number(payload.usage?.input_tokens ?? 0), completionTokens: Number(payload.usage?.output_tokens ?? 0), totalTokens: Number(payload.usage?.total_tokens ?? ((payload.usage?.input_tokens ?? 0) + (payload.usage?.output_tokens ?? 0))) });
    return Object.freeze({ providerId: this.id, model: payload.model ?? model, text: String(text ?? ''), toolCalls: Object.freeze(toolCalls), finishReason: payload.status ?? 'completed', usage, raw: payload });
  }
}
