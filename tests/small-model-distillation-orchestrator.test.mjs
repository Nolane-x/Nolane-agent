import test from 'node:test';
import assert from 'node:assert/strict';
import { DistillationOrchestrator } from '../src/small-model/distillation-orchestrator.mjs';

const step = (overrides = {}) => ({
  id: 'step-1', episodeId: 'ep-1', kind: 'tool-policy', repositoryId: 'repo-train', domain: 'javascript',
  state: { taskType: 'bug-fix', evidenceIds: ['e1'] },
  teacher: { id: 'teacher-a', action: { type: 'run-test', parameters: { target: 'focused' } } },
  student: { action: { type: 'run-test', parameters: { target: 'focused' } } },
  expectedEffect: { criterionDelta: 1 }, actualEffect: { criterionDelta: 1, changed: true },
  oracle: { id: 'test-oracle', valid: true, independent: true, readOnly: true },
  safety: { rewardHacking: false, unsafe: false }, cost: { tokens: 12 },
  ...overrides,
});

test('DistillationOrchestrator requires an independent read-only oracle for every step', () => {
  const orchestrator = new DistillationOrchestrator();
  assert.throws(() => orchestrator.recordStep(step({ oracle: null })), /oracle/i);
  assert.throws(() => orchestrator.recordStep(step({ oracle: { id: 'x', valid: true, independent: false, readOnly: true } })), /independent/i);
  const receipt = orchestrator.recordStep(step());
  assert.match(receipt.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(receipt.divergence, 0);
});

test('DistillationOrchestrator rejects hallucination, repeated loops, effectless actions and unsafe terminal passes', () => {
  const orchestrator = new DistillationOrchestrator();
  assert.throws(() => orchestrator.recordStep(step({ hallucination: true })), /hallucination/i);
  assert.throws(() => orchestrator.recordStep(step({ actualEffect: { changed: false, criterionDelta: 0, informationGain: 0 } })), /effectless/i);
  orchestrator.recordStep(step());
  assert.throws(() => orchestrator.recordStep(step({ id: 'step-2' })), /repeated loop/i);
  assert.throws(() => orchestrator.recordStep(step({ id: 'step-3', safety: { rewardHacking: true, unsafe: false } })), /reward hacking/i);
});

test('DistillationOrchestrator separates offline and on-policy lanes and reduces supervision at high divergence', () => {
  const orchestrator = new DistillationOrchestrator({ divergenceCutoff: 0.5 });
  orchestrator.registerTeacher({ id: 'teacher-a', domains: ['javascript'], trust: 0.9 });
  orchestrator.registerTeacher({ id: 'teacher-b', domains: ['python'], trust: 0.8 });
  orchestrator.recordStep(step());
  const divergent = orchestrator.recordOnPolicyStep(step({
    id: 'step-2', episodeId: 'ep-2', repositoryId: 'repo-train-2',
    student: { action: { type: 'edit-file', parameters: { path: 'a.js' } } },
  }));
  assert.equal(divergent.lane, 'on-policy');
  assert.equal(divergent.supervisionWeight, 0);
  assert.equal(orchestrator.buildOfflineDataset({ kind: 'tool-policy' }).length, 1);
  assert.equal(orchestrator.snapshot().teachers, 2);
});

test('DistillationOrchestrator selects self-consistent actions with domain-conditioned teacher trust', () => {
  const orchestrator = new DistillationOrchestrator();
  orchestrator.registerTeacher({ id: 'teacher-a', domains: ['javascript'], trust: 0.9 });
  orchestrator.registerTeacher({ id: 'teacher-b', domains: ['javascript'], trust: 0.4 });
  orchestrator.registerTeacher({ id: 'teacher-c', domains: ['python'], trust: 1 });
  const selected = orchestrator.selfConsistentAction({ domain: 'javascript', candidates: [
    { teacherId: 'teacher-a', action: { type: 'run-test', parameters: { target: 'x' } } },
    { teacherId: 'teacher-b', action: { type: 'run-test', parameters: { target: 'x' } } },
    { teacherId: 'teacher-c', action: { type: 'delete-file', parameters: { path: 'x' } } },
  ] });
  assert.equal(selected.action.type, 'run-test');
  assert.equal(selected.votes, 2);
  assert.equal(selected.domainTrustWeight, 1.3);
});

test('DistillationOrchestrator promotes only policies passing held-out repositories and supports rollback', () => {
  const orchestrator = new DistillationOrchestrator();
  orchestrator.recordStep(step());
  assert.throws(() => orchestrator.promoteStudentPolicy({ id: 'router', version: '1', stepIds: ['step-1'], heldOut: [] }), /held-out/i);
  const v1 = orchestrator.promoteStudentPolicy({ id: 'router', version: '1', stepIds: ['step-1'], heldOut: [
    { repositoryId: 'repo-held-1', tuned: false, passed: true },
    { repositoryId: 'repo-held-2', tuned: false, passed: true },
  ] });
  const v2 = orchestrator.promoteStudentPolicy({ id: 'router', version: '2', stepIds: ['step-1'], heldOut: [
    { repositoryId: 'repo-held-3', tuned: false, passed: true },
  ] });
  assert.notEqual(v1.policySha256, v2.policySha256);
  assert.equal(orchestrator.rollbackStudentPolicy('router').version, '1');
});
