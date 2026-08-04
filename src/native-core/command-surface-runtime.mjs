import { createHash } from 'node:crypto';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const freeze = (value) => Object.freeze(value);
const stripAnsi = (value) => String(value).replace(/\u001B(?:\[[0-?]*[ -\/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g, '');
function sanitize(value, maxBytes) {
  if (typeof value === 'string') return Buffer.from(stripAnsi(value)).subarray(0, maxBytes).toString('utf8');
  if (Array.isArray(value)) return value.map((row) => sanitize(row, maxBytes));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, row]) => [key, sanitize(row, maxBytes)]));
  return value;
}
export class CommandSurfaceRuntime {
  constructor({ maxOutputBytes = 256_000, clock = () => Date.now() } = {}) { this.maxOutputBytes = Math.max(32, Math.min(5_000_000, Number(maxOutputBytes) || 256_000)); this.clock = clock; this.commands = new Map(); }
  register({ id, description = '', handler } = {}) { const key = String(id ?? '').trim(); if (!key || typeof handler !== 'function') throw new TypeError('command id and handler are required'); if (this.commands.has(key)) throw new Error(`command already registered: ${key}`); this.commands.set(key, { id: key, description: String(description), handler }); }
  list() { return freeze([...this.commands.values()].map(({ id, description }) => freeze({ id, description })).sort((a, b) => a.id.localeCompare(b.id))); }
  async execute({ command, args = [], surface = 'cli', principalId = null, signal = null } = {}) {
    const row = this.commands.get(String(command)); if (!row) throw new Error(`unknown command: ${command}`); if (!['cli', 'tui', 'web', 'electron'].includes(surface)) throw new Error(`unsupported command surface: ${surface}`);
    const events = []; const emit = (type, payload) => events.push(freeze({ sequence: events.length + 1, type: String(type), payload: sanitize(payload, this.maxOutputBytes), timestampMs: this.clock() }));
    const raw = await row.handler({ args: args.map(String), surface, principalId, signal, emit });
    const result = sanitize(raw ?? null, this.maxOutputBytes); const base = { schema: 'nolane.command-execution.v1', command: row.id, surface, result, events, timestampMs: this.clock() };
    return freeze({ ...base, events: freeze([...events]), receiptSha256: sha256(JSON.stringify(base)) });
  }
  snapshot() { return freeze({ schema: 'nolane.command-surface-snapshot.v1', commands: this.list(), surfaces: freeze(['cli', 'tui', 'web', 'electron']) }); }
}
