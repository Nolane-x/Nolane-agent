import { canonicalSha256, deepFreeze } from './shared.mjs';

function replaceLimited(text, from, to, maxReplacements) {
  if (from === '') throw new TypeError('replace-exact from must not be empty');
  let output = text;
  let count = 0;
  let offset = 0;
  while (count < maxReplacements) {
    const index = output.indexOf(from, offset);
    if (index < 0) break;
    output = `${output.slice(0, index)}${to}${output.slice(index + from.length)}`;
    offset = index + to.length;
    count += 1;
  }
  return { output, count };
}

export class SolverSandbox {
  #maxInputBytes;
  #maxOperations;
  #runs = 0;

  constructor({ maxInputBytes = 1_000_000, maxOperations = 100 } = {}) {
    if (!Number.isInteger(maxInputBytes) || maxInputBytes < 1 || !Number.isInteger(maxOperations) || maxOperations < 1) throw new TypeError('Invalid solver sandbox budgets');
    this.#maxInputBytes = maxInputBytes;
    this.#maxOperations = maxOperations;
  }

  execute({ solver, input } = {}) {
    if (!solver?.id || !solver?.version || typeof input !== 'string') throw new TypeError('solver and string input are required');
    if (Buffer.byteLength(input) > this.#maxInputBytes) throw new Error('Solver input budget exceeded');
    const definition = solver.definition;
    if (!definition || definition.kind !== 'text-rewrite' || !Array.isArray(definition.operations)) throw new Error('Only declarative text-rewrite solvers are allowed');
    if (definition.operations.length > this.#maxOperations) throw new Error('Solver operation budget exceeded');
    let output = input;
    let appliedOperations = 0;
    for (const operation of definition.operations) {
      if (operation.op !== 'replace-exact') throw new Error(`Unsupported declarative operation: ${operation.op}`);
      const { output: next, count } = replaceLimited(output, String(operation.from), String(operation.to), Math.max(1, Number(operation.maxReplacements ?? 1)));
      output = next;
      appliedOperations += count;
    }
    this.#runs += 1;
    const base = {
      schema: 'nolane.small-model.solver-sandbox-receipt.v1', solverId: solver.id, version: solver.version,
      status: appliedOperations > 0 ? 'applied' : 'abstain', output, appliedOperations,
      executedSource: false, shellUsed: false, inputSha256: canonicalSha256(input), outputSha256: canonicalSha256(output),
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  snapshot() {
    return deepFreeze({ schema: 'nolane.small-model.solver-sandbox.v1', runs: this.#runs, maxInputBytes: this.#maxInputBytes, maxOperations: this.#maxOperations });
  }
}
