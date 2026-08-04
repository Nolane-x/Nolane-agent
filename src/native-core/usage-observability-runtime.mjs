import { createHash } from 'node:crypto';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const freeze = (value) => Object.freeze(value);
const round = (value) => Number(Number(value).toFixed(9));
export class UsageObservabilityRuntime {
  constructor({ pricing = {}, maxCostUsd = Infinity, clock = () => Date.now() } = {}) { this.pricing = { ...pricing }; this.maxCostUsd = Number.isFinite(Number(maxCostUsd)) ? Number(maxCostUsd) : Infinity; this.clock = clock; this.entries = []; this.head = '0'.repeat(64); this.totals = { inputTokens: 0, outputTokens: 0, tokens: 0, costUsd: 0, latencyMs: 0, attempts: 0 }; }
  record({ providerId, model, inputTokens = 0, outputTokens = 0, latencyMs = 0, status = 'ok' } = {}) {
    const price = this.pricing[String(model)] ?? { inputPerMillion: 0, outputPerMillion: 0 };
    const input = Math.max(0, Number(inputTokens) || 0); const output = Math.max(0, Number(outputTokens) || 0);
    const costUsd = round((input * Number(price.inputPerMillion || 0) + output * Number(price.outputPerMillion || 0)) / 1_000_000);
    if (round(this.totals.costUsd + costUsd) > this.maxCostUsd) throw new Error('cost budget exceeded');
    const base = { schema: 'nolane.usage-attempt.v1', sequence: this.entries.length + 1, providerId: String(providerId ?? ''), model: String(model ?? ''), inputTokens: input, outputTokens: output, costUsd, latencyMs: Math.max(0, Number(latencyMs) || 0), status: String(status), previousSha256: this.head, timestampMs: this.clock() };
    const entry = freeze({ ...base, receiptSha256: sha256(JSON.stringify(base)) }); this.head = entry.receiptSha256; this.entries.push(entry);
    this.totals = { inputTokens: this.totals.inputTokens + input, outputTokens: this.totals.outputTokens + output, tokens: this.totals.tokens + input + output, costUsd: round(this.totals.costUsd + costUsd), latencyMs: this.totals.latencyMs + base.latencyMs, attempts: this.totals.attempts + 1 };
    return entry;
  }
  snapshot() { const base = { schema: 'nolane.usage-observability-snapshot.v1', totals: { ...this.totals }, headSha256: this.head, attempts: this.entries.length }; return freeze({ ...base, totals: freeze(base.totals), receiptSha256: sha256(JSON.stringify(base)) }); }
}
