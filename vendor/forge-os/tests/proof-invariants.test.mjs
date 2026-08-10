import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ProjectStore } from '../src/core/project-store.mjs';
import { ForgeOrchestrator } from '../src/core/orchestrator.mjs';
import { runGate } from '../src/core/gates.mjs';
import { validateIdea } from '../src/core/contracts.mjs';
import { trustedEvidenceRecord } from './helpers/trusted-evidence.mjs';

const passEvidence = (type, project, overrides = {}) => trustedEvidenceRecord(type, project, overrides);

function base(stage, assurance = 'A1') {
  return {
    id: 'forge_proof123', revision: 7, semanticRevision: 5, stage, assurance,
    intent: null, ideas: [], scores: [], selectedIdeaId: null,
    artifacts: [], evidence: [], findings: [], risks: [], decisions: [],
  };
}

test('a passing gate becomes unusable after a semantic mutation', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'forge-stale-gate-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new ProjectStore(dir);
  const forge = new ForgeOrchestrator(store);
  const project = await forge.createProject({ name: 'Stale gate' });
  await store.update(project.id, (state) => ({
    ...state,
    stage: 'divergence',
    ideas: [
      ['i0','compile execution traces into reusable agent procedures','developers','cli'],
      ['i1','run sealed-bid demand auctions before manufacturing inventory','retail buyers','marketplace'],
      ['i2','use privacy-preserving local sensors to predict equipment failure','factory operators','edge device'],
      ['i3','coordinate neighborhood energy through peer-to-peer load shifting','households','ambient controller'],
      ['i4','teach mathematics by generating manipulable geometric simulations','students','visual canvas'],
    ].map(([ideaId, mechanism, targetUser, interfaceName]) => validateIdea({ id:ideaId,title:ideaId,thesis:mechanism,targetUser,hiddenProblem:`hidden ${ideaId}`,mechanism,interface:interfaceName,valueModel:`value ${ideaId}`,distribution:`channel ${ideaId}`,assumptions:['testable'],closestPattern:`pattern ${ideaId}`,differences:[`difference ${ideaId}`],cheapestExperiment:`experiment ${ideaId}`,failureModes:[`failure ${ideaId}`] })),
  }));
  const gate = await forge.runCurrentGate(project.id);
  assert.equal(gate.status, 'pass');
  await forge.saveIdeas(project.id, []);
  await assert.rejects(() => forge.advance(project.id), /stale|current semantic revision|gate/i);
});

test('invalidated and superseded artifacts never satisfy product gates', () => {
  const project = base('product-definition');
  project.artifacts = [
    { id: 'a1', type: 'product-thesis', state: 'invalidated' },
    { id: 'a2', type: 'capability-map', state: 'superseded' },
  ];
  const gate = runGate(project);
  assert.equal(gate.status, 'fail');
  assert.deepEqual(new Set(gate.failedRules), new Set(['product-thesis','capability-map']));
});

test('label-only or unverified evidence cannot satisfy verification gates', () => {
  const project = base('verification');
  project.evidence = [
    { id: 'e1', type: 'verification-report', title: 'Verification report' },
    { id: 'e2', type: 'security-review', title: 'Security review' },
    { id: 'e3', type: 'ux-evidence', title: 'UX evidence' },
  ];
  assert.equal(runGate(project).status, 'fail');
});

test('proof must target the current semantic revision', () => {
  const project = base('verification');
  project.evidence = ['verification-report','security-review','ux-evidence','integration-test','rollback-proof'].map((type) => passEvidence(type, project, {
    subject: { projectId: project.id, revision: 1, semanticRevision: project.semanticRevision - 1, artifactId: null, artifactSha256: null, sourceCommit: 'abc1234' },
  }));
  assert.equal(runGate(project).status, 'fail');
  project.evidence = ['verification-report','security-review','ux-evidence','integration-test','rollback-proof'].map((type) => passEvidence(type, project));
  assert.equal(runGate(project).status, 'pass');
});

test('A4 release readiness enforces stronger proof than A0', () => {
  const a0 = base('release-readiness', 'A0');
  a0.artifacts = [{ id: 'release', type: 'release-dossier', state: 'verified', sha256: 'b'.repeat(64) }];
  a0.evidence = [passEvidence('verification-report', a0)];
  assert.equal(runGate(a0).status, 'pass');

  const a4 = structuredClone(a0);
  a4.assurance = 'A4';
  a4.evidence = [passEvidence('verification-report', a4)];
  const gate = runGate(a4);
  assert.equal(gate.status, 'fail');
  for (const rule of ['signed-provenance','independent-security-review','formal-invariant-evidence','supply-chain-attestation']) {
    assert.ok(gate.failedRules.includes(rule));
  }
});

test('gate result binds to semantic revision and input digest with per-rule evidence', () => {
  const project = base('verification');
  project.evidence = ['verification-report','security-review','ux-evidence','integration-test','rollback-proof'].map((type) => passEvidence(type, project));
  const gate = runGate(project);
  assert.equal(gate.evaluatedSemanticRevision, project.semanticRevision);
  assert.match(gate.inputSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(gate.evidenceByRule).sort(), ['integration-test','rollback-proof','security-review','ux-evidence','verification-report']);
});
