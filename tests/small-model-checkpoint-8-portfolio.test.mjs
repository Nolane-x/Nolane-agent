import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { buildCheckpoint8MissionPortfolio } from '../src/small-model/checkpoint-8-mission-portfolio.mjs';
import { buildCheckpoint8EvidenceBundle } from '../src/small-model/checkpoint-8-evidence-bundle.mjs';
import { canonicalSha256 } from '../src/small-model/shared.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);

test('Checkpoint 8 portfolio contains five ordered syntax and constraint missions with preserved candidates', async () => {
  const portfolio = await buildCheckpoint8MissionPortfolio({ root });
  assert.equal(portfolio.missions.length, 5);
  assert.deepEqual(portfolio.families, ['ast-induction', 'ast-transfer', 'bounded-datalog', 'finite-domain-smt']);
  assert.equal(portfolio.missions.every((mission) => Array.isArray(mission.steps) && mission.steps.length >= 3), true);
  assert.equal(portfolio.missions.every((mission) => mission.bestCandidatePreserved === true), true);
  assert.equal(portfolio.processValue > 0, true);
  assert.equal(portfolio.cost.candidateCostLower, true);
  assert.equal(portfolio.astTransfer.repositoryDisjoint, true);
  assert.equal(portfolio.smtProof.sat.status, 'sat');
  assert.equal(portfolio.smtProof.unsat.status, 'unsat');
  assert.equal(portfolio.datalogProof.unsafeProbeRejected, true);
  assert.equal(portfolio.hiddenChainOfThoughtStored, false);
});

test('Checkpoint 8 evidence bundle binds AST transfer, constraint proofs, process value, and cost receipts', async () => {
  const portfolio = await buildCheckpoint8MissionPortfolio({ root });
  const bundle = buildCheckpoint8EvidenceBundle({ portfolio });
  assert.equal(bundle.schema, 'nolane.small-model.checkpoint-8-evidence-bundle.v1');
  assert.equal(bundle.allowed, true);
  assert.equal(bundle.astTransferReceiptSha256, portfolio.astTransfer.receiptSha256);
  assert.equal(bundle.constraintProofReceiptSha256.length, 2);
  assert.equal(bundle.process.allowed, true);
  assert.equal(bundle.cost.candidateCostLower, true);
  assert.equal(bundle.safety.noRegression, true);
  assert.match(bundle.receiptSha256, /^[a-f0-9]{64}$/);
});

test('Checkpoint 8 evidence bundle rejects tampering, non-positive process value, or cost regression', async () => {
  const portfolio = await buildCheckpoint8MissionPortfolio({ root });
  const { receiptSha256: _old, ...base } = portfolio;
  const tampered = { ...base, processValue: 0 };
  tampered.receiptSha256 = canonicalSha256(tampered);
  assert.throws(() => buildCheckpoint8EvidenceBundle({ portfolio: tampered }), /process/i);
  const badCostBase = { ...base, cost: { ...base.cost, candidateCostLower: false, totalCostRatio: 1.2 } };
  const badCost = { ...badCostBase, receiptSha256: canonicalSha256(badCostBase) };
  assert.throws(() => buildCheckpoint8EvidenceBundle({ portfolio: badCost }), /cost/i);
  assert.throws(() => buildCheckpoint8EvidenceBundle({ portfolio: { ...portfolio, processValue: 999 } }), /hash/i);
});
