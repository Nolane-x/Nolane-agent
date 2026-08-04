import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { SmallModelFoundationService } from '../src/small-model/foundation-service.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);

test('foundation prepares checkpoint 9 transfer and property evidence, then requires explicit promotion v5', async () => {
  const service = new SmallModelFoundationService();
  assert.equal(service.checkpoint9Status().ready, false);
  const prepared = await service.prepareCheckpoint9Evidence({ root });
  assert.equal(prepared.status, 'pending-approval');
  assert.equal(prepared.portfolio.missions.length, 5);
  assert.equal(prepared.portfolio.refactorTransfer.repositoryDisjoint, true);
  assert.equal(prepared.portfolio.smtProperties.counterexamples.length, 0);
  assert.equal(prepared.portfolio.datalogProperties.counterexamples.length, 0);
  assert.throws(() => service.promoteCheckpoint9Suite({ bundleReceiptSha256: prepared.bundleReceiptSha256 }), /approval/i);
  const promoted = service.promoteCheckpoint9Suite({ bundleReceiptSha256: prepared.bundleReceiptSha256, approvedBy: 'checkpoint-owner' });
  assert.equal(promoted.promotion.schema, 'nolane.small-model.skill-promotion.v5');
  assert.equal(promoted.status.ready, true);
  assert.equal(service.status().checkpoint9Ready, true);
  assert.equal(service.status().claims.generalCodingIntelligence, false);
});

test('checkpoint 9 foundation executes only the promoted multi-file skill within bounded paths', async () => {
  const service = new SmallModelFoundationService();
  const prepared = await service.prepareCheckpoint9Evidence({ root });
  const files = [
    { path: 'src/api.mjs', source: `export function legacyName(value){ return value; }\n` },
    { path: 'src/direct.mjs', source: `import { legacyName } from './api.mjs';\nexport const value = legacyName(1);\n` },
    { path: 'src/alias.mjs', source: `import { legacyName as run } from './api.mjs';\nexport const value = run(2);\n` },
  ];
  assert.throws(() => service.executeCheckpoint9Refactor({ files }), /active|promoted/i);
  service.promoteCheckpoint9Suite({ bundleReceiptSha256: prepared.bundleReceiptSha256, approvedBy: 'checkpoint-owner' });
  const result = service.executeCheckpoint9Refactor({ files });
  assert.equal(result.changedFiles, 3);
  assert.match(result.files.find((file) => file.path === 'src/api.mjs').output, /canonicalName/);
  assert.throws(() => service.executeCheckpoint9Refactor({ files: [{ path: '../escape.mjs', source: 'export const legacyName = 1;' }] }), /path|traversal|scope/i);
});
