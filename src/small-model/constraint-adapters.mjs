import { canonicalSha256, deepFreeze } from './shared.mjs';

function receipt(schema, body, hashField = 'receiptSha256') {
  const base = { schema, ...body };
  return deepFreeze({ ...base, [hashField]: canonicalSha256(base) });
}

function termValue(term, assignment) {
  if (term && Object.hasOwn(term, 'var')) {
    if (!Object.hasOwn(assignment, term.var)) throw new Error(`Unknown SMT variable: ${term.var}`);
    return assignment[term.var];
  }
  if (term && Object.hasOwn(term, 'value')) return term.value;
  throw new TypeError('SMT term must contain var or value');
}

function constraintHolds(constraint, assignment) {
  const left = termValue(constraint.left, assignment);
  const right = termValue(constraint.right, assignment);
  switch (constraint.op) {
    case 'eq': return Object.is(left, right);
    case 'neq': return !Object.is(left, right);
    case 'lt': return left < right;
    case 'lte': return left <= right;
    case 'gt': return left > right;
    case 'gte': return left >= right;
    default: throw new TypeError(`Unsupported SMT constraint: ${constraint.op}`);
  }
}

export class FiniteDomainSmtAdapter {
  #maxStates;
  constructor({ maxStates = 10_000 } = {}) {
    if (!Number.isInteger(maxStates) || maxStates < 1) throw new TypeError('maxStates must be positive');
    this.#maxStates = maxStates;
  }

  solve({ variables, constraints = [] } = {}) {
    if (!variables || typeof variables !== 'object' || Array.isArray(variables) || Object.keys(variables).length === 0) throw new TypeError('Finite-domain variables are required');
    if (!Array.isArray(constraints)) throw new TypeError('SMT constraints must be an array');
    const names = Object.keys(variables).sort();
    let possibleStates = 1;
    for (const name of names) {
      const values = variables[name];
      if (!Array.isArray(values) || values.length === 0) throw new TypeError(`SMT domain is empty: ${name}`);
      possibleStates *= values.length;
      if (possibleStates > this.#maxStates) throw new Error(`SMT state budget exceeded: ${possibleStates} > ${this.#maxStates}`);
    }
    let statesExplored = 0;
    let model = null;
    const assignment = {};
    const search = (depth) => {
      if (depth === names.length) {
        statesExplored += 1;
        if (constraints.every((constraint) => constraintHolds(constraint, assignment))) {
          model = Object.fromEntries(names.map((name) => [name, assignment[name]]));
          return true;
        }
        return false;
      }
      const name = names[depth];
      for (const value of variables[name]) {
        assignment[name] = value;
        if (search(depth + 1)) return true;
      }
      delete assignment[name];
      return false;
    };
    search(0);
    return receipt('nolane.small-model.finite-domain-smt-proof.v1', {
      status: model ? 'sat' : 'unsat',
      model,
      variables: names,
      constraints: constraints.map((constraint) => ({ ...constraint })),
      possibleStates,
      statesExplored,
      completeWithinFiniteDomain: true,
      solverKind: 'deterministic-finite-domain-enumeration',
    }, 'proofSha256');
  }
}

const variable = (value) => typeof value === 'string' && value.startsWith('?');
const factKey = (fact) => `${fact.predicate}\u0000${fact.args.map((value) => JSON.stringify(value)).join('\u0000')}`;

function normalizeAtom(atom, label) {
  if (!atom?.predicate || !Array.isArray(atom.args)) throw new TypeError(`${label} requires predicate and args`);
  return { predicate: String(atom.predicate), args: atom.args.map((value) => String(value)), negated: atom.negated === true };
}

function collectVariables(atom) {
  return new Set(atom.args.filter(variable));
}

function reachable(graph, from, to, seen = new Set()) {
  if (from === to) return true;
  if (seen.has(from)) return false;
  seen.add(from);
  for (const next of graph.get(from) ?? []) if (reachable(graph, next, to, seen)) return true;
  return false;
}

function validateRules(rules) {
  const normalized = rules.map((rule, index) => {
    const head = normalizeAtom(rule?.head, `rule ${index} head`);
    const body = (rule?.body ?? []).map((atom) => normalizeAtom(atom, `rule ${index} body`));
    if (body.length === 0) throw new TypeError(`rule ${index} body is required`);
    const positiveVars = new Set(body.filter((atom) => !atom.negated).flatMap((atom) => [...collectVariables(atom)]));
    const required = new Set([...collectVariables(head), ...body.filter((atom) => atom.negated).flatMap((atom) => [...collectVariables(atom)])]);
    for (const name of required) if (!positiveVars.has(name)) throw new Error(`Unsafe variable ${name} in Datalog rule ${index}`);
    return { head, body };
  });
  const graph = new Map();
  for (const rule of normalized) {
    const edges = graph.get(rule.head.predicate) ?? new Set();
    for (const atom of rule.body) edges.add(atom.predicate);
    graph.set(rule.head.predicate, edges);
  }
  for (const rule of normalized) {
    for (const atom of rule.body.filter((item) => item.negated)) {
      if (reachable(graph, atom.predicate, rule.head.predicate)) throw new Error(`Datalog negation is not stratified: ${rule.head.predicate} -> not ${atom.predicate}`);
    }
  }
  return normalized;
}

function computeStrata(rules) {
  const predicates = new Set(rules.flatMap((rule) => [rule.head.predicate, ...rule.body.map((atom) => atom.predicate)]));
  const strata = new Map([...predicates].map((predicate) => [predicate, 0]));
  for (let round = 0; round < predicates.size * predicates.size + 1; round += 1) {
    let changed = false;
    for (const rule of rules) {
      const required = Math.max(...rule.body.map((atom) => (strata.get(atom.predicate) ?? 0) + (atom.negated ? 1 : 0)));
      if ((strata.get(rule.head.predicate) ?? 0) < required) { strata.set(rule.head.predicate, required); changed = true; }
    }
    if (!changed) return strata;
  }
  throw new Error('Datalog stratification did not converge');
}

function matchAtom(atom, fact, bindings) {
  if (atom.predicate !== fact.predicate || atom.args.length !== fact.args.length) return null;
  const next = { ...bindings };
  for (let index = 0; index < atom.args.length; index += 1) {
    const expected = atom.args[index];
    const actual = fact.args[index];
    if (variable(expected)) {
      if (Object.hasOwn(next, expected) && next[expected] !== actual) return null;
      next[expected] = actual;
    } else if (expected !== actual) return null;
  }
  return next;
}

function instantiate(atom, bindings) {
  return { predicate: atom.predicate, args: atom.args.map((value) => variable(value) ? bindings[value] : value) };
}

function bodyBindings(body, facts) {
  let rows = [{}];
  for (const atom of body) {
    if (!atom.negated) {
      const nextRows = [];
      for (const row of rows) for (const fact of facts) {
        const matched = matchAtom(atom, fact, row);
        if (matched) nextRows.push(matched);
      }
      rows = nextRows;
    } else {
      rows = rows.filter((row) => !facts.some((fact) => matchAtom(atom, fact, row)));
    }
    if (rows.length === 0) break;
  }
  return rows;
}

export class DatalogAdapter {
  #maxIterations;
  #maxFacts;
  constructor({ maxIterations = 50, maxFacts = 10_000 } = {}) {
    if (!Number.isInteger(maxIterations) || maxIterations < 1 || !Number.isInteger(maxFacts) || maxFacts < 1) throw new TypeError('Datalog budgets must be positive');
    this.#maxIterations = maxIterations;
    this.#maxFacts = maxFacts;
  }

  evaluate({ facts = [], rules = [], query = null } = {}) {
    if (!Array.isArray(facts) || !Array.isArray(rules)) throw new TypeError('Datalog facts and rules must be arrays');
    const normalizedRules = validateRules(rules);
    const strata = computeStrata(normalizedRules);
    const factMap = new Map();
    for (const item of facts) {
      const fact = normalizeAtom(item, 'fact');
      if (fact.negated || fact.args.some(variable)) throw new TypeError('Datalog facts must be positive and ground');
      factMap.set(factKey(fact), { predicate: fact.predicate, args: fact.args });
    }
    const maxStratum = Math.max(0, ...strata.values());
    let iterations = 0;
    for (let stratum = 0; stratum <= maxStratum; stratum += 1) {
      const active = normalizedRules.filter((rule) => (strata.get(rule.head.predicate) ?? 0) === stratum);
      let changed = true;
      while (changed) {
        if (iterations >= this.#maxIterations) throw new Error(`Datalog iteration budget exceeded: ${this.#maxIterations}`);
        changed = false;
        iterations += 1;
        const snapshot = [...factMap.values()];
        for (const rule of active) {
          for (const bindings of bodyBindings(rule.body, snapshot)) {
            const fact = instantiate(rule.head, bindings);
            if (fact.args.some((value) => value === undefined)) throw new Error('Unsafe Datalog head binding');
            const key = factKey(fact);
            if (!factMap.has(key)) {
              if (factMap.size >= this.#maxFacts) throw new Error(`Datalog fact budget exceeded: ${this.#maxFacts}`);
              factMap.set(key, fact);
              changed = true;
            }
          }
        }
      }
    }
    const outputFacts = [...factMap.values()].sort((a, b) => factKey(a).localeCompare(factKey(b)));
    let answers = [];
    if (query) {
      const atom = normalizeAtom(query, 'query');
      answers = outputFacts.map((fact) => matchAtom(atom, fact, {})).filter(Boolean);
    }
    return receipt('nolane.small-model.datalog-proof.v1', {
      facts: outputFacts,
      answers,
      iterations,
      converged: true,
      strata: Object.fromEntries([...strata.entries()].sort(([a], [b]) => a.localeCompare(b))),
      completeWithinBudgets: true,
    });
  }
}
