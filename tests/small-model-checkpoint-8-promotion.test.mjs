import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCheckpoint8MissionPortfolio } from '../src/small-model/checkpoint-8-mission-portfolio.mjs';
import { buildCheckpoint8EvidenceBundle } from '../src/small-model/checkpoint-8-evidence-bundle.mjs';
import { VerifiedSkillRegistry } from '../src/small-model/verified-skill-registry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('VerifiedSkillRegistry promotes AST and constraint skills only with explicit solver evidence approval', async () => {
  const portfolio = await buildCheckpoint8MissionPortfolio({ root });
  const evidence = buildCheckpoint8EvidenceBundle({ portfolio });
  const registry = new VerifiedSkillRegistry();
  for (const skill of [portfolio.astSkill, portfolio.smtSkill, portfolio.datalogSkill]) registry.register(skill);
  assert.throws(() => registry.promote({ skillReceiptSha256: portfolio.astSkill.receiptSha256, evidenceBundle: evidence }), /approval/i);
  const promotions = [portfolio.astSkill, portfolio.smtSkill, portfolio.datalogSkill].map((skill) => registry.promote({ skillReceiptSha256: skill.receiptSha256, evidenceBundle: evidence, approvedBy: 'checkpoint-owner' }));
  assert.equal(promotions.every((receipt) => receipt.schema === 'nolane.small-model.skill-promotion.v4'), true);
  assert.equal(registry.snapshot().activeSkills, 3);
  assert.equal(registry.active('rename-legacy-name').receiptSha256, portfolio.astSkill.receiptSha256);
  assert.equal(registry.active('bounded-test-plan').receiptSha256, portfolio.smtSkill.receiptSha256);
});

test('VerifiedSkillRegistry rejects stale evidence, unrelated skills, safety regression, and legacy bundles', async () => {
  const portfolio = await buildCheckpoint8MissionPortfolio({ root });
  const evidence = buildCheckpoint8EvidenceBundle({ portfolio });
  const registry = new VerifiedSkillRegistry();
  registry.register(portfolio.astSkill);
  assert.throws(() => registry.promote({ skillReceiptSha256: portfolio.astSkill.receiptSha256, evidenceBundle: { ...evidence, allowed: false }, approvedBy: 'owner' }), /hash|allowed/i);
  const unrelated = { ...portfolio.astSkill, id: 'other-skill' };
  assert.throws(() => registry.register(unrelated), /hash/i);
  assert.throws(() => registry.promote({ skillReceiptSha256: portfolio.astSkill.receiptSha256, evidenceBundle: { schema: 'nolane.small-model.checkpoint-7-evidence-bundle.v1' }, approvedBy: 'owner' }), /checkpoint 8|evidence/i);
  const badSafety = { ...evidence, safety: { baselineViolations: 0, candidateViolations: 1, noRegression: false } };
  assert.throws(() => registry.promote({ skillReceiptSha256: portfolio.astSkill.receiptSha256, evidenceBundle: badSafety, approvedBy: 'owner' }), /hash|safety/i);
});
