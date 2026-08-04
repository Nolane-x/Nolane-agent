import { createHash } from 'node:crypto';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const freeze = (value) => Object.freeze(value);
const ACTIONS = new Set(['open', 'snapshot', 'click', 'press', 'tabs', 'screenshot', 'status', 'close']);
const MUTATING = new Set(['click', 'press', 'close']);
function bounded(value, maxBytes) {
  const text = JSON.stringify(value ?? null);
  if (Buffer.byteLength(text) <= maxBytes) return { value, outputBytes: Buffer.byteLength(text), truncated: false };
  const preview = Buffer.from(text).subarray(0, Math.max(0, maxBytes - 32)).toString('utf8');
  const result = { truncated: true, preview };
  return { value: result, outputBytes: Math.min(maxBytes, Buffer.byteLength(JSON.stringify(result))), truncated: true };
}
export class BrowserComputerUseFabric {
  constructor({ browser, approval = async () => ({ approved: false }), maxOutputBytes = 256_000, clock = () => Date.now() } = {}) {
    if (!browser) throw new TypeError('browser service is required'); this.browser = browser; this.approval = approval; this.maxOutputBytes = Math.max(64, Math.min(5_000_000, Number(maxOutputBytes) || 256_000)); this.clock = clock; this.searchProviders = new Map();
  }
  async execute(input = {}) {
    const action = String(input.action ?? ''); if (!ACTIONS.has(action) || typeof this.browser[action] !== 'function') throw new Error(`unsupported browser action: ${action}`);
    let approvalReceipt = null;
    if (MUTATING.has(action)) { approvalReceipt = await this.approval({ action, projectId: input.projectId, goalId: input.goalId ?? null, target: input.target ?? null }); if (!approvalReceipt?.approved) throw new Error(`browser action approval denied: ${action}`); }
    const output = await this.browser[action]({ ...input, action: undefined });
    const limited = bounded(output, this.maxOutputBytes);
    const base = { schema: 'nolane.browser-action-receipt.v1', action, projectId: String(input.projectId ?? ''), timestampMs: this.clock(), approval: approvalReceipt ? { approved: true, approver: String(approvalReceipt.approver ?? 'unknown') } : null, output: limited.value, outputBytes: limited.outputBytes, truncated: limited.truncated };
    return freeze({ ...base, receiptSha256: sha256(JSON.stringify(base)) });
  }

  registerSearchProvider({ id, credentialRef = null, search } = {}) {
    const key = String(id ?? '').trim();
    if (!key || typeof search !== 'function') throw new TypeError('search provider id and search are required');
    if (this.searchProviders.has(key)) throw new Error(`search provider already registered: ${key}`);
    this.searchProviders.set(key, { id: key, credentialRef: credentialRef ? String(credentialRef) : null, search });
    return freeze({ id: key });
  }
  async searchWeb({ query, limit = 10, providerId = null, signal = null } = {}) {
    const q = String(query ?? '').trim(); if (!q) throw new TypeError('query is required');
    const providers = providerId ? [this.searchProviders.get(String(providerId))].filter(Boolean) : [...this.searchProviders.values()];
    if (!providers.length) throw new Error('no web search provider is registered');
    const boundedLimit = Math.max(1, Math.min(50, Number(limit) || 10));
    const provider = providers[0];
    const rows = await provider.search({ query: q, limit: boundedLimit, signal, credentialRef: provider.credentialRef });
    const items = (Array.isArray(rows) ? rows : []).slice(0, boundedLimit).map((row) => freeze({ title: String(row?.title ?? '').slice(0, 500), url: String(row?.url ?? '').slice(0, 2_000), snippet: String(row?.snippet ?? '').slice(0, 2_000) }));
    const base = { schema: 'nolane.web-search-result.v1', providerId: provider.id, query: q, items };
    return freeze({ ...base, items: freeze(items), receiptSha256: sha256(JSON.stringify(base)) });
  }
  snapshot() { return freeze({ schema: 'nolane.browser-fabric-snapshot.v1', actions: freeze([...ACTIONS].sort()), searchProviders: freeze([...this.searchProviders.keys()].sort()), maxOutputBytes: this.maxOutputBytes }); }
}
