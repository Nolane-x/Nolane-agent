import { canonicalSha256, canonicalStringify, clone, deepFreeze } from './shared.mjs';

export class HiddenVerificationSuite {
  #id;
  #domain;
  #cases = new Map();
  #runs = 0;

  constructor({ id, domain } = {}) {
    if (!id || !domain) throw new TypeError('Hidden suite id and domain are required');
    this.#id = String(id);
    this.#domain = String(domain);
  }

  registerCase({ id, components, input, expected } = {}) {
    if (!id || !Array.isArray(components) || components.length < 2) throw new TypeError('Hidden compositional case requires id and at least two components');
    if (this.#cases.has(id)) throw new Error(`Duplicate hidden case: ${id}`);
    const record = deepFreeze({ id: String(id), components: [...new Set(components.map(String))].sort(), input: clone(input), expected: clone(expected) });
    this.#cases.set(record.id, record);
    return deepFreeze({ id: record.id, components: record.components, hidden: true });
  }

  async run({ candidateId, execute } = {}) {
    if (!candidateId || typeof execute !== 'function') throw new TypeError('candidateId and execute are required');
    if (this.#cases.size === 0) throw new Error('No hidden cases registered');
    const failures = [];
    let passed = 0;
    for (const hiddenCase of this.#cases.values()) {
      let actual;
      try {
        actual = await execute(clone(hiddenCase.input));
      } catch {
        failures.push({ caseId: hiddenCase.id, components: hiddenCase.components });
        continue;
      }
      if (canonicalStringify(actual) === canonicalStringify(hiddenCase.expected)) passed += 1;
      else failures.push({ caseId: hiddenCase.id, components: hiddenCase.components });
    }
    this.#runs += 1;
    const hiddenSuiteSha256 = canonicalSha256([...this.#cases.values()].map((item) => ({ id: item.id, components: item.components, input: item.input, expected: item.expected })));
    const base = {
      schema: 'nolane.small-model.hidden-verification-receipt.v1', suiteId: this.#id, domain: this.#domain,
      candidateId: String(candidateId), status: failures.length === 0 ? 'pass' : 'fail', passed,
      failed: failures.length, total: this.#cases.size, failures, compositional: true, hiddenSuiteSha256,
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  snapshot() {
    const componentCoverage = [...new Set([...this.#cases.values()].flatMap((item) => item.components))].sort();
    return deepFreeze({ schema: 'nolane.small-model.hidden-verification-suite.v1', id: this.#id, domain: this.#domain, caseCount: this.#cases.size, componentCoverage, runs: this.#runs });
  }
}
