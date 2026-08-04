import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
};
const digest = (value) => sha256(JSON.stringify(canonical(value)));
const freeze = (value) => Object.freeze(value);

export class AcpStreamingRuntime {
  constructor({ handlers = {}, maxEvents = 2_000, clock = () => Date.now() } = {}) {
    this.handlers = new Map(Object.entries(handlers));
    this.maxEvents = Math.max(1, Math.min(20_000, Number(maxEvents) || 2_000));
    this.clock = clock;
    this.active = new Map();
    this.completed = new Map();
  }

  register(method, handler) {
    const id = String(method ?? '').trim();
    if (!id || typeof handler !== 'function') throw new TypeError('method and handler are required');
    if (this.handlers.has(id)) throw new Error(`ACP method already registered: ${id}`);
    this.handlers.set(id, handler);
  }

  async handle(request) {
    if (!request || request.jsonrpc !== '2.0') throw new TypeError('JSON-RPC 2.0 request is required');
    if (!['string', 'number'].includes(typeof request.id)) throw new TypeError('JSON-RPC request id is required');
    const id = String(request.id);
    const method = String(request.method ?? '').trim();
    if (!method) throw new TypeError('JSON-RPC method is required');
    if (this.completed.has(id)) return freeze({ ...this.completed.get(id), replayed: true });
    if (this.active.has(id)) throw new Error(`JSON-RPC request is already active: ${id}`);
    const handler = this.handlers.get(method);
    if (!handler) return freeze({ response: freeze({ jsonrpc: '2.0', id: request.id, error: freeze({ code: -32601, message: 'Method not found' }) }), events: freeze([]), replayed: false });

    const controller = new AbortController();
    const events = [];
    let head = '0'.repeat(64);
    const emit = (type, payload = {}) => {
      if (events.length >= this.maxEvents) throw new Error('ACP event budget exceeded');
      const base = { schema: 'nolane.acp.event.v1', requestId: id, sequence: events.length + 1, type: String(type), payload: canonical(payload), previousSha256: head, timestampMs: this.clock() };
      const event = freeze({ ...base, receiptSha256: digest(base) });
      head = event.receiptSha256;
      events.push(event);
      return event;
    };
    this.active.set(id, { controller, method, startedAtMs: this.clock() });
    let response;
    try {
      const result = await handler({ params: request.params ?? {}, emit, signal: controller.signal, request: canonical(request) });
      response = freeze({ jsonrpc: '2.0', id: request.id, result: canonical(result ?? null) });
    } catch (error) {
      const aborted = controller.signal.aborted || error?.code === 'ABORT_ERR';
      response = freeze({ jsonrpc: '2.0', id: request.id, error: freeze({ code: aborted ? -32800 : -32000, message: aborted ? 'Request cancelled' : String(error?.message ?? error), data: aborted ? freeze({ reason: controller.signal.reason ?? 'cancelled' }) : undefined }) });
    } finally {
      this.active.delete(id);
    }
    const outcome = freeze({ response, events: freeze([...events]), replayed: false, receiptSha256: digest({ response, eventHeadSha256: head }) });
    this.completed.set(id, outcome);
    return outcome;
  }

  cancel(requestId, reason = 'cancelled') {
    const id = String(requestId);
    const active = this.active.get(id);
    if (!active) return freeze({ requestId: id, cancelled: false, reason: 'not-active' });
    active.controller.abort(String(reason));
    return freeze({ requestId: id, cancelled: true, reason: String(reason) });
  }

  snapshot() {
    return freeze({ schema: 'nolane.acp.runtime-snapshot.v1', methods: freeze([...this.handlers.keys()].sort()), active: this.active.size, completed: this.completed.size });
  }
}
