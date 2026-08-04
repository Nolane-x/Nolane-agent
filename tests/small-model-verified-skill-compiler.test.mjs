import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { CHECKPOINT_7_HELDOUT_PACKS, CHECKPOINT_7_SKILL_TRANSFER_PACK } from '../src/small-model/checkpoint-7-heldout-pack.mjs';
import { MissionTrajectoryEngine } from '../src/small-model/mission-trajectory-engine.mjs';
import { VerifiedSkillCompiler } from '../src/small-model/verified-skill-compiler.mjs';
import { SkillTransferLab } from '../src/small-model/skill-transfer-lab.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
let missions;

before(async () => {
  const engine = new MissionTrajectoryEngine({ trainingRepositoryIds: [] });
  const nodePack = CHECKPOINT_7_HELDOUT_PACKS.find((pack) => pack.runtime === 'node');
  missions = [
    await engine.run({ root, pack: nodePack, runId: 'induction-a' }),
    await engine.run({ root, pack: nodePack, runId: 'induction-b' }),
  ];
});

test('verified skill compiler requires repeated verified missions and emits declarative verifier-bound rollback metadata', () => {
  const compiler = new VerifiedSkillCompiler();
  assert.throws(() => compiler.compile({ id: 'normalize-lowercase', version: '1', missions: [missions[0]] }), /at least two/i);
  const skill = compiler.compile({ id: 'normalize-lowercase', version: '1', missions });
  assert.equal(skill.solver.definition.kind, 'text-rewrite');
  assert.equal(skill.solver.definition.operations[0].op, 'replace-exact');
  assert.equal(skill.solver.definition.rollbackOperation.op, 'replace-exact');
  assert.deepEqual(skill.solver.definition.verifierObligations, ['held-out-test-pass','rollback-restores-input-hash','source-path-bounded']);
  assert.equal(skill.hiddenChainOfThoughtStored, false);
  assert.match(skill.receiptSha256, /^[a-f0-9]{64}$/);
});

test('skill transfer applies on an unseen repository passes verifier and restores the pre-skill hash on rollback', async () => {
  const skill = new VerifiedSkillCompiler().compile({ id: 'normalize-lowercase', version: '1', missions });
  const result = await new SkillTransferLab().verify({ root, skill, sourceRepositoryIds: missions.map((mission) => mission.repositoryId), heldOutPack: CHECKPOINT_7_SKILL_TRANSFER_PACK });
  assert.equal(result.status, 'pass');
  assert.equal(result.repositoryDisjoint, true);
  assert.equal(result.solverApplied, true);
  assert.equal(result.testPassed, true);
  assert.equal(result.rollbackRestoredInputHash, true);
  assert.equal(result.trackedSourceUnchanged, true);
  assert.equal(result.workspaceRemoved, true);
  assert.match(result.transferReceiptSha256, /^[a-f0-9]{64}$/);
});

test('skill transfer rejects repository overlap and a held-out repair pattern outside the skill soundness scope', async () => {
  const skill = new VerifiedSkillCompiler().compile({ id: 'normalize-lowercase', version: '1', missions });
  await assert.rejects(() => new SkillTransferLab().verify({ root, skill, sourceRepositoryIds: [CHECKPOINT_7_SKILL_TRANSFER_PACK.repositoryId], heldOutPack: CHECKPOINT_7_SKILL_TRANSFER_PACK }), /disjoint|overlap/i);
  const incompatible = structuredClone(CHECKPOINT_7_SKILL_TRANSFER_PACK);
  incompatible.repair.from = 'return somethingElse;';
  incompatible.mutation.to = 'return somethingElse;';
  await assert.rejects(() => new SkillTransferLab().verify({ root, skill, sourceRepositoryIds: [], heldOutPack: incompatible }), /soundness|pattern/i);
});
