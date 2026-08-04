const TERMINAL = new Set(['completed', 'cancelled', 'failed']);
const TRANSITIONS = Object.freeze({
  created: new Set(['planning', 'cancelled', 'failed']),
  planning: new Set(['model', 'cancelled', 'failed']),
  model: new Set(['tool', 'verifying', 'cancelled', 'failed']),
  tool: new Set(['model', 'verifying', 'cancelled', 'failed']),
  verifying: new Set(['model', 'completed', 'cancelled', 'failed']),
  completed: new Set(),
  cancelled: new Set(),
  failed: new Set(),
});

const positiveInteger = (value, fallback) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
const freeze = (value) => {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, freeze(entry)])));
  return value;
};

export class TurnStateMachine {
  constructor({ missionId, budgets = {}, clock = () => Date.now() } = {}) {
    if (!missionId) throw new TypeError('missionId is required');
    this.missionId = String(missionId);
    this.clock = clock;
    this.state = 'created';
    this.limits = Object.freeze({
      model: positiveInteger(budgets.maxModelTurns, positiveInteger(budgets.maxTurns, 20)),
      tool: positiveInteger(budgets.maxToolTurns, positiveInteger(budgets.maxTurns, 20)),
      retry: positiveInteger(budgets.maxRetries, 3),
    });
    this.counters = { model: 0, tool: 0, retry: 0 };
    this.history = [];
  }

  transition(next, metadata = {}) {
    if (!TRANSITIONS[this.state]?.has(next)) throw new Error(`Illegal transition: ${this.state} -> ${next}`);
    const event = freeze({ from: this.state, to: next, at: Number(metadata.at ?? this.clock()), reason: metadata.reason ?? null });
    this.history.push(event);
    this.state = next;
    return event;
  }

  consume(kind) {
    if (!Object.hasOwn(this.counters, kind)) throw new Error(`Unknown runtime budget: ${kind}`);
    if (TERMINAL.has(this.state)) throw new Error(`Cannot consume ${kind} budget in terminal state ${this.state}`);
    if (this.counters[kind] >= this.limits[kind]) throw new Error(`${kind} budget exhausted (${this.limits[kind]})`);
    this.counters[kind] += 1;
    return freeze({ kind, used: this.counters[kind], limit: this.limits[kind], remaining: this.limits[kind] - this.counters[kind] });
  }

  snapshot() {
    return freeze({
      schema: 'nolane.native-core.turn-state.v1',
      missionId: this.missionId,
      state: this.state,
      terminal: TERMINAL.has(this.state),
      limits: { ...this.limits },
      counters: { ...this.counters },
      history: [...this.history],
    });
  }
}
