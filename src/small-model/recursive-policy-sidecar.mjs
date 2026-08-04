import { canonicalSha256, deepFreeze, boundedNumber, clone } from './shared.mjs';

const PUZZLE_DOMAINS = new Set(['arc', 'sudoku', 'maze', 'logic-puzzle', 'grid-puzzle']);

function validateState(state, size) {
  if (!Array.isArray(state) || state.length !== size || state.some((value) => !Number.isFinite(Number(value)))) {
    throw new TypeError(`Recurrent state size must equal ${size}`);
  }
  return state.map(Number);
}

function maxDelta(a, b) {
  let delta = 0;
  for (let i = 0; i < a.length; i += 1) delta = Math.max(delta, Math.abs(a[i] - b[i]));
  return delta;
}

export class RecursivePolicySidecar {
  #stateSize;
  #minDepth;
  #maxDepth;
  #confidenceThreshold;
  #convergenceEpsilon;
  #collapsePatience;
  #runs = 0;

  constructor({ stateSize = 8, minDepth = 2, maxDepth = 12, confidenceThreshold = 0.8, convergenceEpsilon = 1e-3, collapsePatience = 3 } = {}) {
    if (!Number.isInteger(stateSize) || stateSize < 1) throw new TypeError('stateSize must be a positive integer');
    if (!Number.isInteger(minDepth) || !Number.isInteger(maxDepth) || minDepth < 1 || maxDepth < minDepth) throw new TypeError('Invalid recursive depth range');
    if (!Number.isInteger(collapsePatience) || collapsePatience < 1) throw new TypeError('collapsePatience must be positive');
    this.#stateSize = stateSize;
    this.#minDepth = minDepth;
    this.#maxDepth = maxDepth;
    this.#confidenceThreshold = boundedNumber(confidenceThreshold, 'confidenceThreshold');
    this.#convergenceEpsilon = Number(convergenceEpsilon);
    this.#collapsePatience = collapsePatience;
  }

  depthBudget({ taskDifficulty = 0 } = {}) {
    const difficulty = boundedNumber(taskDifficulty, 'taskDifficulty');
    return Math.round(this.#minDepth + difficulty * (this.#maxDepth - this.#minDepth));
  }

  run({ initialState, policy, fallback = null, taskDifficulty = 0 } = {}) {
    if (typeof policy !== 'function') throw new TypeError('Recursive policy function is required');
    let state = validateState(initialState, this.#stateSize);
    const budget = this.depthBudget({ taskDifficulty });
    let noProgress = 0;
    let action = null;
    let haltingReason = 'budget-exhausted';
    let fallbackUsed = false;
    let depth = 0;
    const trace = [];

    for (depth = 1; depth <= budget; depth += 1) {
      const output = policy({ state: [...state], depth, budget });
      if (!output || typeof output !== 'object') throw new TypeError('Recursive policy output is required');
      const nextState = validateState(output.state, this.#stateSize);
      const delta = maxDelta(state, nextState);
      const confidence = boundedNumber(output.confidence ?? 0, 'policy confidence');
      const progress = Number(output.progress ?? 0);
      if (!Number.isFinite(progress)) throw new TypeError('policy progress must be finite');
      action = output.action ?? action;
      noProgress = progress > 0 ? 0 : noProgress + 1;
      trace.push({ depth, delta, confidence, progress, stateSha256: canonicalSha256(nextState) });
      state = nextState;

      if (noProgress >= this.#collapsePatience) {
        haltingReason = 'collapse';
        break;
      }
      if (depth >= this.#minDepth && delta <= this.#convergenceEpsilon && confidence >= this.#confidenceThreshold) {
        haltingReason = 'converged';
        break;
      }
    }

    if ((haltingReason === 'collapse' || haltingReason === 'budget-exhausted') && typeof fallback === 'function') {
      action = fallback({ stateSha256: canonicalSha256(state), haltingReason, depth: Math.min(depth, budget) });
      fallbackUsed = true;
    }

    this.#runs += 1;
    const finalDepth = Math.min(depth, budget);
    const base = {
      schema: 'nolane.small-model.recursive-policy-receipt.v1', stateSize: this.#stateSize,
      depth: finalDepth, depthBudget: budget, haltingReason, fallbackUsed, action: clone(action),
      latentStateSha256: canonicalSha256(state), trace: trace.map(({ stateSha256, ...item }) => ({ ...item, stateSha256 })),
      hiddenChainOfThoughtStored: false,
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  certifyBenchmark({ domains, passed } = {}) {
    if (!Array.isArray(domains) || domains.length === 0 || typeof passed !== 'boolean') throw new TypeError('domains and passed are required');
    const puzzleOnly = domains.every((domain) => PUZZLE_DOMAINS.has(String(domain)));
    const base = {
      schema: 'nolane.small-model.recursive-benchmark-certification.v1', domains: [...domains].map(String).sort(), passed,
      claimAllowed: passed && !puzzleOnly,
      reason: puzzleOnly ? 'Puzzle-only results cannot support general-intelligence claims' : passed ? 'Includes non-puzzle engineering evidence' : 'Benchmark did not pass',
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  snapshot() {
    return deepFreeze({ schema: 'nolane.small-model.recursive-policy-sidecar.v1', stateSize: this.#stateSize, minDepth: this.#minDepth, maxDepth: this.#maxDepth, runs: this.#runs });
  }
}
