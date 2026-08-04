import { DatalogAdapter, FiniteDomainSmtAdapter } from './constraint-adapters.mjs';
import { canonicalSha256, deepFreeze } from './shared.mjs';

function normalizeSeeds(seeds) {
  if (!Array.isArray(seeds) || seeds.length === 0) throw new TypeError('Property verification seeds are required');
  const values = seeds.map((value) => Number(value));
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) throw new TypeError('Property verification seeds must be non-negative safe integers');
  return [...new Set(values)].sort((a, b) => a - b);
}

function count(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 10_000) throw new TypeError(`${label} must be a bounded positive integer`);
  return number;
}

function rng(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function termValue(term, assignment) {
  if (Object.hasOwn(term, 'var')) return assignment[term.var];
  return term.value;
}

function holds(constraint, assignment) {
  const left = termValue(constraint.left, assignment);
  const right = termValue(constraint.right, assignment);
  switch (constraint.op) {
    case 'eq': return Object.is(left, right);
    case 'neq': return !Object.is(left, right);
    case 'lt': return left < right;
    case 'lte': return left <= right;
    case 'gt': return left > right;
    case 'gte': return left >= right;
    default: throw new TypeError(`Unsupported reference constraint: ${constraint.op}`);
  }
}

function enumerateReference(variables, constraints) {
  const names = Object.keys(variables).sort();
  const models = [];
  const assignment = {};
  const walk = (depth) => {
    if (depth === names.length) {
      if (constraints.every((constraint) => holds(constraint, assignment))) models.push(Object.fromEntries(names.map((name) => [name, assignment[name]])));
      return;
    }
    const name = names[depth];
    for (const value of variables[name]) { assignment[name] = value; walk(depth + 1); }
  };
  walk(0);
  return models;
}

function smtCase(seed, index) {
  const random = rng(seed * 1009 + index * 9176 + 17);
  const xValue = Math.floor(random() * 3);
  const yFloor = Math.floor(random() * 3);
  const variables = { x: [0, 1, 2], y: [0, 1, 2] };
  const constraints = index % 2 === 0
    ? [
        { op: 'eq', left: { var: 'x' }, right: { value: xValue } },
        { op: 'gte', left: { var: 'y' }, right: { value: yFloor } },
      ]
    : [
        { op: 'eq', left: { var: 'x' }, right: { value: xValue } },
        { op: 'neq', left: { var: 'x' }, right: { value: xValue } },
      ];
  return { variables, constraints };
}

function normalizeModel(model) {
  return model ? Object.fromEntries(Object.entries(model).sort(([a], [b]) => a.localeCompare(b))) : null;
}

function edgeKey(from, to) { return `${from}\u0000${to}`; }

function transitiveClosure(edges) {
  const closure = new Set(edges.map(([from, to]) => edgeKey(from, to)));
  let changed = true;
  while (changed) {
    changed = false;
    const pairs = [...closure].map((key) => key.split('\u0000'));
    for (const [a, b] of pairs) for (const [c, d] of pairs) {
      if (b !== c) continue;
      const key = edgeKey(a, d);
      if (!closure.has(key)) { closure.add(key); changed = true; }
    }
  }
  return [...closure].sort();
}

function datalogCase(seed, index) {
  const random = rng(seed * 4099 + index * 7919 + 23);
  const nodes = ['a', 'b', 'c', 'd'];
  const edges = [];
  for (let i = 0; i < nodes.length; i += 1) for (let j = 0; j < nodes.length; j += 1) {
    if (i !== j && random() < 0.28) edges.push([nodes[i], nodes[j]]);
  }
  if (edges.length === 0) edges.push([nodes[index % nodes.length], nodes[(index + 1) % nodes.length]]);
  return {
    edges: [...new Map(edges.map((edge) => [edgeKey(...edge), edge])).values()].sort((a, b) => edgeKey(...a).localeCompare(edgeKey(...b))),
    facts: edges.map(([from, to]) => ({ predicate: 'edge', args: [from, to] })),
    rules: [
      { head: { predicate: 'reachable', args: ['?x', '?y'] }, body: [{ predicate: 'edge', args: ['?x', '?y'] }] },
      { head: { predicate: 'reachable', args: ['?x', '?z'] }, body: [{ predicate: 'reachable', args: ['?x', '?y'] }, { predicate: 'edge', args: ['?y', '?z'] }] },
    ],
    query: { predicate: 'reachable', args: ['?x', '?y'] },
  };
}

function receipt(schema, body) {
  const base = { schema, ...body };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}

export function verifyFiniteSmtProperties({ seeds, casesPerSeed = 8, budgets = {} } = {}) {
  const normalizedSeeds = normalizeSeeds(seeds);
  const cases = count(casesPerSeed, 'casesPerSeed');
  const maxStates = count(budgets.maxStates ?? 256, 'maxStates');
  const adapter = new FiniteDomainSmtAdapter({ maxStates });
  const counterexamples = [];
  const trialReceipts = [];
  let satCases = 0; let unsatCases = 0;
  for (const seed of normalizedSeeds) for (let index = 0; index < cases; index += 1) {
    const generated = smtCase(seed, index);
    const reference = enumerateReference(generated.variables, generated.constraints);
    const actual = adapter.solve(generated);
    const expectedStatus = reference.length > 0 ? 'sat' : 'unsat';
    const modelValid = actual.status === 'unsat' ? actual.model === null : reference.some((model) => canonicalSha256(normalizeModel(model)) === canonicalSha256(normalizeModel(actual.model)));
    const valid = actual.status === expectedStatus && modelValid && actual.completeWithinFiniteDomain === true;
    if (!valid) counterexamples.push({ seed, index, expectedStatus, actualStatus: actual.status, model: actual.model });
    if (actual.status === 'sat') satCases += 1; else unsatCases += 1;
    trialReceipts.push(canonicalSha256({ seed, index, generated, expectedStatus, actualProofSha256: actual.proofSha256, valid }));
  }
  if (counterexamples.length > 0) throw new Error(`SMT property counterexamples found: ${counterexamples.length}`);
  return receipt('nolane.small-model.smt-property-verification.v1', {
    status: 'pass', seeds: normalizedSeeds, casesPerSeed: cases, trials: normalizedSeeds.length * cases,
    satCases, unsatCases, counterexamples, referenceAgreement: true, trialReceipts,
    budgets: { maxStates }, hiddenChainOfThoughtStored: false,
    claims: { boundedPropertyVerification: true, generalSmtSolver: false, generalCodingIntelligence: false },
  });
}

export function verifyBoundedDatalogProperties({ seeds, casesPerSeed = 6, budgets = {} } = {}) {
  const normalizedSeeds = normalizeSeeds(seeds);
  const cases = count(casesPerSeed, 'casesPerSeed');
  const maxIterations = count(budgets.maxIterations ?? 64, 'maxIterations');
  const maxFacts = count(budgets.maxFacts ?? 256, 'maxFacts');
  const adapter = new DatalogAdapter({ maxIterations, maxFacts });
  const counterexamples = [];
  const trialReceipts = [];
  let convergedCases = 0;
  for (const seed of normalizedSeeds) for (let index = 0; index < cases; index += 1) {
    const generated = datalogCase(seed, index);
    const reference = transitiveClosure(generated.edges);
    const actual = adapter.evaluate({ facts: generated.facts, rules: generated.rules, query: generated.query });
    const answers = actual.answers.map((answer) => edgeKey(answer['?x'], answer['?y'])).sort();
    const valid = actual.converged === true && canonicalSha256(answers) === canonicalSha256(reference);
    if (!valid) counterexamples.push({ seed, index, expected: reference, actual: answers });
    if (actual.converged) convergedCases += 1;
    trialReceipts.push(canonicalSha256({ seed, index, edges: generated.edges, expected: reference, actualReceiptSha256: actual.receiptSha256, valid }));
  }
  if (counterexamples.length > 0) throw new Error(`Datalog property counterexamples found: ${counterexamples.length}`);
  return receipt('nolane.small-model.datalog-property-verification.v1', {
    status: 'pass', seeds: normalizedSeeds, casesPerSeed: cases, trials: normalizedSeeds.length * cases,
    convergedCases, counterexamples, referenceAgreement: true, trialReceipts,
    budgets: { maxIterations, maxFacts }, hiddenChainOfThoughtStored: false,
    claims: { boundedPropertyVerification: true, generalDatalogSolver: false, generalCodingIntelligence: false },
  });
}

export function verifySolverPropertyReceipt(value) {
  if (!value || !['nolane.small-model.smt-property-verification.v1', 'nolane.small-model.datalog-property-verification.v1'].includes(value.schema)) throw new TypeError('Solver property receipt is invalid');
  const { receiptSha256, ...base } = value;
  if (!/^[a-f0-9]{64}$/.test(String(receiptSha256 ?? '')) || canonicalSha256(base) !== receiptSha256) throw new Error('Solver property receipt hash mismatch');
  if (value.status !== 'pass' || value.referenceAgreement !== true || !Array.isArray(value.counterexamples) || value.counterexamples.length !== 0 || value.hiddenChainOfThoughtStored !== false) throw new Error('Solver property receipt did not pass');
  return value;
}
