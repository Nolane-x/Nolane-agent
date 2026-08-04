import { canonicalSha256, deepFreeze } from './shared.mjs';
import { SymbolicSolverCompiler } from './symbolic-solver-compiler.mjs';

const SHA256 = /^[a-f0-9]{64}$/;

function validateMission(mission, index) {
  if (!mission || mission.schema !== 'nolane.small-model.mission-trajectory.v1' || mission.status !== 'verified-recovery') throw new Error(`Mission ${index} is not a verified recovery trajectory`);
  if (!SHA256.test(String(mission.receiptSha256 ?? ''))) throw new Error(`Mission ${index} receipt is invalid`);
  if (!mission.bestCandidatePreserved || !mission.trackedSourceUnchanged || mission.hiddenChainOfThoughtStored !== false) throw new Error(`Mission ${index} lacks preservation or public-state evidence`);
  if (!mission.declaredRepair?.from || !mission.declaredRepair?.to) throw new Error(`Mission ${index} lacks a declared repair pattern`);
  return mission;
}

export class VerifiedSkillCompiler {
  #compiler;
  constructor({ compiler = new SymbolicSolverCompiler() } = {}) { this.#compiler = compiler; }

  compile({ id, version, missions } = {}) {
    if (!id || !version || !Array.isArray(missions) || missions.length < 2) throw new TypeError('Skill id, version and at least two verified missions are required');
    const values = missions.map(validateMission);
    if (new Set(values.map((item) => item.receiptSha256)).size !== values.length) throw new Error('Skill induction missions must have distinct receipts');
    const repair = values[0].declaredRepair;
    for (const mission of values.slice(1)) {
      if (mission.declaredRepair.from !== repair.from || mission.declaredRepair.to !== repair.to || mission.declaredRepair.path !== repair.path) throw new Error('Skill induction repair patterns must match exactly');
    }
    const solver = this.#compiler.induce({
      id: String(id), version: String(version),
      episodes: values.map((mission) => ({ id: mission.missionId, verified: true, receiptSha256: mission.receiptSha256 })),
      definition: {
        inputType: 'source-text', outputType: 'source-text', kind: 'text-rewrite',
        operations: [{ op: 'replace-exact', from: repair.from, to: repair.to, maxReplacements: 1 }],
        rollbackOperation: { op: 'replace-exact', from: repair.to, to: repair.from, maxReplacements: 1 },
        writes: [repair.path],
        verifierObligations: ['held-out-test-pass', 'rollback-restores-input-hash', 'source-path-bounded'],
        soundnessScope: ['exact-declared-recovery-pattern', `path:${repair.path}`],
        knownIncompleteness: ['does-not-parse-language-semantics', 'abstains-when-exact-pattern-is-absent'],
      },
    });
    const base = {
      schema: 'nolane.small-model.verified-skill.v1', id: String(id), version: String(version), solver,
      inductionMissionIds: values.map((mission) => mission.missionId).sort(), inductionReceiptSha256: values.map((mission) => mission.receiptSha256).sort(),
      sourceRepositoryIds: [...new Set(values.map((mission) => mission.repositoryId))].sort(),
      hiddenChainOfThoughtStored: false,
      claims: { boundedDeclarativeSkill: true, generalCodingIntelligence: false, competitorSuperiority: false },
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
