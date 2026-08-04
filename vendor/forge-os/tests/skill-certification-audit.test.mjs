import test from 'node:test';
import assert from 'node:assert/strict';
import { runSkillCertificationAudit } from '../src/benchmarks/skill-certification-audit.mjs';

test('certification audit separates declared maturity from evidence-qualified maturity', async () => {
  const report = await runSkillCertificationAudit();
  assert.equal(report.inventory.totalTechniques, 128);
  assert.equal(report.inventory.declaredStable, 33);
  assert.equal(report.inventory.declaredCertified, 0);
  assert.equal(report.evidenceQualified.stable, 0);
  assert.equal(report.evidenceQualified.certified, 0);
  assert.equal(report.claims.allKernelStableOrCertified, false);
  assert.equal(report.claims.allProceduralSkillsProductionGrade, false);
  assert.ok(report.blockers.some((item) => item.code === 'stable-public-scenarios-insufficient'));
  assert.ok(report.blockers.some((item) => item.code === 'hidden-holdout-missing'));
  assert.ok(report.blockers.some((item) => item.code === 'multi-model-paired-runs-missing'));
});

test('certification audit enforces the L0 fifty-scenario threshold', async () => {
  const report = await runSkillCertificationAudit();
  assert.equal(report.kernel.l0Total, 32);
  assert.equal(report.kernel.l0MeetingFiftyScenarioThreshold, 0);
  assert.equal(report.kernel.allL0Certified, false);
  assert.ok(report.kernel.l0ScenarioDeficits.every((item) => item.required === 50 && item.observed < 50));
});

test('certification audit is deterministic and content addressed', async () => {
  const first = await runSkillCertificationAudit();
  const second = await runSkillCertificationAudit();
  assert.equal(first.reportSha256, second.reportSha256);
  assert.deepEqual(first, second);
});
