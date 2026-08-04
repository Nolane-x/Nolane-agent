import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { SmallModelFoundationService } from '../src/small-model/foundation-service.mjs';
import { buildRepositorySpecialistDataset, REPOSITORY_SPECIALISTS } from '../src/small-model/repository-specialist-suite-dataset.mjs';

const trajectoryDir = path.join(process.cwd(), 'datasets', 'trajectories', 'repository-v1');

async function decisionInput(group) {
  const input = {};
  const keyBySpecialist = { 'tool-router':'tool', 'context-scorer':'context', 'test-selector':'test', 'patch-ranker':'patch', 'risk-classifier':'risk' };
  for (const specialist of REPOSITORY_SPECIALISTS) {
    const dataset = await buildRepositorySpecialistDataset({ trajectoryDir, specialist });
    const example = dataset.examples.find((entry) => entry.scenarioGroup === group);
    assert.ok(example, `${specialist} ${group}`);
    input[keyBySpecialist[specialist]] = example.state;
  }
  return input;
}

test('foundation bootstraps and promotes five repository specialists only with approval', async () => {
  const service = new SmallModelFoundationService();
  assert.equal(service.repositorySpecialistSuiteStatus().ready, false);
  await assert.rejects(
    service.bootstrapRepositorySpecialistSuite({ trajectoryDir }),
    /approval/i,
  );
  const result = await service.bootstrapRepositorySpecialistSuite({ trajectoryDir, approvedBy: 'checkpoint-owner' });
  assert.equal(result.promotions.length, 5);
  assert.equal(service.repositorySpecialistSuiteStatus().ready, true);
  assert.deepEqual(service.repositorySpecialistSuiteStatus().missing, []);
  assert.equal(service.status().repositorySpecialistSuiteReady, true);
  assert.equal(service.status().claims.generalCodingIntelligence, false);
});

test('repository decision support allows only low-risk accepted verified actions and blocks unsafe trajectories', async () => {
  const service = new SmallModelFoundationService();
  await service.bootstrapRepositorySpecialistSuite({ trajectoryDir, approvedBy: 'checkpoint-owner' });
  const safe = service.runRepositoryDecisionSupport(await decisionInput('context-utility-selector'));
  assert.equal(safe.status, 'allow');
  assert.equal(safe.allowed, true);
  assert.equal(safe.decisions.tool.action, 'read');
  assert.equal(safe.decisions.context.action, 'pin');
  assert.equal(safe.decisions.patch.action, 'accept');
  assert.equal(safe.decisions.risk.action, 'low');

  const unsafe = service.runRepositoryDecisionSupport(await decisionInput('browser-injection-guard'));
  assert.equal(unsafe.status, 'blocked');
  assert.equal(unsafe.allowed, false);
  assert.equal(unsafe.requiresApproval, true);
  assert.equal(unsafe.decisions.tool.action, 'stop');
  assert.equal(unsafe.decisions.patch.action, 'reject');
  assert.equal(unsafe.decisions.risk.action, 'critical');
});

test('repository decision support fails closed before all five artifacts are active', async () => {
  const service = new SmallModelFoundationService();
  assert.throws(
    () => service.runRepositoryDecisionSupport(awaitPromisePlaceholder),
    /active promoted artifact/i,
  );
});

const awaitPromisePlaceholder = Object.freeze({
  tool: {}, context: {}, test: {}, patch: {}, risk: {},
});
