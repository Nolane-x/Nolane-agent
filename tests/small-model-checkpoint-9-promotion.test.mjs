import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCheckpoint9MissionPortfolio } from '../src/small-model/checkpoint-9-mission-portfolio.mjs';
import { buildCheckpoint9EvidenceBundle } from '../src/small-model/checkpoint-9-evidence-bundle.mjs';
import { VerifiedSkillRegistry } from '../src/small-model/verified-skill-registry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('promotion v5 requires held-out transfer, property proofs, process, cost, safety, and approval', async () => {
  const portfolio = await buildCheckpoint9MissionPortfolio({ root });
  const evidence = buildCheckpoint9EvidenceBundle({ portfolio });
  const registry = new VerifiedSkillRegistry();
  registry.register(portfolio.refactorSkill);
  assert.throws(() => registry.promoteCheckpoint9({ skillReceiptSha256: portfolio.refactorSkill.receiptSha256, evidenceBundle: evidence }), /approval/i);
  const promotion = registry.promoteCheckpoint9({ skillReceiptSha256: portfolio.refactorSkill.receiptSha256, evidenceBundle: evidence, approvedBy: 'owner' });
  assert.equal(promotion.schema, 'nolane.small-model.skill-promotion.v5');
  assert.equal(promotion.governance, 'multi-file-transfer-property-process-cost-required');
  assert.equal(registry.active(portfolio.refactorSkill.id).receiptSha256, portfolio.refactorSkill.receiptSha256);
});

test('promotion v5 rejects tampered, incomplete, or unsafe evidence', async () => {
  const portfolio = await buildCheckpoint9MissionPortfolio({ root });
  const evidence = buildCheckpoint9EvidenceBundle({ portfolio });
  const registry = new VerifiedSkillRegistry();
  registry.register(portfolio.refactorSkill);
  assert.throws(() => registry.promoteCheckpoint9({ skillReceiptSha256: portfolio.refactorSkill.receiptSha256, evidenceBundle: { ...evidence, allowed: false }, approvedBy: 'owner' }), /hash|allowed/i);
  assert.throws(() => registry.promoteCheckpoint9({ skillReceiptSha256: portfolio.refactorSkill.receiptSha256, evidenceBundle: { ...evidence, safety: { noRegression: false, baselineViolations: 0, candidateViolations: 1 } }, approvedBy: 'owner' }), /hash|safety/i);
});
