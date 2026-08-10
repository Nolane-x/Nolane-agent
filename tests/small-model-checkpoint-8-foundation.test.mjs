import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SmallModelFoundationService } from '../src/small-model/foundation-service.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('foundation prepares and promotes checkpoint 8 solver portfolio separately', async () => {
  const service = new SmallModelFoundationService();
  assert.equal(service.checkpoint8Status().ready, false);
  const prepared = await service.prepareCheckpoint8Evidence({ root });
  assert.equal(prepared.status, 'pending-approval');
  assert.equal(prepared.portfolio.missions.length, 5);
  assert.equal(service.checkpoint8Status().ready, false);
  assert.throws(() => service.promoteCheckpoint8Suite({ bundleReceiptSha256: prepared.bundleReceiptSha256 }), /approval/i);
  const promoted = service.promoteCheckpoint8Suite({ bundleReceiptSha256: prepared.bundleReceiptSha256, approvedBy: 'checkpoint-owner' });
  assert.equal(promoted.promotions.length, 3);
  assert.equal(promoted.status.ready, true);
  assert.equal(service.status().checkpoint8Ready, true);
  assert.equal(service.status().claims.generalCodingIntelligence, false);
});

test('checkpoint 8 foundation executes only promoted AST and constraint skills within scope', async () => {
  const service = new SmallModelFoundationService();
  const prepared = await service.prepareCheckpoint8Evidence({ root });
  assert.throws(() => service.executeCheckpoint8AstSkill({ skillId: 'rename-legacy-name', path: 'src/value.mjs', source: 'const legacyName = 1;' }), /active|promoted/i);
  service.promoteCheckpoint8Suite({ bundleReceiptSha256: prepared.bundleReceiptSha256, approvedBy: 'checkpoint-owner' });
  const ast = service.executeCheckpoint8AstSkill({ skillId: 'rename-legacy-name', path: 'src/value.mjs', source: `// legacyName\nconst legacyName = 1;\nconst text = 'legacyName';\n` });
  assert.match(ast.output, /const canonicalName = 1/);
  assert.match(ast.output, /\/\/ legacyName/);
  assert.match(ast.output, /'legacyName'/);
  assert.throws(() => service.executeCheckpoint8AstSkill({ skillId: 'rename-legacy-name', path: '../escape.mjs', source: 'const legacyName = 1;' }), /scope|path/i);
  const smt = service.executeCheckpoint8ConstraintSkill({ skillId: 'bounded-test-plan' });
  assert.equal(smt.sat.status, 'sat');
  assert.equal(smt.unsat.status, 'unsat');
  const datalog = service.executeCheckpoint8ConstraintSkill({ skillId: 'bounded-test-impact' });
  assert.equal(datalog.datalog.converged, true);
});
