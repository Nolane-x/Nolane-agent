const redact = (value) => String(value ?? '').replace(/(?:sk|key|token)-[A-Za-z0-9._-]+/gi, '[REDACTED]').slice(0, 300);
const SUPPORTED = new Set(['text', 'tools', 'structuredOutput', 'streaming']);

export class ModelCapabilityProbeService {
  constructor({ getProvider, clock = () => new Date().toISOString(), now = () => Date.now() } = {}) {
    if (typeof getProvider !== 'function') throw new TypeError('getProvider is required');
    this.getProvider = getProvider;
    this.clock = clock;
    this.now = now;
  }

  async probe({ providerId, modelId, probes = ['text', 'tools', 'structuredOutput'], provider: providerOverride = null } = {}) {
    const provider = providerOverride ?? this.getProvider(providerId);
    const started = this.now();
    const capabilities = {};
    const errors = [];
    for (const name of [...new Set(probes.map(String))].filter((item) => SUPPORTED.has(item))) {
      try {
        if (name === 'text') {
          const result = await provider.complete({ model: modelId, messages: [{ role: 'user', content: 'Reply with exactly OK.' }], tools: [] });
          capabilities.text = typeof result?.text === 'string';
        }
        if (name === 'tools') {
          const result = await provider.complete({
            model: modelId,
            messages: [{ role: 'user', content: 'Call echo with value ok.' }],
            tools: [{ name: 'echo', description: 'Echo value', parameters: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] } }],
          });
          capabilities.tools = Array.isArray(result?.toolCalls) && result.toolCalls.length > 0;
        }
        if (name === 'structuredOutput') {
          const result = await provider.complete({
            model: modelId,
            messages: [{ role: 'user', content: 'Return an object with ok=true.' }],
            tools: [],
            responseFormat: {
              type: 'json_schema',
              json_schema: {
                name: 'probe',
                schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false },
              },
            },
          });
          capabilities.structuredOutput = Boolean(result);
        }
        if (name === 'streaming') capabilities.streaming = typeof provider.stream === 'function';
      } catch (error) {
        const message = redact(error?.message ?? error);
        const unsupported = [400, 404, 405, 422].includes(Number(error?.statusCode ?? error?.status));
        capabilities[name] = unsupported ? false : 'unknown';
        errors.push({ probe: name, code: unsupported ? 'unsupported' : 'error', message });
      }
    }
    return Object.freeze({ providerId, modelId, testedAt: this.clock(), durationMs: Math.max(0, this.now() - started), capabilities: Object.freeze(capabilities), errors: Object.freeze(errors) });
  }
}
