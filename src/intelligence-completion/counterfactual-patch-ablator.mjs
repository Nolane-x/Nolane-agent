import { boundedArray, finite, redacted, sha, signed, text } from './completion-utils.mjs';

function normalizePath(value, label) { return text(value, label, 4_096).replaceAll('\\', '/').replace(/^\.\//, ''); }
function normalizeWorkspace(value) {
  if (!value || value.isolated !== true) throw new Error('adapter must create an isolated candidate workspace');
  return { workspaceId: text(value.workspaceId, 'workspaceId', 1_024), isolated: true };
}
function normalizeVerification(value, contract) {
  if (!value || value.verified !== true || value.verificationStatus !== 'passed') return null;
  const reportedContract = sha(value.verificationContractSha256, 'verificationContractSha256');
  if (reportedContract !== contract) return null;
  return {
    score: finite(value.score, 'verification score', Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY),
    verificationReceiptSha256: sha(value.verificationReceiptSha256, 'verificationReceiptSha256'),
  };
}
async function withTimeout(promise, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

export class CounterfactualPatchAblator {
  constructor({ maximumHunks = 128, timeoutMs = 120_000 } = {}) {
    this.maximumHunks = Math.max(1, Math.min(1_000, Math.floor(Number(maximumHunks) || 128)));
    this.timeoutMs = Math.max(100, Math.min(3_600_000, Math.floor(Number(timeoutMs) || 120_000)));
  }

  async run(input = {}) {
    const candidateId = text(input.candidateId, 'candidateId', 512);
    const verificationContractSha256 = sha(input.verificationContractSha256, 'verificationContractSha256');
    const hunks = boundedArray(input.hunks, 'hunks', this.maximumHunks).map((hunk, index) => ({
      hunkId: text(hunk?.hunkId, `hunks[${index}].hunkId`, 512),
      path: normalizePath(hunk?.path, `hunks[${index}].path`),
      sourceHash: hunk?.sourceHash == null ? null : sha(hunk.sourceHash, `hunks[${index}].sourceHash`),
    }));
    if (!hunks.length) throw new TypeError('hunks must not be empty');
    if (new Set(hunks.map((item) => item.hunkId)).size !== hunks.length) throw new Error('duplicate hunkId');
    const adapter = input.adapter;
    for (const method of ['createIsolatedCandidate', 'removeHunk', 'verify', 'dispose']) if (typeof adapter?.[method] !== 'function') throw new TypeError(`adapter.${method} is required`);

    let baselineWorkspace = null;
    let baseline;
    try {
      baselineWorkspace = normalizeWorkspace(await withTimeout(adapter.createIsolatedCandidate({ candidateId, hunkId: null, verificationContractSha256 }), this.timeoutMs, 'baseline workspace creation'));
      baseline = normalizeVerification(await withTimeout(adapter.verify({ candidateId, workspaceId: baselineWorkspace.workspaceId, verificationContractSha256, removedHunkId: null }), this.timeoutMs, 'baseline verification'), verificationContractSha256);
      if (!baseline) throw new Error('baseline verification must be verified, passed, and tied to the original contract');
    } finally {
      if (baselineWorkspace) await adapter.dispose({ candidateId, workspaceId: baselineWorkspace.workspaceId, hunkId: null }).catch(() => {});
    }

    const items = [];
    for (const hunk of hunks) {
      let workspace = null;
      try {
        workspace = normalizeWorkspace(await withTimeout(adapter.createIsolatedCandidate({ candidateId, hunkId: hunk.hunkId, verificationContractSha256 }), this.timeoutMs, `workspace creation for ${hunk.hunkId}`));
        const removal = await withTimeout(adapter.removeHunk({ candidateId, workspaceId: workspace.workspaceId, hunk, verificationContractSha256 }), this.timeoutMs, `hunk removal for ${hunk.hunkId}`);
        if (removal?.removed !== true) throw new Error('adapter did not confirm hunk removal');
        const patchReceiptSha256 = sha(removal.patchReceiptSha256, 'patchReceiptSha256');
        const verification = normalizeVerification(await withTimeout(adapter.verify({ candidateId, workspaceId: workspace.workspaceId, verificationContractSha256, removedHunkId: hunk.hunkId, patchReceiptSha256 }), this.timeoutMs, `verification for ${hunk.hunkId}`), verificationContractSha256);
        if (!verification) {
          items.push({ hunkId: hunk.hunkId, path: hunk.path, classification: 'inconclusive', scoreDelta: null, patchReceiptSha256, verificationReceiptSha256: null, reason: 'verification failed or contract receipt mismatched' });
          continue;
        }
        const scoreDelta = Number((verification.score - baseline.score).toFixed(6));
        items.push({
          hunkId: hunk.hunkId,
          path: hunk.path,
          classification: scoreDelta < 0 ? 'required' : 'unnecessary',
          scoreDelta,
          patchReceiptSha256,
          verificationReceiptSha256: verification.verificationReceiptSha256,
          reason: scoreDelta < 0 ? 'verified score regressed after hunk removal' : 'verified score did not regress after hunk removal',
        });
      } catch (error) {
        items.push({ hunkId: hunk.hunkId, path: hunk.path, classification: 'inconclusive', scoreDelta: null, patchReceiptSha256: null, verificationReceiptSha256: null, reason: redacted(error?.message ?? error, 1_000) });
      } finally {
        if (workspace) await adapter.dispose({ candidateId, workspaceId: workspace.workspaceId, hunkId: hunk.hunkId }).catch(() => {});
      }
    }

    return signed({
      schema: 'forge.counterfactual-patch-ablation.v1',
      candidateId,
      verificationContractSha256,
      baselineScore: baseline.score,
      baselineVerificationReceiptSha256: baseline.verificationReceiptSha256,
      items,
      claims: { patchAppliedToOriginalWorkspace: false, mergeOrPublishAllowed: false, verificationContractChanged: false, ablationResultAppliedAutomatically: false },
    });
  }
}
