import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateIdea } from '../src/core/contracts.mjs';
import { clusterIdeas, ideaSimilarity } from '../src/core/scoring.mjs';
import { ProjectStore } from '../src/core/project-store.mjs';
import { ForgeOrchestrator } from '../src/core/orchestrator.mjs';
import { createPrincipal } from '../src/core/principals.mjs';

const base = (id, overrides = {}) => ({
  id, title: `Idea ${id}`, thesis: 'Turn long-form media into useful derivatives', targetUser: 'Video creators',
  hiddenProblem: 'Creators lose time finding highlights', mechanism: 'AI automatically divides long video into short clips',
  interface: 'Web editor', valueModel: 'Subscription', distribution: 'Creator communities', assumptions: ['Creators publish clips'],
  closestPattern: 'Video editor', differences: ['Mechanism-first highlight extraction'], cheapestExperiment: 'Process ten videos',
  failureModes: ['Poor highlight quality'], ...overrides,
});

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-ideas-'));
  const forge = new ForgeOrchestrator(new ProjectStore(root));
  const project = await forge.createProject({ name: 'Idea invariants' });
  const evaluator = createPrincipal({ id: 'evaluator-1', type: 'agent', roles: ['evaluator'], scopes: ['project:write'] });
  return { forge, project, evaluator };
}

const vector = (ideaId) => ({ ideaId, novelty: 80, usefulness: 90, feasibility: 75, leverage: 70, defensibility: 65, testability: 85, clarity: 80, evidence: 60 });

test('idea fingerprints are full length and content hashes change on any meaningful content change', () => {
  const a = validateIdea(base('a'));
  const b = validateIdea(base('a', { thesis: 'A changed thesis' }));
  assert.match(a.fingerprint, /^[a-f0-9]{64}$/);
  assert.match(a.sha256, /^[a-f0-9]{64}$/);
  assert.notEqual(a.sha256, b.sha256);
});

test('paraphrased mechanisms are clustered without pretending exact string equality', () => {
  const a = validateIdea(base('a'));
  const b = validateIdea(base('b', {
    mechanism: 'The system finds important moments and creates Shorts from a long recording',
    hiddenProblem: 'Finding highlights in long videos takes creators too much time',
  }));
  assert.ok(ideaSimilarity(a, b) >= 0.55);
  const clusters = clusterIdeas([a, b], { threshold: 0.55 });
  assert.equal(clusters.length, 1);
  assert.deepEqual(new Set(clusters[0].ideaIds), new Set(['a','b']));
});

test('scoring requires exactly one current score per idea and authenticated evaluator provenance', async () => {
  const { forge, project, evaluator } = await fixture();
  await forge.saveIdeas(project.id, [base('a'), base('b')]);
  await assert.rejects(() => forge.scoreIdeas(project.id, [vector('a'), vector('a')], { principal: evaluator }), /exactly once|duplicate/i);
  await assert.rejects(() => forge.scoreIdeas(project.id, [vector('a')], { principal: evaluator }), /every current idea|exactly/i);
  const scored = await forge.scoreIdeas(project.id, [vector('a'), vector('b')], { principal: evaluator, rubricVersion: 'creativity-v2' });
  assert.equal(scored.scores.length, 2);
  for (const score of scored.scores) {
    assert.equal(score.evaluator.id, evaluator.id);
    assert.equal(score.rubricVersion, 'creativity-v2');
    assert.equal(score.ideaSha256, scored.ideas.find((idea) => idea.id === score.ideaId).sha256);
  }
});

test('replacing ideas invalidates active downstream artifacts and scores', async () => {
  const { forge, project, evaluator } = await fixture();
  let current = await forge.saveIdeas(project.id, [base('a')]);
  current = await forge.scoreIdeas(project.id, [vector('a')], { principal: evaluator });
  current = await forge.saveArtifact(project.id, { type: 'product-thesis', title: 'Thesis', content: { thesis: 'Based on a' } });
  const replaced = await forge.saveIdeas(project.id, [base('b')]);
  assert.equal(replaced.scores.length, 0);
  assert.equal(replaced.selectedIdeaId, null);
  assert.equal(replaced.artifacts.find((item) => item.type === 'product-thesis').state, 'invalidated');
});
