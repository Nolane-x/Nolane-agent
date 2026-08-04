import assert from 'node:assert/strict';
import test from 'node:test';
import { AdaptiveTopologySelector, DomainTrustRegistry, assignCausalCredit } from '../src/collaboration/adaptive-topology-selector.mjs';

const selector = new AdaptiveTopologySelector();

test('topology selector chooses smallest useful graph under risk and independence', () => {
  assert.equal(selector.select({ risk: 'low', independentSubtasks: 0, uncertainty: 0.1, availableAgentSlots: 4 }).topology, 'solo');
  assert.equal(selector.select({ risk: 'critical', securitySensitive: true, independentSubtasks: 1, uncertainty: 0.4, availableAgentSlots: 2 }).topology, 'executor-reviewer');
  assert.equal(selector.select({ risk: 'high', independentSubtasks: 3, uncertainty: 0.6, availableAgentSlots: 4, candidateValue: 0.9 }).topology, 'parallel-candidates');
  assert.equal(selector.select({ risk: 'high', independentSubtasks: 3, uncertainty: 0.6, availableAgentSlots: 1, resourcePressure: 0.9 }).topology, 'solo');
});

test('domain conditioned trust changes reviewer selection without global trust shortcuts', () => {
  const trust = new DomainTrustRegistry();
  trust.record({ agentId: 'r1', domain: 'security', taskType: 'review', evidenceType: 'static', success: true, confidence: 0.9 });
  trust.record({ agentId: 'r2', domain: 'frontend', taskType: 'review', evidenceType: 'visual', success: true, confidence: 0.95 });
  assert.equal(trust.rank({ domain: 'security', taskType: 'review', evidenceType: 'static', candidates: ['r1', 'r2'] })[0].agentId, 'r1');
});

test('causal credit uses contribution deltas instead of assigning all credit to last agent', () => {
  const result = assignCausalCredit({ outcomeValue: 1, contributions: [
    { actorId: 'retriever', withoutActorValue: 0.2 },
    { actorId: 'executor', withoutActorValue: 0.5 },
    { actorId: 'reviewer', withoutActorValue: 0.9 },
  ] });
  assert.equal(result.credits[0].actorId, 'retriever');
  assert.ok(result.credits[0].credit > result.credits.at(-1).credit);
});
