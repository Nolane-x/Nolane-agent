import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CHECKPOINT_8_AST_PACKS } from '../src/small-model/checkpoint-8-ast-pack.mjs';
import { AstSkillCompiler } from '../src/small-model/ast-skill-compiler.mjs';
import { AstSkillTransferLab } from '../src/small-model/ast-skill-transfer-lab.mjs';
import { canonicalSha256 } from '../src/small-model/shared.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const rehash = (value) => { const { receiptSha256: _old, ...base } = value; return { ...base, receiptSha256: canonicalSha256(base) }; };

test('AST recovery missions execute baseline, mutation failure, repair success, and rollback without changing tracked source', async () => {
  const lab = new AstSkillTransferLab();
  const mission = await lab.collectRecoveryMission({ root, pack: CHECKPOINT_8_AST_PACKS[0] });
  assert.equal(mission.status, 'verified-recovery');
  assert.equal(mission.steps.length >= 6, true);
  assert.equal(mission.baseline.exitCode, 0);
  assert.notEqual(mission.mutation.exitCode, 0);
  assert.equal(mission.repair.exitCode, 0);
  assert.equal(mission.rollbackRestoredMutationHash, true);
  assert.equal(mission.trackedSourceUnchanged, true);
  assert.equal(mission.bestCandidatePreserved, true);
  assert.equal(mission.hiddenChainOfThoughtStored, false);
  assert.match(mission.receiptSha256, /^[a-f0-9]{64}$/);
});

test('AstSkillCompiler induces a bounded syntax-aware skill from two distinct verified missions', async () => {
  const lab = new AstSkillTransferLab();
  const missions = await Promise.all(CHECKPOINT_8_AST_PACKS.slice(0, 2).map((pack) => lab.collectRecoveryMission({ root, pack })));
  const skill = new AstSkillCompiler().compile({ id: 'rename-legacy-name', version: '2', missions });
  assert.equal(skill.kind, 'ast-codemod');
  assert.deepEqual(skill.operations, [{ op: 'rename-identifier', from: 'legacyName', to: 'canonicalName', scope: 'program' }]);
  assert.deepEqual(skill.rollbackOperations, [{ op: 'rename-identifier', from: 'canonicalName', to: 'legacyName', scope: 'program' }]);
  assert.deepEqual(skill.allowedPaths, ['src/value.mjs']);
  assert.equal(skill.sourceRepositoryIds.length, 2);
  assert.equal(skill.hiddenChainOfThoughtStored, false);
  assert.match(skill.receiptSha256, /^[a-f0-9]{64}$/);
});

test('AstSkillTransferLab verifies project-disjoint transfer, comment/string preservation, and exact rollback', async () => {
  const lab = new AstSkillTransferLab();
  const missions = await Promise.all(CHECKPOINT_8_AST_PACKS.slice(0, 2).map((pack) => lab.collectRecoveryMission({ root, pack })));
  const skill = new AstSkillCompiler().compile({ id: 'rename-legacy-name', version: '2', missions });
  const result = await lab.verify({ root, skill, heldOutPack: CHECKPOINT_8_AST_PACKS[2] });
  assert.equal(result.status, 'pass');
  assert.equal(result.repositoryDisjoint, true);
  assert.equal(result.baselinePassed, true);
  assert.equal(result.mutationFailed, true);
  assert.equal(result.repairPassed, true);
  assert.equal(result.rollbackRestoredMutationHash, true);
  assert.equal(result.trackedSourceUnchanged, true);
  assert.equal(result.commentPreserved, true);
  assert.equal(result.stringPreserved, true);
  assert.equal(result.changedTokens, 1);
});

test('AstSkillCompiler rejects duplicate, mixed, unsafe, or hidden-reasoning missions', async () => {
  const lab = new AstSkillTransferLab();
  const [first, second] = await Promise.all(CHECKPOINT_8_AST_PACKS.slice(0, 2).map((pack) => lab.collectRecoveryMission({ root, pack })));
  const compiler = new AstSkillCompiler();
  assert.throws(() => compiler.compile({ id: 'x', version: '1', missions: [first, first] }), /distinct|duplicate/i);
  assert.throws(() => compiler.compile({ id: 'x', version: '1', missions: [first, rehash({ ...second, declaredRepair: { ...second.declaredRepair, operation: { ...second.declaredRepair.operation, to: 'otherName' } } })] }), /match|operation/i);
  assert.throws(() => compiler.compile({ id: 'x', version: '1', missions: [first, rehash({ ...second, hiddenChainOfThoughtStored: true })] }), /hidden|public/i);
  assert.throws(() => compiler.compile({ id: 'x', version: '1', missions: [first, rehash({ ...second, declaredRepair: { ...second.declaredRepair, path: '../escape.mjs' } })] }), /path|scope/i);
});

test('AST skill does not modify the tracked fixture source', async () => {
  const pack = CHECKPOINT_8_AST_PACKS[2];
  const before = await readFile(path.join(root, pack.rootPath, pack.sourcePath));
  const lab = new AstSkillTransferLab();
  const missions = await Promise.all(CHECKPOINT_8_AST_PACKS.slice(0, 2).map((value) => lab.collectRecoveryMission({ root, pack: value })));
  const skill = new AstSkillCompiler().compile({ id: 'rename-legacy-name', version: '2', missions });
  await lab.verify({ root, skill, heldOutPack: pack });
  const after = await readFile(path.join(root, pack.rootPath, pack.sourcePath));
  assert.equal(sha(before), sha(after));
});
