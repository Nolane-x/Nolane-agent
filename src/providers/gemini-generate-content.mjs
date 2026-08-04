import { functionTool, normalizeMessages, postJson, required, resolveCredential, secureBaseUrl } from './http-provider-utils.mjs';

export class GeminiGenerateContentProvider {
  constructor({ id, model, baseUrl = 'https://generativelanguage.googleapis.com/v1beta', apiKey = null, credentialRef = null, credentialResolver = null, timeoutMs = 120_000, fetchImpl = fetch, profile = {} } = {}) {
    this.id = required(id, 'provider id'); this.kind = 'gemini-generate-content'; this.model = required(model, 'model'); this.baseUrl = secureBaseUrl(baseUrl, 'https://generativelanguage.googleapis.com/v1beta'); this.url = `${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent`;
    this.apiKey = apiKey == null ? null : String(apiKey); this.credentialRef = credentialRef; this.credentialResolver = credentialResolver; this.timeoutMs = Number(timeoutMs); this.fetchImpl = fetchImpl;
    this.profile = Object.freeze({ capabilities: Object.freeze([...(profile.capabilities ?? ['coding', 'tool-calling', 'structured-output', 'long-context', 'governed-actions'])]), qualityTier: Number(profile.qualityTier ?? 4), costTier: Number(profile.costTier ?? 1), latencyTier: Number(profile.latencyTier ?? 1.5), local: false });
  }
  publicView() { return Object.freeze({ id: this.id, kind: this.kind, label: 'Google Gemini API', model: this.model, baseUrl: this.baseUrl, ...this.profile }); }
  async detect() { try { await resolveCredential(this); return Object.freeze({ ...this.publicView(), available: true, authenticated: true, healthy: true }); } catch (error) { return Object.freeze({ ...this.publicView(), available: true, authenticated: false, healthy: false, error: String(error.message ?? error) }); } }
  async complete({ messages = [], tools = [], signal = null } = {}) {
    const key = await resolveCredential(this); const clean = normalizeMessages(messages);
    const system = clean.filter((item) => item.role === 'system' || item.role === 'developer').map((item) => item.content).join('\n\n');
    const contents = clean.filter((item) => item.role !== 'system' && item.role !== 'developer').map((item) => ({ role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text: item.content }] }));
    const body = { contents, ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}), ...(tools.length ? { tools: [{ functionDeclarations: tools.map((tool) => { const value = functionTool(tool); return { name: value.name, description: value.description, parametersJsonSchema: value.parameters }; }) }] } : {}) };
    const payload = await postJson({ url: this.url, headers: { 'x-goog-api-key': key }, body, timeoutMs: this.timeoutMs, signal, fetchImpl: this.fetchImpl, secretValues: [key] });
    const candidate = payload.candidates?.[0] ?? {}; const parts = candidate.content?.parts ?? [];
    const text = parts.filter((part) => typeof part.text === 'string').map((part) => part.text).join('');
    const toolCalls = parts.filter((part) => part.functionCall).map((part, index) => Object.freeze({ id: String(part.functionCall.id ?? `call_${index + 1}`), name: required(part.functionCall.name, 'tool call name'), arguments: structuredClone(part.functionCall.args ?? {}), rawArguments: JSON.stringify(part.functionCall.args ?? {}) }));
    const usage = payload.usageMetadata ?? {};
    return Object.freeze({ providerId: this.id, model: payload.modelVersion ?? this.model, text, toolCalls: Object.freeze(toolCalls), finishReason: candidate.finishReason ?? null, usage: Object.freeze({ promptTokens: Number(usage.promptTokenCount ?? 0), completionTokens: Number(usage.candidatesTokenCount ?? 0), totalTokens: Number(usage.totalTokenCount ?? ((usage.promptTokenCount ?? 0) + (usage.candidatesTokenCount ?? 0))) }), raw: payload });
  }
}
