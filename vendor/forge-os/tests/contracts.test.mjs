import test from 'node:test';
import assert from 'node:assert/strict';
import { validateIntent, validateIdea, validateArtifact, validateProjectId } from '../src/core/contracts.mjs';

const validIdea = {
  id: 'idea-1', title: 'Quiet Compiler', thesis: 'Compile repeated work into reusable agent procedures.',
  targetUser: 'small developer teams', hiddenProblem: 'automation knowledge disappears in chat history',
  mechanism: 'trace-to-skill compiler', interface: 'agent command', valueModel: 'time saved',
  distribution: 'open source plugin', assumptions: ['agents expose traces'], closestPattern: 'macro recorder',
  differences: ['semantic abstraction', 'cross-agent export'], cheapestExperiment: 'compile one task trace',
  failureModes: ['overfitting to one trace']
};

test('validateProjectId accepts safe IDs and rejects traversal', () => {
  assert.equal(validateProjectId('project_abc-123'), 'project_abc-123');
  assert.throws(() => validateProjectId('../secret'), /project id/i);
  assert.throws(() => validateProjectId('a/b'), /project id/i);
});

test('validateIntent requires explicit confirmation and concrete fields', () => {
  const value = validateIntent({ goal: 'Build a SaaS', audience: 'solo developers', constraints: ['8GB RAM'], success: ['working MVP'], confirmed: true });
  assert.equal(value.confirmed, true);
  assert.throws(() => validateIntent({ goal: 'Build something', confirmed: false }), /confirmed/i);
});

test('validateIdea returns a normalized complete idea', () => {
  const value = validateIdea(validIdea);
  assert.equal(value.mechanism, 'trace-to-skill compiler');
  assert.match(value.fingerprint, /^[a-f0-9]{64}$/);
});

test('validateArtifact enforces type, content, and bounded size', () => {
  const value = validateArtifact({ type: 'product-thesis', title: 'Spec', content: { thesis: 'A typed product contract.' }, version: 1 });
  assert.equal(value.version, 1);
  assert.throws(() => validateArtifact({ type: 'product-thesis', title: 'x', content: {}, version: 1 }), /requires content\.thesis/i);
});
