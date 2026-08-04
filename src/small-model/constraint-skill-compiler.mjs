import { canonicalSha256, clone, deepFreeze } from './shared.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const SMT_OPS = new Set(['eq', 'neq', 'lt', 'lte', 'gt', 'gte']);

function verifyEpisode(value, index) {
  if (!value || value.schema !== 'nolane.small-model.constraint-induction-episode.v1' || value.verified !== true) throw new Error(`Constraint episode ${index} is not verified`);
  if (value.hiddenChainOfThoughtStored !== false) throw new Error(`Constraint episode ${index} must contain public evidence only`);
  if (!SHA256.test(String(value.receiptSha256 ?? ''))) throw new Error(`Constraint episode ${index} receipt is invalid`);
  const { receiptSha256, ...base } = value;
  if (canonicalSha256(base) !== receiptSha256) throw new Error(`Constraint episode ${index} receipt hash mismatch`);
  if (!value.id || !value.domain) throw new Error(`Constraint episode ${index} lacks identity or domain`);
  return value;
}

function baseLineage({ id, version, episodes }) {
  if (!String(id ?? '').trim() || !String(version ?? '').trim() || !Array.isArray(episodes) || episodes.length < 2) throw new TypeError('Constraint skill id, version and at least two verified episodes are required');
  const values = episodes.map(verifyEpisode);
  if (new Set(values.map((item) => item.receiptSha256)).size !== values.length) throw new Error('Constraint induction episodes must have distinct receipts');
  return {
    id: String(id), version: String(version),
    inductionEpisodeIds: values.map((item) => String(item.id)).sort(),
    inductionReceiptSha256: values.map((item) => item.receiptSha256).sort(),
    sourceDomains: [...new Set(values.map((item) => String(item.domain)))].sort(),
  };
}

function validateVariables(variables) {
  if (!variables || typeof variables !== 'object' || Array.isArray(variables) || Object.keys(variables).length === 0) throw new TypeError('Finite-domain variables are required');
  const output = {};
  for (const name of Object.keys(variables).sort()) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Invalid SMT variable name: ${name}`);
    const values = variables[name];
    if (!Array.isArray(values) || values.length === 0) throw new Error(`SMT domain is empty: ${name}`);
    output[name] = [...values];
  }
  return output;
}

function validateTerm(term, names) {
  if (!term || typeof term !== 'object') throw new TypeError('SMT term is required');
  if (Object.hasOwn(term, 'var')) {
    const name = String(term.var);
    if (!names.has(name)) throw new Error(`Unknown SMT variable: ${name}`);
    return { var: name };
  }
  if (Object.hasOwn(term, 'value')) return { value: term.value };
  throw new TypeError('SMT term must contain var or value');
}

function validateConstraints(constraints, names, label) {
  if (!Array.isArray(constraints)) throw new TypeError(`${label} must be an array`);
  return constraints.map((constraint, index) => {
    if (!SMT_OPS.has(constraint?.op)) throw new Error(`Unsupported SMT constraint at ${label}[${index}]`);
    return { op: constraint.op, left: validateTerm(constraint.left, names), right: validateTerm(constraint.right, names) };
  });
}

function validateDatalogAtom(atom, label) {
  if (!atom?.predicate || !Array.isArray(atom.args)) throw new TypeError(`${label} requires predicate and args`);
  return { predicate: String(atom.predicate), args: atom.args.map(String), ...(atom.negated === true ? { negated: true } : {}) };
}

export class ConstraintSkillCompiler {
  compileSmt({ id, version, episodes, variables, constraints = [], unsatConstraints = [], maxStates = 10_000 } = {}) {
    const lineage = baseLineage({ id, version, episodes });
    const normalizedVariables = validateVariables(variables);
    const names = new Set(Object.keys(normalizedVariables));
    if (!Number.isInteger(maxStates) || maxStates < 1) throw new TypeError('SMT maxStates must be positive');
    const base = {
      schema: 'nolane.small-model.constraint-skill.v1', ...lineage, kind: 'finite-domain-smt',
      definition: {
        variables: normalizedVariables,
        constraints: validateConstraints(constraints, names, 'constraints'),
        unsatConstraints: validateConstraints(unsatConstraints, names, 'unsatConstraints'),
        maxStates,
      },
      verifierObligations: ['deterministic-sat-proof', 'deterministic-unsat-proof', 'complete-within-finite-domain', 'state-budget-enforced'],
      soundnessScope: ['finite-enumerated-domains', 'eq-neq-lt-lte-gt-gte-constraints'],
      knownIncompleteness: ['does-not-solve-infinite-or-symbolic-domains', 'state-space-is-exhaustively-bounded'],
      hiddenChainOfThoughtStored: false,
      claims: { boundedConstraintSkill: true, generalCodingIntelligence: false, competitorSuperiority: false },
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  compileDatalog({ id, version, episodes, facts = [], rules = [], query, unsafeProbe = null, maxIterations = 50, maxFacts = 10_000 } = {}) {
    const lineage = baseLineage({ id, version, episodes });
    if (!Array.isArray(facts) || !Array.isArray(rules) || rules.length === 0 || !query) throw new TypeError('Datalog facts, rules and query are required');
    if (!Number.isInteger(maxIterations) || maxIterations < 1 || !Number.isInteger(maxFacts) || maxFacts < 1) throw new TypeError('Datalog budgets must be positive');
    const normalizedRules = rules.map((rule, index) => ({
      head: validateDatalogAtom(rule?.head, `rule ${index} head`),
      body: (rule?.body ?? []).map((atom, atomIndex) => validateDatalogAtom(atom, `rule ${index} body ${atomIndex}`)),
    }));
    if (normalizedRules.some((rule) => rule.body.length === 0)) throw new TypeError('Datalog rule bodies are required');
    const base = {
      schema: 'nolane.small-model.constraint-skill.v1', ...lineage, kind: 'bounded-datalog',
      definition: {
        facts: facts.map((fact, index) => validateDatalogAtom(fact, `fact ${index}`)),
        rules: normalizedRules,
        query: validateDatalogAtom(query, 'query'),
        unsafeProbe: unsafeProbe ? clone(unsafeProbe) : null,
        maxIterations, maxFacts,
      },
      verifierObligations: ['deterministic-query-proof', 'stratified-negation', 'unsafe-probe-rejected', 'fact-and-iteration-budgets-enforced'],
      soundnessScope: ['positive-ground-facts', 'safe-rules', 'stratified-negation', 'bounded-forward-chaining'],
      knownIncompleteness: ['does-not-support-function-symbols', 'does-not-support-unstratified-negation'],
      hiddenChainOfThoughtStored: false,
      claims: { boundedConstraintSkill: true, generalCodingIntelligence: false, competitorSuperiority: false },
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
