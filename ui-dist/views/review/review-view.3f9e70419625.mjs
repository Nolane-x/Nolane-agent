import { sha256 } from '../../core/receipt.c8cac115e06a.mjs';
let hunkIdentity = 0;
const DECISIONS = new Set(['pending', 'accepted', 'rejected', 'needs-change']);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function buildReviewSummary({ files = [], tests = {}, evidenceComplete = false, migrations = [], securityChanges = [], dependencies = [] } = {}) {
  const outOfScopeFiles = files.filter((file) => file.intended === false).length;
  const testsComplete = Number(tests.total) > 0 && Number(tests.passed) === Number(tests.total);
  const risk = outOfScopeFiles || migrations.length || securityChanges.length ? 'high' : dependencies.length || !testsComplete || !evidenceComplete ? 'medium' : 'low';
  return Object.freeze({ outOfScopeFiles, testsComplete, evidenceComplete: Boolean(evidenceComplete), migrations: migrations.length, securityChanges: securityChanges.length, dependencies: dependencies.length, risk, readyToShip: testsComplete && evidenceComplete && outOfScopeFiles === 0 });
}

export function createReviewModel({ missionId } = {}) {
  if (!missionId) throw new Error('Review model requires missionId');
  const files = new Map(); const hunks = new Map(); const hunkKeys = new Map();
  return Object.freeze({
    updateFiles(items = []) { for (const item of items) { if (!item?.id || !item.path) throw new Error('Review file requires id and path'); const id = String(item.id); files.set(id, Object.freeze({ intended: true, ...files.get(id), ...item, id })); } },
    updateHunks(items = []) { for (const item of items) { if (!item?.id || !item.fileId) throw new Error('Review hunk requires id and fileId'); const id = String(item.id); const content = String(item.content ?? ''); const contentSha256 = sha256(content); const previous = hunks.get(id); hunks.set(id, Object.freeze({ decision: 'pending', comments: Object.freeze([]), ...previous, ...item, id, content, contentSha256, decision: previous && previous.contentSha256 !== contentSha256 ? 'pending' : (item.decision ?? previous?.decision ?? 'pending') })); if (!hunkKeys.has(id)) hunkKeys.set(id, Object.freeze({ id, sequence: ++hunkIdentity })); } },
    decideHunk(id, decision, binding = null) { if (!DECISIONS.has(decision)) throw new Error(`Unknown hunk decision: ${decision}`); const hunk = hunks.get(String(id)); if (!hunk) throw new Error(`Unknown hunk: ${id}`); if (binding) { if (binding.expectedContentSha256 !== hunk.contentSha256) throw new Error(`Stale hunk decision: ${id}`); const available = new Set((hunk.evidenceIds ?? []).map(String)); const supplied = (binding.evidenceIds ?? []).map(String); if (supplied.length === 0 || supplied.some((value) => !available.has(value))) throw new Error('Review decision requires bound evidence'); const receipt = Object.freeze({ hunkId: String(id), decision, contentSha256: hunk.contentSha256, evidenceIds: Object.freeze(supplied), actor: String(binding.actor ?? 'unknown'), receiptSha256: sha256(JSON.stringify({ hunkId: String(id), decision, contentSha256: hunk.contentSha256, evidenceIds: supplied, actor: String(binding.actor ?? 'unknown') })) }); hunks.set(String(id), Object.freeze({ ...hunk, decision, decisionReceipt: receipt })); return receipt; } hunks.set(String(id), Object.freeze({ ...hunk, decision })); return null; },
    commentHunk(id, comment) { const hunk = hunks.get(String(id)); if (!hunk) throw new Error(`Unknown hunk: ${id}`); if (!comment?.text) throw new Error('Review comment requires text'); hunks.set(String(id), Object.freeze({ ...hunk, comments: Object.freeze([...(hunk.comments ?? []), Object.freeze({ author: String(comment.author ?? 'user'), text: String(comment.text) })]) })); },
    snapshot({ hunkOffset = 0, hunkLimit = 200 } = {}) {
      const allHunks = [...hunks.values()]; const offset = Math.max(0, Number(hunkOffset) || 0); const limit = Math.max(1, Number(hunkLimit) || 200);
      const allFiles = [...files.values()];
      return Object.freeze({ missionId: String(missionId), files: Object.freeze(allFiles), hunks: Object.freeze(allHunks.slice(offset, offset + limit)), totalHunks: allHunks.length, hunkKeys: new Map(hunkKeys), virtualized: allHunks.length > limit, decisions: Object.freeze(Object.fromEntries([...DECISIONS].map((decision) => [decision, allHunks.filter((hunk) => hunk.decision === decision).length]))) });
    },
  });
}

export function renderReviewView(snapshot, { language = 'en' } = {}) {
  const vi = language === 'vi';
  const navigation = vi ? `<nav class="change-navigator" aria-label="Tệp đã thay đổi">` : `<nav class="change-navigator" aria-label="Changed files">`;
  return `<section class="review-shell" data-mission-id="${escapeHtml(snapshot.missionId)}">${navigation}${snapshot.files.map((file) => `<button type="button" data-file-id="${escapeHtml(file.id)}">${escapeHtml(file.path)}</button>`).join('')}</nav><main class="diff-viewport">${snapshot.hunks.map((hunk) => `<article data-hunk-id="${escapeHtml(hunk.id)}" data-decision="${escapeHtml(hunk.decision)}">${vi ? 'Đoạn thay đổi' : 'Hunk'} ${escapeHtml(hunk.id)}</article>`).join('')}</main></section>`;
}
