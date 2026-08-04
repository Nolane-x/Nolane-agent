import assert from 'node:assert/strict';
import test from 'node:test';
import { CompositionalSkillCompiler } from '../src/skills/compositional-skill-compiler.mjs';
import { SkillRegistry } from '../src/skills/skill-registry.mjs';

const receipt = (char) => char.repeat(64);
const verifiedEpisode = (id, repositoryId = 'repo-a') => ({ episodeId: id, repositoryId, verified: true, verificationReceiptSha256: receipt('a'), outcome: 'passed' });

function workflow(name = 'repair stale cache') {
  return {
    name,
    episodes: [verifiedEpisode('ep-1')],
    preconditions: [{ key: 'schemaChanged', type: 'boolean', equals: true }],
    parameters: [{ name: 'schemaPath', type: 'path' }, { name: 'verificationCommand', type: 'command' }],
    effects: [{ target: 'cache.generated', operation: 'set', valueType: 'boolean' }],
    invariants: ['public API unchanged'],
    verifier: { kind: 'command', commandId: 'verify-schema-cache' },
    failureSignatures: ['generated output differs nondeterministically'],
    costEstimate: { tokens: 1800, timeSeconds: 40, rssMbSeconds: 1200 },
    rollback: { kind: 'git-checkpoint', required: true },
    decomposition: ['locate generator', 'regenerate', 'compare semantic diff', 'run impacted tests'],
  };
}

test('CompositionalSkillCompiler compiles a verified workflow into a typed skill draft', () => {
  const compiler = new CompositionalSkillCompiler();
  const skill = compiler.compile(workflow());
  assert.equal(skill.state, 'draft');
  assert.equal(skill.parameters[0].type, 'path');
  assert.equal(skill.preconditions[0].key, 'schemaChanged');
  assert.equal(skill.effects[0].target, 'cache.generated');
  assert.deepEqual(skill.invariants, ['public API unchanged']);
  assert.equal(skill.verifier.commandId, 'verify-schema-cache');
  assert.equal(skill.rollback.required, true);
  assert.equal(skill.decomposition.length, 4);
  assert.match(skill.receiptSha256, /^[a-f0-9]{64}$/);
});

test('CompositionalSkillCompiler rejects unverified episodes and private reasoning', () => {
  const compiler = new CompositionalSkillCompiler();
  assert.throws(() => compiler.compile({ ...workflow(), episodes: [{ episodeId: 'ep-x', verified: false }] }), /verified episode/i);
  assert.throws(() => compiler.compile({ ...workflow(), chainOfThought: 'private' }), /private|hidden/i);
});

test('CompositionalSkillCompiler blocks incompatible recombination', () => {
  const compiler = new CompositionalSkillCompiler();
  const left = compiler.compile(workflow('left'));
  const right = compiler.compile({ ...workflow('right'), effects: [{ target: 'cache.generated', operation: 'delete', valueType: 'boolean' }] });
  const decision = compiler.recombine({ name: 'combined', skills: [left, right] });
  assert.equal(decision.compatible, false);
  assert.match(decision.reasons.join(' '), /effect conflict/i);
});

test('SkillRegistry requires transfer evidence on a different repository or vocabulary', () => {
  const compiler = new CompositionalSkillCompiler();
  const registry = new SkillRegistry();
  const skill = registry.add(compiler.compile(workflow()));
  assert.throws(() => registry.recordTransfer(skill.skillId, { sourceRepositoryId: 'repo-a', targetRepositoryId: 'repo-a', sourceVocabulary: 'schema', targetVocabulary: 'schema', passed: true, receiptSha256: receipt('b') }), /different repository or vocabulary/i);
  const tested = registry.recordTransfer(skill.skillId, { sourceRepositoryId: 'repo-a', targetRepositoryId: 'repo-b', sourceVocabulary: 'schema', targetVocabulary: 'contract', passed: true, receiptSha256: receipt('b') });
  assert.equal(tested.state, 'transfer-tested');
  assert.equal(tested.transferEvidence.length, 1);
});

test('SkillRegistry records parent, fork, merge, rejection, and revocation lineage', () => {
  const compiler = new CompositionalSkillCompiler();
  const registry = new SkillRegistry();
  const parent = registry.add(compiler.compile(workflow('parent')));
  const fork = registry.add(compiler.compile({ ...workflow('fork'), parentSkillIds: [parent.skillId], lineageAction: 'fork' }));
  const merge = registry.add(compiler.compile({ ...workflow('merge'), parentSkillIds: [parent.skillId, fork.skillId], lineageAction: 'merge' }));
  registry.transition(fork.skillId, 'rejected', { actor: 'reviewer', reason: 'negative transfer', receiptSha256: receipt('c') });
  registry.transition(merge.skillId, 'revoked', { actor: 'operator', reason: 'superseded', receiptSha256: receipt('d') });
  assert.equal(registry.get(fork.skillId).lineage.at(-1).action, 'rejected');
  assert.equal(registry.get(merge.skillId).lineage.at(-1).action, 'revoked');
  assert.deepEqual([...registry.get(merge.skillId).parentSkillIds].sort(), [fork.skillId, parent.skillId].sort());
});
