import { repairToolArguments, sanitizeMessages } from '../agent/message-sanitization.mjs';
import { redactSecrets } from '../security/redaction.mjs';
import { providerFailure } from './http-provider-utils.mjs';

function required(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  return text;
}

function endpoint(baseUrl) {
  return `${required(baseUrl, 'baseUrl').replace(/\/+$/, '')}/chat/completions`;
}

export class OpenAICompatibleProvider {
  constructor({ id, baseUrl, apiKey = null, secretRef = null, credentialResolver = null, model, timeoutMs = 120_000, headers = {}, fetchImpl = fetch, profile = {} } = {}) {
    this.id = required(id, 'provider id');
    this.kind = 'openai-compatible';
    this.url = endpoint(baseUrl);
    this.apiKey = apiKey == null ? null : String(apiKey);
    this.secretRef = secretRef == null ? null : Object.freeze({ service: required(secretRef.service, 'secretRef.service'), account: required(secretRef.account, 'secretRef.account') });
    this.credentialResolver = credentialResolver;
    if (this.secretRef && typeof this.credentialResolver !== 'function') throw new TypeError('credentialResolver is required when secretRef is configured');
    this.model = required(model, 'model');
    this.timeoutMs = Number(timeoutMs);
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 10 || this.timeoutMs > 24 * 60 * 60_000) throw new TypeError('timeoutMs is invalid');
    this.headers = Object.fromEntries(Object.entries(headers).map(([key, value]) => [String(key), String(value)]));
    this.fetchImpl = fetchImpl;
    this.profile = Object.freeze({ capabilities: Object.freeze([...(profile.capabilities ?? ['coding', 'tool-calling', 'structured-output', 'governed-actions'])].map(String)), qualityTier: Number(profile.qualityTier ?? 4), costTier: Number(profile.costTier ?? 2), latencyTier: Number(profile.latencyTier ?? 2), local: profile.local === true || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/)/i.test(this.url) });
  }

  publicView() { return Object.freeze({ id: this.id, kind: this.kind, model: this.model, baseUrl: this.url.replace(/\/chat\/completions$/, ''), ...this.profile }); }

  async complete({ messages, tools = undefined, toolChoice = undefined, temperature = undefined, model = this.model, signal = null } = {}) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, this.timeoutMs);
    timer.unref?.();
    const onAbort = () => controller.abort();
    if (signal?.aborted) onAbort(); else signal?.addEventListener?.('abort', onAbort, { once: true });
    const body = { model, messages: sanitizeMessages(messages ?? []), stream: false };
    if (tools?.length) body.tools = tools;
    if (toolChoice !== undefined) body.tool_choice = toolChoice;
    if (temperature !== undefined) body.temperature = temperature;
    let resolvedApiKey;
    try { resolvedApiKey = this.secretRef ? await this.credentialResolver(this.secretRef) : this.apiKey; }
    catch (error) { throw providerFailure('Provider credential is unavailable', { code: 'PROVIDER_SETUP_REQUIRED', cause: error }); }
    if (this.secretRef && !resolvedApiKey) throw providerFailure('Provider credential is unavailable', { code: 'PROVIDER_SETUP_REQUIRED' });
    const requestSecrets = [resolvedApiKey].filter(Boolean).map(String);
    let response;
    try {
      response = await this.fetchImpl(this.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...(resolvedApiKey ? { authorization: `Bearer ${resolvedApiKey}` } : {}),
          ...this.headers,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut) throw providerFailure('Provider request timed out', { cause: error });
      if (signal?.aborted) throw providerFailure('Provider request cancelled', { cause: error });
      const safe = redactSecrets(String(error?.message ?? error), { secretValues: requestSecrets });
      throw providerFailure('Provider request failed', { cause: new Error(safe) });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', onAbort);
    }
    const raw = await response.text();
    let payload;
    try { payload = raw ? JSON.parse(raw) : {}; }
    catch { throw providerFailure('Provider returned an invalid response'); }
    if (!response.ok) throw providerFailure('Provider request was rejected', { cause: new Error(redactSecrets(`Model HTTP ${response.status}: ${payload?.error?.message ?? raw.slice(0, 500)}`, { secretValues: requestSecrets })) });
    const choice = payload.choices?.[0];
    if (!choice?.message) throw providerFailure('Provider returned an invalid response');
    let toolCalls;
    try {
      toolCalls = (choice.message.tool_calls ?? []).map((call, index) => ({
        id: String(call.id ?? `call_${index + 1}`),
        name: required(call.function?.name, 'tool call name'),
        arguments: repairToolArguments(call.function?.arguments ?? '{}'),
        rawArguments: String(call.function?.arguments ?? '{}'),
      }));
    } catch (error) {
      throw providerFailure('Provider returned an invalid response', { cause: error });
    }
    const usage = {
      promptTokens: Number(payload.usage?.prompt_tokens ?? 0),
      completionTokens: Number(payload.usage?.completion_tokens ?? 0),
      totalTokens: Number(payload.usage?.total_tokens ?? ((payload.usage?.prompt_tokens ?? 0) + (payload.usage?.completion_tokens ?? 0))),
    };
    return Object.freeze({
      providerId: this.id,
      model,
      text: typeof choice.message.content === 'string' ? choice.message.content : '',
      toolCalls: Object.freeze(toolCalls),
      finishReason: choice.finish_reason ?? null,
      usage: Object.freeze(usage),
      raw: payload,
    });
  }
}
