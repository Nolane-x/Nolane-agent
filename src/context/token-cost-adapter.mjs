function cleanId(value) {
  const output = String(value ?? '').trim();
  if (!output) throw new TypeError('tokenizerId is required');
  if (output.length > 256) throw new TypeError('tokenizerId is too long');
  return output;
}

function assertSignal(signal) {
  if (signal?.aborted) throw signal.reason ?? Object.assign(new Error('token counting aborted'), { code: 'TOKEN_COUNT_ABORTED' });
}

function normalizeCount(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0) throw new TypeError('tokenizer returned an invalid token count');
  return count;
}

function freezeResult(tokens, tokenizerId, degraded) {
  return Object.freeze({
    tokens,
    method: degraded ? 'deterministic-fallback' : 'provider-tokenizer',
    tokenizerId,
    degraded,
  });
}

function fallbackCount(text) {
  const bytes = Buffer.byteLength(String(text ?? ''), 'utf8');
  return Math.max(1, Math.ceil(bytes / 4));
}

export class TokenCostAdapter {
  constructor({ tokenizers = {} } = {}) {
    this.tokenizers = new Map();
    for (const [id, tokenizer] of Object.entries(tokenizers)) this.register(id, tokenizer);
  }

  register(tokenizerId, tokenizer) {
    const id = cleanId(tokenizerId);
    if (!tokenizer || (typeof tokenizer.count !== 'function' && typeof tokenizer.countBatch !== 'function')) {
      throw new TypeError('tokenizer must expose count or countBatch');
    }
    this.tokenizers.set(id, tokenizer);
    return this;
  }

  async count(text, harnessProfile = {}, { signal } = {}) {
    assertSignal(signal);
    const requestedId = String(harnessProfile?.tokenizerId ?? '').trim();
    const tokenizer = requestedId ? this.tokenizers.get(requestedId) : null;
    if (!tokenizer) return freezeResult(fallbackCount(text), 'forge-utf8-quarter-v1', true);
    let tokens;
    if (typeof tokenizer.count === 'function') tokens = await tokenizer.count(String(text ?? ''), { signal, harnessProfile });
    else tokens = (await tokenizer.countBatch([String(text ?? '')], { signal, harnessProfile }))[0];
    assertSignal(signal);
    return freezeResult(normalizeCount(tokens), requestedId, false);
  }

  async countBatch(texts, harnessProfile = {}, { signal } = {}) {
    if (!Array.isArray(texts)) throw new TypeError('texts must be an array');
    assertSignal(signal);
    const requestedId = String(harnessProfile?.tokenizerId ?? '').trim();
    const tokenizer = requestedId ? this.tokenizers.get(requestedId) : null;
    if (!tokenizer) return Object.freeze(texts.map((text) => freezeResult(fallbackCount(text), 'forge-utf8-quarter-v1', true)));
    let counts;
    if (typeof tokenizer.countBatch === 'function') counts = await tokenizer.countBatch(texts.map((text) => String(text ?? '')), { signal, harnessProfile });
    else counts = await Promise.all(texts.map((text) => tokenizer.count(String(text ?? ''), { signal, harnessProfile })));
    assertSignal(signal);
    if (!Array.isArray(counts) || counts.length !== texts.length) throw new TypeError('tokenizer returned an invalid token count batch');
    return Object.freeze(counts.map((count) => freezeResult(normalizeCount(count), requestedId, false)));
  }
}
