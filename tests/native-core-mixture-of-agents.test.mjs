import test from 'node:test';
import assert from 'node:assert/strict';
import { MixtureOfAgentsCoordinator } from '../src/native-core/mixture-of-agents-coordinator.mjs';

const proposer = (id, answer, evidence = [`evidence:${id}`]) => ({
  id,
  async propose(task, { signal }) {
    assert.equal(signal.aborted, false);
    return { answer: `${answer}:${task.goal}`, evidence, confidence: 0.8 };
  },
});

test('MoA runs distinct proposers, preserves disagreement and accepts only independently verified synthesis', async () => {
  const coordinator = new MixtureOfAgentsCoordinator({ maxProposers: 4, timeoutMs: 100 });
  const result = await coordinator.run({
    task: { goal: 'fix-bug', constraints: ['tests-pass'] },
    proposers: [proposer('a', 'patch-a'), proposer('b', 'patch-b')],
    synthesize: async ({ proposals, disagreement }) => ({ answer: proposals[0].answer, usedProposalIds: ['a'], disagreementObserved: disagreement }),
    verify: async ({ synthesis, proposals }) => ({
      passed: synthesis.answer === proposals[0].answer,
      verifierId: 'independent-verifier',
      evidence: ['test:passed'],
    }),
  });
  assert.equal(result.status, 'verified');
  assert.equal(result.disagreement, true);
  assert.deepEqual(result.proposals.map((entry) => entry.proposerId), ['a', 'b']);
  assert.equal(result.verification.verifierId, 'independent-verifier');
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(result), /chain.of.thought|reasoningText/i);
});

test('MoA rejects duplicate proposer identity and self-verification', async () => {
  const coordinator = new MixtureOfAgentsCoordinator();
  await assert.rejects(() => coordinator.run({
    task: { goal: 'x' },
    proposers: [proposer('same', 'a'), proposer('same', 'b')],
    synthesize: async () => ({ answer: 'x', usedProposalIds: ['same'] }),
    verify: async () => ({ passed: true, verifierId: 'v', evidence: ['x'] }),
  }), /distinct proposer/i);
  await assert.rejects(() => coordinator.run({
    task: { goal: 'x' },
    proposers: [proposer('a', 'a'), proposer('b', 'b')],
    synthesize: async () => ({ answer: 'x', usedProposalIds: ['a'] }),
    verify: async () => ({ passed: true, verifierId: 'a', evidence: ['x'] }),
  }), /independent verifier/i);
});

test('MoA fails closed on empty evidence, unbounded proposer count and hidden reasoning fields', async () => {
  const coordinator = new MixtureOfAgentsCoordinator({ maxProposers: 2 });
  await assert.rejects(() => coordinator.run({
    task: { goal: 'x' },
    proposers: [proposer('a', 'a'), proposer('b', 'b'), proposer('c', 'c')],
    synthesize: async () => ({ answer: 'x', usedProposalIds: [] }),
    verify: async () => ({ passed: true, verifierId: 'v', evidence: ['x'] }),
  }), /proposer budget/i);
  await assert.rejects(() => coordinator.run({
    task: { goal: 'x' },
    proposers: [proposer('a', 'a', []), proposer('b', 'b')],
    synthesize: async () => ({ answer: 'x', usedProposalIds: ['a'] }),
    verify: async () => ({ passed: true, verifierId: 'v', evidence: ['x'] }),
  }), /proposal evidence/i);
  await assert.rejects(() => coordinator.run({
    task: { goal: 'x' },
    proposers: [{ id: 'a', async propose() { return { answer: 'x', evidence: ['e'], chainOfThought: 'hidden' }; } }, proposer('b', 'b')],
    synthesize: async () => ({ answer: 'x', usedProposalIds: ['a'] }),
    verify: async () => ({ passed: true, verifierId: 'v', evidence: ['x'] }),
  }), /hidden reasoning/i);
});

test('MoA records timed-out proposer without allowing a false verified result', async () => {
  const coordinator = new MixtureOfAgentsCoordinator({ timeoutMs: 20 });
  await assert.rejects(() => coordinator.run({
    task: { goal: 'x' },
    proposers: [
      proposer('fast', 'ok'),
      { id: 'slow', async propose(_task, { signal }) { await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true })); throw signal.reason; } },
    ],
    synthesize: async () => ({ answer: 'x', usedProposalIds: ['fast'] }),
    verify: async () => ({ passed: true, verifierId: 'v', evidence: ['x'] }),
  }), /proposer failed|timed out/i);
});
