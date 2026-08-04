export class BudgetExceededError extends Error {
  constructor(kind, limit, observed) {
    super(`Run ${kind} budget exceeded: limit ${limit}, observed ${observed}`);
    this.name = 'BudgetExceededError';
    this.kind = kind;
    this.limit = limit;
    this.observed = observed;
  }
}

function limit(value, fallback, label) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(number) || number < 0) throw new TypeError(`${label} must be a non-negative number`);
  return number;
}

export class RunBudget {
  constructor({ maxTurns = 24, maxToolCalls = 64, maxEstimatedTokens = 240_000, maxElapsedMs = 20 * 60_000, signal = null, now = () => Date.now() } = {}) {
    this.limits = Object.freeze({
      maxTurns: limit(maxTurns, 24, 'maxTurns'),
      maxToolCalls: limit(maxToolCalls, 64, 'maxToolCalls'),
      maxEstimatedTokens: limit(maxEstimatedTokens, 240_000, 'maxEstimatedTokens'),
      maxElapsedMs: limit(maxElapsedMs, 20 * 60_000, 'maxElapsedMs'),
    });
    this.signal = signal;
    this.now = now;
    this.startedAtMs = now();
    this.turns = 0;
    this.toolCalls = 0;
    this.estimatedTokens = 0;
  }

  assertActive() {
    if (this.signal?.aborted) throw new BudgetExceededError('cancelled', 0, 1);
    const elapsed = this.now() - this.startedAtMs;
    if (elapsed > this.limits.maxElapsedMs) throw new BudgetExceededError('elapsed-time', this.limits.maxElapsedMs, elapsed);
    return this.snapshot();
  }

  consumeTurn(count = 1) {
    this.assertActive();
    const next = this.turns + Number(count);
    if (next > this.limits.maxTurns) throw new BudgetExceededError('turn', this.limits.maxTurns, next);
    this.turns = next;
    return this.snapshot();
  }

  consumeToolCalls(count = 1) {
    this.assertActive();
    const next = this.toolCalls + Number(count);
    if (next > this.limits.maxToolCalls) throw new BudgetExceededError('tool-call', this.limits.maxToolCalls, next);
    this.toolCalls = next;
    return this.snapshot();
  }

  consumeTokens(count = 0) {
    this.assertActive();
    const next = this.estimatedTokens + Number(count);
    if (next > this.limits.maxEstimatedTokens) throw new BudgetExceededError('token', this.limits.maxEstimatedTokens, next);
    this.estimatedTokens = next;
    return this.snapshot();
  }

  snapshot() {
    return Object.freeze({
      ...this.limits,
      turns: this.turns,
      toolCalls: this.toolCalls,
      estimatedTokens: this.estimatedTokens,
      elapsedMs: Math.max(0, this.now() - this.startedAtMs),
    });
  }
}
