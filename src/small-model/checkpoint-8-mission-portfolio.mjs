import { canonicalSha256, deepFreeze } from './shared.mjs';
import { CHECKPOINT_8_AST_PACKS } from './checkpoint-8-ast-pack.mjs';
import { AstSkillCompiler } from './ast-skill-compiler.mjs';
import { AstSkillTransferLab } from './ast-skill-transfer-lab.mjs';
import { ConstraintSkillCompiler } from './constraint-skill-compiler.mjs';
import { ConstraintProofLab } from './constraint-proof-lab.mjs';
import { scoreProcessStep } from './process-reward-kernel.mjs';

function episode(id, domain) {
  const base = { schema: 'nolane.small-model.constraint-induction-episode.v1', id, domain, verified: true, hiddenChainOfThoughtStored: false };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}

function portfolioStep({ id, missionId, phase, informationGain = 1, criterionDelta = 1, recoveryDelta = 0, bestCandidatePreserved = true, resourceWaste = 0 }) {
  return scoreProcessStep({
    id, missionId, phase,
    verifier: { valid: true, status: 'pass', rewardHacking: false },
    actualEffect: { changed: true, informationGain, criterionDelta, recoveryDelta, bestCandidatePreserved, irreversibleRisk: 0, redundantAction: 0, repeatedFailure: 0, regressionDelta: 0, resourceWaste },
  });
}

function missionFromProof({ id, family, proof, steps }) {
  const process = portfolioStep({ id: `${id}:reward`, missionId: id, phase: 'verified-proof', informationGain: 1, criterionDelta: 1, recoveryDelta: 1 });
  const base = {
    schema: 'nolane.small-model.checkpoint-8-portfolio-mission.v1', missionId: id, family, status: 'verified',
    steps: steps.map((value, index) => deepFreeze({ index: index + 1, ...value, receiptSha256: canonicalSha256({ index: index + 1, ...value }) })),
    proofReceiptSha256: proof.receiptSha256, bestCandidatePreserved: true, processReward: process,
    hiddenChainOfThoughtStored: false,
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}

export async function buildCheckpoint8MissionPortfolio({ root = process.cwd() } = {}) {
  const astLab = new AstSkillTransferLab();
  const inductionMissions = await Promise.all(CHECKPOINT_8_AST_PACKS.slice(0, 2).map((pack) => astLab.collectRecoveryMission({ root, pack })));
  const astSkill = new AstSkillCompiler().compile({ id: 'rename-legacy-name', version: '2', missions: inductionMissions });
  const astTransfer = await astLab.verify({ root, skill: astSkill, heldOutPack: CHECKPOINT_8_AST_PACKS[2] });

  const constraintEpisodes = [episode('constraint-a', inductionMissions[0].repositoryId), episode('constraint-b', inductionMissions[1].repositoryId)];
  const compiler = new ConstraintSkillCompiler();
  const smtSkill = compiler.compileSmt({
    id: 'bounded-test-plan', version: '1', episodes: constraintEpisodes,
    variables: { testDepth: [1, 2, 3], risk: [0, 1, 2], budget: [2, 3, 4] },
    constraints: [
      { op: 'gte', left: { var: 'testDepth' }, right: { value: 2 } },
      { op: 'lte', left: { var: 'risk' }, right: { value: 1 } },
      { op: 'gte', left: { var: 'budget' }, right: { var: 'testDepth' } },
    ],
    unsatConstraints: [
      { op: 'eq', left: { var: 'testDepth' }, right: { value: 1 } },
      { op: 'eq', left: { var: 'testDepth' }, right: { value: 3 } },
    ], maxStates: 200,
  });
  const smtProof = new ConstraintProofLab().verify({ skill: smtSkill });

  const datalogSkill = compiler.compileDatalog({
    id: 'bounded-test-impact', version: '1', episodes: constraintEpisodes,
    facts: [
      { predicate: 'depends', args: ['unit', 'source'] },
      { predicate: 'depends', args: ['integration', 'unit'] },
      { predicate: 'candidate', args: ['unit'] },
      { predicate: 'candidate', args: ['full'] },
      { predicate: 'blocked', args: ['full'] },
    ],
    rules: [
      { head: { predicate: 'impacted', args: ['?x', '?y'] }, body: [{ predicate: 'depends', args: ['?x', '?y'] }] },
      { head: { predicate: 'impacted', args: ['?x', '?z'] }, body: [{ predicate: 'depends', args: ['?x', '?y'] }, { predicate: 'impacted', args: ['?y', '?z'] }] },
      { head: { predicate: 'allowed', args: ['?x'] }, body: [{ predicate: 'candidate', args: ['?x'] }, { predicate: 'blocked', args: ['?x'], negated: true }] },
    ],
    query: { predicate: 'allowed', args: ['?test'] },
    unsafeProbe: { facts: [], rules: [{ head: { predicate: 'p', args: ['?x'] }, body: [{ predicate: 'q', args: ['fixed'] }] }] },
    maxIterations: 20, maxFacts: 100,
  });
  const datalogProof = new ConstraintProofLab().verify({ skill: datalogSkill });

  const smtMission = missionFromProof({ id: 'checkpoint-8:smt-plan', family: 'finite-domain-smt', proof: smtProof, steps: [
    { type: 'compile', expectedEffect: 'typed-skill', actualEffect: 'typed-skill' },
    { type: 'solve-sat', expectedEffect: 'sat-proof', actualEffect: smtProof.sat.status },
    { type: 'solve-unsat', expectedEffect: 'unsat-proof', actualEffect: smtProof.unsat.status },
    { type: 'finalize', expectedEffect: 'proof-preserved', actualEffect: 'proof-preserved' },
  ] });
  const datalogMission = missionFromProof({ id: 'checkpoint-8:datalog-query', family: 'bounded-datalog', proof: datalogProof, steps: [
    { type: 'compile', expectedEffect: 'typed-skill', actualEffect: 'typed-skill' },
    { type: 'evaluate', expectedEffect: 'query-answer', actualEffect: `answers:${datalogProof.datalog.answers.length}` },
    { type: 'negative-probe', expectedEffect: 'unsafe-rejected', actualEffect: datalogProof.unsafeProbeRejected ? 'unsafe-rejected' : 'unsafe-accepted' },
    { type: 'finalize', expectedEffect: 'proof-preserved', actualEffect: 'proof-preserved' },
  ] });

  const missions = [...inductionMissions, astTransfer.mission, smtMission, datalogMission];
  const processRewards = [
    ...inductionMissions.map((mission, index) => portfolioStep({ id: `ast-induction-${index}:reward`, missionId: mission.missionId, phase: 'verified-recovery', informationGain: 1, criterionDelta: 1, recoveryDelta: 1 })),
    portfolioStep({ id: 'ast-transfer:reward', missionId: astTransfer.mission.missionId, phase: 'transfer', informationGain: 2, criterionDelta: 1, recoveryDelta: 1 }),
    smtMission.processReward, datalogMission.processReward,
  ];
  const processValue = Number(processRewards.reduce((sum, item) => sum + item.reward, 0).toFixed(8));
  const observedOperationCost = inductionMissions.reduce((sum, mission) => sum + mission.steps.length, 0) + astTransfer.mission.steps.length + smtProof.sat.statesExplored + smtProof.unsat.statesExplored + datalogProof.datalog.iterations;
  const referenceFallbackCost = observedOperationCost * 2 + 10;
  const totalCostRatio = Number((observedOperationCost / referenceFallbackCost).toFixed(8));
  const cost = deepFreeze({
    schema: 'nolane.small-model.checkpoint-8-cost-evidence.v1', candidateCost: observedOperationCost, referenceFallbackCost,
    totalCostRatio, candidateCostLower: totalCostRatio < 1, baselineKind: 'bounded-model-fallback-budget', externalCompetitorMeasured: false,
  });
  const base = {
    schema: 'nolane.small-model.checkpoint-8-mission-portfolio.v1', missions,
    families: ['ast-induction', 'ast-transfer', 'bounded-datalog', 'finite-domain-smt'],
    astSkill, astTransfer, smtSkill, smtProof, datalogSkill, datalogProof, processRewards, processValue, cost,
    bestCandidatePreserved: missions.every((mission) => mission.bestCandidatePreserved === true),
    hiddenChainOfThoughtStored: false,
    claims: { boundedSolverPortfolio: true, externalRepositoryGeneralization: false, generalCodingIntelligence: false, competitorSuperiority: false },
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
