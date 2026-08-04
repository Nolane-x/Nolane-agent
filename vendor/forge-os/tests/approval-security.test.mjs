import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProjectStore } from '../src/core/project-store.mjs';
import { ForgeOrchestrator } from '../src/core/orchestrator.mjs';
import { createPrincipal } from '../src/core/principals.mjs';
import { createTestEvidenceRegistry } from './helpers/trusted-evidence.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-approval-'));
  const store = new ProjectStore(root);
  const forge = new ForgeOrchestrator(store,{evidenceProviders:createTestEvidenceRegistry(root)});
  const project = await forge.createProject({ name: 'Approval security' });
  const human = createPrincipal({ id: 'human-owner', type: 'human', roles: ['owner','approver','security-reviewer'], scopes: ['approve','project:write'], trustDomain:'team:security' });
  const otherHuman = createPrincipal({ id: 'human-other', type: 'human', roles: ['approver'], scopes: ['approve'] });
  const agent = createPrincipal({ id: 'agent-builder', type: 'agent', roles: ['worker'], scopes: ['project:write'], trustDomain:'team:build' });
  const evaluator = createPrincipal({ id: 'agent-evaluator', type: 'agent', roles: ['evaluator'], scopes: ['project:write'] });
  return { forge, store, project, human, otherHuman, agent, evaluator };
}

const IDEA = {
  id: 'idea-1', title: 'One', thesis: 'A useful thesis', targetUser: 'Developer', hiddenProblem: 'Hidden friction',
  mechanism: 'Mechanism with proof binding', interface: 'CLI', valueModel: 'Subscription', distribution: 'Open source',
  assumptions: ['Users need it'], closestPattern: 'Existing tool', differences: ['Proof-bound workflow'],
  cheapestExperiment: 'Test with five users', failureModes: ['Low adoption'],
};

const SCORE = { ideaId: IDEA.id, novelty: 80, usefulness: 90, feasibility: 80, leverage: 75, defensibility: 70, testability: 85, clarity: 90, evidence: 75 };

async function prepareSelection(fixtureValue) {
  const { forge, store, project, evaluator } = fixtureValue;
  await forge.saveIdeas(project.id, [IDEA]);
  await forge.scoreIdeas(project.id, [SCORE], { principal: evaluator });
  await store.update(project.id, (current) => ({ ...current, stage: 'selection' }));
}

test('idea selection requires a one-time human approval bound to action and semantic revision', async () => {
  const context = await fixture();
  const { forge, project, human } = context;
  await prepareSelection(context);

  const approval = await forge.requestApproval(project.id, `select-idea:${IDEA.id}`, { principal: human });
  const selected = await forge.selectIdea(project.id, IDEA.id, 'Best mechanism', { principal: human, approvalToken: approval.token });
  assert.equal(selected.selectedIdeaId, IDEA.id);
  assert.deepEqual(selected.decisions.at(-1).decidedBy, { id: human.id, type: 'human', roles: ['owner','approver','security-reviewer'], trustDomain: 'team:security' });

  await assert.rejects(
    () => forge.selectIdea(project.id, IDEA.id, 'Reuse token', { principal: human, approvalToken: approval.token }),
    /used|approval/i,
  );
});

test('approval cannot be requested by an agent or consumed by another human', async () => {
  const context = await fixture();
  const { forge, project, human, otherHuman, agent } = context;
  await prepareSelection(context);
  await assert.rejects(() => forge.requestApproval(project.id, `select-idea:${IDEA.id}`, { principal: agent }), /human/i);
  const approval = await forge.requestApproval(project.id, `select-idea:${IDEA.id}`, { principal: human });
  await assert.rejects(
    () => forge.selectIdea(project.id, IDEA.id, 'Wrong principal', { principal: otherHuman, approvalToken: approval.token }),
    /principal|approval/i,
  );
});

test('approval becomes stale after any semantic mutation', async () => {
  const context = await fixture();
  const { forge, project, human } = context;
  await prepareSelection(context);
  const approval = await forge.requestApproval(project.id, `select-idea:${IDEA.id}`, { principal: human });
  await forge.recordIntent(project.id, {
    goal: 'Build a secure product', audience: 'developers', constraints: ['safe'], success: ['works'],
    nonGoals: ['guessing'], confirmed: true,
  });
  await assert.rejects(
    () => forge.selectIdea(project.id, IDEA.id, 'Stale approval', { principal: human, approvalToken: approval.token }),
    /stale|revision/i,
  );
});

test('finding cannot be closed with invented or unrelated evidence', async () => {
  const { forge, project, human, agent } = await fixture();
  const withFinding = await forge.addFinding(project.id, {
    title: 'Tenant boundary missing', category: 'security', severity: 'critical', description: 'Cross-tenant access possible',
  }, { principal: agent });
  const finding = withFinding.findings.at(-1);

  await assert.rejects(
    () => forge.closeFinding(project.id, finding.id, { resolution: 'Fixed', evidence: ['made-up'] }, { principal: human }),
    /evidence/i,
  );

  const proof = await forge.requestEvidence(project.id, { providerId:'test-command', recipeId:'pass', type:'finding-resolution', title:'Tenant isolation regression', subject:{findingId:finding.id} }, { principal: agent });
  const evidenceId = proof.evidence.at(-1).id;
  const closed = await forge.closeFinding(project.id, finding.id, { resolution: 'Tenant predicate enforced', evidence: [evidenceId] }, { principal: human });
  assert.equal(closed.findings.find((item) => item.id === finding.id).status, 'closed');
  assert.equal(closed.findings.find((item) => item.id === finding.id).closedBy.id, human.id);
});

test('accepting critical risk requires approval bound to the finding', async () => {
  const { forge, project, human, agent } = await fixture();
  const withFinding = await forge.addFinding(project.id, { title: 'Known residual risk', category: 'security', severity: 'critical' }, { principal: agent });
  const finding = withFinding.findings.at(-1);
  const approval = await forge.requestApproval(project.id, `accept-finding:${finding.id}`, { principal: human });
  const accepted = await forge.acceptFinding(project.id, finding.id, {
    reason: 'Time-bounded private beta with compensating control', approvalToken: approval.token,
  }, { principal: human });
  const result = accepted.findings.find((item) => item.id === finding.id);
  assert.equal(result.status, 'accepted');
  assert.equal(result.acceptedBy.id, human.id);
});
