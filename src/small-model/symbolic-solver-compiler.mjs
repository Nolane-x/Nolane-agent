import { canonicalSha256, clone, deepFreeze } from './shared.mjs';

function validateDefinition(definition) {
  if (!definition || !definition.inputType || !definition.outputType || !definition.kind) throw new TypeError('Typed solver definition is required');
  if (definition.kind !== 'text-rewrite') throw new TypeError('Only declarative text-rewrite solver definitions are supported');
  if (!Array.isArray(definition.operations) || definition.operations.length === 0) throw new TypeError('Solver operations are required');
  if (!Array.isArray(definition.soundnessScope) || definition.soundnessScope.length === 0) throw new TypeError('Solver soundnessScope is required');
  if (!Array.isArray(definition.knownIncompleteness)) throw new TypeError('Solver knownIncompleteness is required');
  return clone(definition);
}

function seeded(seed) {
  let state = (Number(seed) >>> 0) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export class SymbolicSolverCompiler {
  #solvers = new Map();
  #values = new Map();
  #transfers = [];
  #adapters = new Map();

  induce({ id, version, episodes, definition } = {}) {
    if (!id || !version || !Array.isArray(episodes) || episodes.length === 0) throw new TypeError('Solver id, version and verified episodes are required');
    for (const episode of episodes) {
      if (episode?.verified !== true || !/^[a-f0-9]{64}$/i.test(String(episode.receiptSha256 ?? ''))) throw new Error('Every solver episode must be verified with a receipt');
    }
    const normalized = validateDefinition(definition);
    const history = this.#solvers.get(id) ?? [];
    const base = {
      schema: 'nolane.small-model.symbolic-solver.v1', id: String(id), version: String(version), definition: normalized,
      provenance: { episodeIds: episodes.map((item) => String(item.id)).sort(), episodeReceiptSha256: episodes.map((item) => item.receiptSha256).sort() },
      previousVersion: history.at(-1)?.version ?? null,
    };
    const solver = deepFreeze({ ...base, solverSha256: canonicalSha256(base) });
    this.#solvers.set(id, [...history, solver]);
    return solver;
  }


  registerAdapter({ id, version, kind, implementation, receiptSha256 } = {}) {
    if (!id || !version || !['ast-codemod', 'smt', 'datalog'].includes(kind)) throw new TypeError('Adapter id, version and supported kind are required');
    if (!implementation || typeof implementation !== 'object') throw new TypeError('Adapter implementation is required');
    if (!/^[a-f0-9]{64}$/i.test(String(receiptSha256 ?? ''))) throw new Error('Adapter provenance receipt is required');
    const requiredMethod = kind === 'ast-codemod' ? 'apply' : kind === 'smt' ? 'solve' : 'evaluate';
    if (typeof implementation[requiredMethod] !== 'function') throw new TypeError(`Adapter implementation must expose ${requiredMethod}()`);
    const base = { schema: 'nolane.small-model.symbolic-adapter.v1', id: String(id), version: String(version), kind, requiredMethod, provenanceReceiptSha256: String(receiptSha256) };
    const record = deepFreeze({ ...base, adapterSha256: canonicalSha256(base) });
    this.#adapters.set(record.id, { record, implementation });
    return record;
  }

  executeAdapter(id, input) {
    const adapter = this.#adapters.get(String(id));
    if (!adapter) throw new Error(`Unknown symbolic adapter: ${id}`);
    return adapter.implementation[adapter.record.requiredMethod](input);
  }

  generateProperties({ seed = 1, count, schema } = {}) {
    if (!Number.isInteger(count) || count < 1 || !schema || typeof schema !== 'object') throw new TypeError('Property count and schema are required');
    const random = seeded(seed);
    const cases = [];
    for (let index = 0; index < count; index += 1) {
      const value = {};
      for (const [key, rule] of Object.entries(schema)) {
        if (rule.type === 'integer') {
          const min = Number(rule.min ?? 0); const max = Number(rule.max ?? 100);
          value[key] = min + Math.floor(random() * (max - min + 1));
        } else if (rule.type === 'boolean') value[key] = random() >= 0.5;
        else if (rule.type === 'enum' && Array.isArray(rule.values) && rule.values.length > 0) value[key] = rule.values[Math.floor(random() * rule.values.length)];
        else throw new TypeError(`Unsupported property schema type: ${rule.type}`);
      }
      cases.push(deepFreeze(value));
    }
    return deepFreeze(cases);
  }

  gateTransfer({ solverId, sourceDomain, heldOut } = {}) {
    if (!solverId || !sourceDomain || !Array.isArray(heldOut) || heldOut.length === 0) throw new TypeError('solverId, sourceDomain and heldOut results are required');
    for (const result of heldOut) {
      if (!result?.repositoryId || result.tuned !== false || result.passed !== true || result.repositoryId === sourceDomain) throw new Error('Solver transfer requires passing untuned held-out repositories');
    }
    const base = { schema: 'nolane.small-model.solver-transfer-gate.v1', solverId, sourceDomain, heldOut: clone(heldOut), allowed: true };
    const receipt = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.#transfers.push(receipt);
    return receipt;
  }

  checkComposition({ solvers } = {}) {
    if (!Array.isArray(solvers) || solvers.length < 2) throw new TypeError('At least two solvers are required');
    const findings = [];
    const writes = new Set();
    for (let index = 0; index < solvers.length; index += 1) {
      const solver = solvers[index];
      if (index > 0) {
        const previous = solvers[index - 1];
        if (previous.definition?.outputType !== solver.definition?.inputType) findings.push(`type-mismatch:${previous.id}->${solver.id}`);
      }
      for (const target of solver.definition?.writes ?? []) {
        if (writes.has(target)) findings.push(`write-conflict:${target}`);
        writes.add(target);
      }
    }
    const base = { schema: 'nolane.small-model.solver-composition.v1', solverIds: solvers.map((item) => item.id), allowed: findings.length === 0, findings: [...new Set(findings)].sort() };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  recordValue({ solverId, tokensSaved, buildCost = 0, executionCost = 0 } = {}) {
    if (!solverId || [tokensSaved, buildCost, executionCost].some((value) => !Number.isFinite(Number(value)) || Number(value) < 0)) throw new TypeError('Valid solver value metrics are required');
    const current = this.#values.get(solverId) ?? { calls: 0, tokensSaved: 0, buildCost: 0, executionCost: 0 };
    const next = {
      calls: current.calls + 1,
      tokensSaved: current.tokensSaved + Number(tokensSaved),
      buildCost: current.buildCost + Number(buildCost),
      executionCost: current.executionCost + Number(executionCost),
    };
    this.#values.set(solverId, next);
    return this.amortizedValue(solverId);
  }

  amortizedValue(solverId) {
    const value = this.#values.get(solverId) ?? { calls: 0, tokensSaved: 0, buildCost: 0, executionCost: 0 };
    const base = { schema: 'nolane.small-model.solver-value.v1', solverId, ...value, netValue: value.tokensSaved - value.buildCost - value.executionCost };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  rollback(id) {
    const history = this.#solvers.get(id) ?? [];
    if (history.length < 2) throw new Error(`No rollback solver version for: ${id}`);
    history.pop(); this.#solvers.set(id, history); return history.at(-1);
  }

  executeWithFallback({ solver, modelFallback } = {}) {
    if (typeof solver !== 'function' || typeof modelFallback !== 'function') throw new TypeError('solver and modelFallback are required');
    const solverResult = solver();
    const fallbackUsed = solverResult?.status === 'abstain';
    const result = fallbackUsed ? modelFallback({ solverResult }) : solverResult;
    const base = { schema: 'nolane.small-model.solver-fallback.v1', fallbackUsed, solverStatus: solverResult?.status ?? 'unknown', result: clone(result) };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  snapshot() {
    return deepFreeze({ schema: 'nolane.small-model.symbolic-solver-compiler.v1', solvers: this.#solvers.size, adapters: this.#adapters.size, transfers: this.#transfers.length, valuedSolvers: this.#values.size });
  }
}
