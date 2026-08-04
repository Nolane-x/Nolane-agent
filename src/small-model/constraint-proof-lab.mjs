import { canonicalSha256, deepFreeze } from './shared.mjs';
import { DatalogAdapter, FiniteDomainSmtAdapter } from './constraint-adapters.mjs';

function verifySkill(skill) {
  if (!skill || skill.schema !== 'nolane.small-model.constraint-skill.v1' || !skill.receiptSha256) throw new TypeError('Constraint skill v1 is required');
  const { receiptSha256, ...base } = skill;
  if (canonicalSha256(base) !== receiptSha256) throw new Error('Constraint skill receipt hash mismatch');
  if (skill.hiddenChainOfThoughtStored !== false) throw new Error('Constraint skill must contain public evidence only');
  return skill;
}

export class ConstraintProofLab {
  verify({ skill: input } = {}) {
    const skill = verifySkill(input);
    if (skill.kind === 'finite-domain-smt') {
      const { variables, constraints, unsatConstraints, maxStates } = skill.definition;
      const adapter = new FiniteDomainSmtAdapter({ maxStates });
      const sat = adapter.solve({ variables, constraints });
      const unsat = adapter.solve({ variables, constraints: unsatConstraints });
      if (sat.status !== 'sat' || unsat.status !== 'unsat') throw new Error('Constraint skill must produce both SAT and UNSAT proof evidence');
      const repeatSat = adapter.solve({ variables, constraints });
      const repeatUnsat = adapter.solve({ variables, constraints: unsatConstraints });
      if (sat.proofSha256 !== repeatSat.proofSha256 || unsat.proofSha256 !== repeatUnsat.proofSha256) throw new Error('Constraint proof is not deterministic');
      const base = {
        schema: 'nolane.small-model.constraint-proof-verification.v1', kind: skill.kind, status: 'pass',
        skillId: skill.id, skillReceiptSha256: skill.receiptSha256, sat, unsat,
        completeWithinBudgets: sat.completeWithinFiniteDomain === true && unsat.completeWithinFiniteDomain === true,
        unsafeProbeRejected: null, hiddenChainOfThoughtStored: false,
        claims: { boundedConstraintProof: true, generalCodingIntelligence: false, competitorSuperiority: false },
      };
      return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    }
    if (skill.kind === 'bounded-datalog') {
      const { facts, rules, query, unsafeProbe, maxIterations, maxFacts } = skill.definition;
      const adapter = new DatalogAdapter({ maxIterations, maxFacts });
      const datalog = adapter.evaluate({ facts, rules, query });
      const repeat = adapter.evaluate({ facts, rules, query });
      if (datalog.receiptSha256 !== repeat.receiptSha256 || datalog.converged !== true) throw new Error('Datalog proof is not deterministic or converged');
      let unsafeProbeRejected = unsafeProbe === null;
      if (unsafeProbe) {
        try { adapter.evaluate(unsafeProbe); }
        catch { unsafeProbeRejected = true; }
      }
      if (!unsafeProbeRejected) throw new Error('Unsafe Datalog probe was accepted');
      const base = {
        schema: 'nolane.small-model.constraint-proof-verification.v1', kind: skill.kind, status: 'pass',
        skillId: skill.id, skillReceiptSha256: skill.receiptSha256, datalog,
        completeWithinBudgets: datalog.completeWithinBudgets === true, unsafeProbeRejected,
        hiddenChainOfThoughtStored: false,
        claims: { boundedConstraintProof: true, generalCodingIntelligence: false, competitorSuperiority: false },
      };
      return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    }
    throw new Error(`Unsupported constraint skill kind: ${skill.kind}`);
  }
}
