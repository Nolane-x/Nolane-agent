import test from 'node:test';
import assert from 'node:assert/strict';
import { CounterfactualPatchAblator } from '../src/intelligence-completion/counterfactual-patch-ablator.mjs';

const H = (c) => c.repeat(64);

test('ablates every hunk in a fresh isolated candidate under the unchanged verification contract', async () => {
  const events = [];
  const contract = H('a');
  const adapter = {
    async createIsolatedCandidate({ hunkId }) { events.push(`create:${hunkId ?? 'baseline'}`); return { workspaceId: `w-${hunkId ?? 'baseline'}`, isolated: true }; },
    async removeHunk({ workspaceId, hunk }) { events.push(`remove:${workspaceId}:${hunk.hunkId}`); return { removed: true, patchReceiptSha256: H(hunk.hunkId === 'h1' ? 'b' : 'c') }; },
    async verify({ workspaceId, verificationContractSha256 }) {
      assert.equal(verificationContractSha256, contract);
      events.push(`verify:${workspaceId}`);
      const score = workspaceId.endsWith('h1') ? 7 : 10;
      return { verified: true, verificationStatus: 'passed', score, verificationContractSha256, verificationReceiptSha256: H(workspaceId.endsWith('h1') ? 'd' : 'e') };
    },
    async dispose({ workspaceId }) { events.push(`dispose:${workspaceId}`); },
  };
  const result = await new CounterfactualPatchAblator().run({ candidateId: 'candidate', verificationContractSha256: contract, hunks: [{ hunkId: 'h1', path: 'src/a.mjs' }, { hunkId: 'h2', path: 'src/b.mjs' }], adapter });
  assert.equal(result.baselineScore, 10);
  assert.equal(result.items.find((item) => item.hunkId === 'h1').classification, 'required');
  assert.equal(result.items.find((item) => item.hunkId === 'h2').classification, 'unnecessary');
  assert.deepEqual(events.filter((event) => event.startsWith('create:')), ['create:baseline', 'create:h1', 'create:h2']);
  assert.equal(events.filter((event) => event.startsWith('dispose:')).length, 3);
  assert.equal(result.claims.patchAppliedToOriginalWorkspace, false);
  assert.equal(result.claims.mergeOrPublishAllowed, false);
});

test('converts per-hunk adapter failures and contract mismatches to inconclusive while always disposing', async () => {
  const disposed = [];
  const contract = H('a');
  const adapter = {
    async createIsolatedCandidate({ hunkId }) { return { workspaceId: `w-${hunkId ?? 'baseline'}`, isolated: true }; },
    async removeHunk({ hunk }) { if (hunk.hunkId === 'error') throw new Error('remove failed'); return { removed: true, patchReceiptSha256: H('b') }; },
    async verify({ workspaceId, verificationContractSha256 }) {
      if (workspaceId.endsWith('mismatch')) return { verified: true, verificationStatus: 'passed', score: 10, verificationContractSha256: H('f'), verificationReceiptSha256: H('c') };
      return { verified: true, verificationStatus: 'passed', score: 10, verificationContractSha256, verificationReceiptSha256: H('d') };
    },
    async dispose({ workspaceId }) { disposed.push(workspaceId); },
  };
  const result = await new CounterfactualPatchAblator().run({ candidateId: 'candidate', verificationContractSha256: contract, hunks: [{ hunkId: 'error', path: 'a' }, { hunkId: 'mismatch', path: 'b' }], adapter });
  assert.ok(result.items.every((item) => item.classification === 'inconclusive'));
  assert.deepEqual(new Set(disposed), new Set(['w-baseline', 'w-error', 'w-mismatch']));
});

test('fails closed when baseline is not verified or workspace is not isolated', async () => {
  const contract = H('a');
  await assert.rejects(() => new CounterfactualPatchAblator().run({ candidateId: 'candidate', verificationContractSha256: contract, hunks: [{ hunkId: 'h1', path: 'a' }], adapter: {
    async createIsolatedCandidate() { return { workspaceId: 'w', isolated: true }; },
    async verify() { return { verified: false, verificationStatus: 'failed', score: 0, verificationContractSha256: contract, verificationReceiptSha256: H('b') }; },
    async removeHunk() { return { removed: true, patchReceiptSha256: H('c') }; },
    async dispose() {},
  } }), /baseline verification/);
  await assert.rejects(() => new CounterfactualPatchAblator().run({ candidateId: 'candidate', verificationContractSha256: contract, hunks: [{ hunkId: 'h1', path: 'a' }], adapter: {
    async createIsolatedCandidate() { return { workspaceId: 'w', isolated: false }; }, async verify() {}, async removeHunk() {}, async dispose() {},
  } }), /isolated/);
});
