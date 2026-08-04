import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SqliteFederationEvaluationStore } from '../src/storage/sqlite-federation-eval-store.mjs';
import { evaluateFederatedProvider } from '../src/evals/federation-evaluator.mjs';
import { createPrincipal } from '../src/core/principals.mjs';

const evaluator = createPrincipal({ id: 'eval-service', type: 'service', roles: ['federation-evaluator'], scopes: ['evaluate'], trustDomain: 'forgeos' });

test('SQLite evaluation store persists immutable trusted receipts and detects duplicate digest reuse', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-eval-sqlite-'));
  const store = new SqliteFederationEvaluationStore(path.join(root, 'forgeos.db'));
  try {
    await store.initialize();
    const provider = { providerId: 'p', providerDigest: 'a'.repeat(64), capabilityId: 'c', observedAt: new Date().toISOString(), trust: { blockers: [] } };
    const receipt = evaluateFederatedProvider({ provider, capability: { capabilityId: 'c' }, scanReceipt: { status: 'pass', providerDigest: provider.providerDigest }, baseline: { passRate: .7, quality: 70, tokens: 1000 }, candidate: { passRate: .8, quality: 80, tokens: 900 } });
    const first = await store.record(receipt, { principal: evaluator });
    const second = await store.record(receipt, { principal: evaluator });
    assert.equal(first.receiptSha256, second.receiptSha256);
    assert.equal((await store.get(receipt.receiptSha256)).status, 'pass');
    assert.equal((await store.health()).ok, true);
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});
