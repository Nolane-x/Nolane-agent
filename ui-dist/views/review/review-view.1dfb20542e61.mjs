import { sha256 } from '../../core/receipt.db15136c4200.mjs';
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

const esc = escapeHtml;
function clone(item) { return JSON.parse(JSON.stringify(item)); }
function reviewPath(missionId) { return `/api/agent/runs/${encodeURIComponent(String(missionId ?? ''))}/diff-review`; }
function staleError(error) { return Number(error?.status) === 409 || /stale|snapshot changed|changed; refresh/i.test(String(error?.message ?? '')); }

export function createReviewController({ api, missionId, language = 'en' } = {}) {
  if (!api?.get || !api?.post) throw new TypeError('review api client is required');
  if (!missionId) throw new TypeError('missionId is required');
  const state = { status: 'idle', missionId: String(missionId), language, review: null, error: null, notice: null, busyHunkId: null };
  const load = async ({ preserveNotice = false } = {}) => {
    state.status = 'loading'; state.error = null; if (!preserveNotice) state.notice = null;
    try { state.review = await api.get(reviewPath(state.missionId)); state.status = 'ready'; return state.review; }
    catch (error) { state.status = 'error'; state.error = error?.message ?? String(error); return null; }
  };
  const decide = async ({ taskId, hunkId, decision, reason } = {}) => {
    if (!state.review?.reviewSha256) throw new Error('Review snapshot is not ready');
    if (!['accept','reject'].includes(decision)) throw new TypeError('decision must be accept or reject');
    const cleanReason = String(reason ?? '').trim(); if (!cleanReason) throw new TypeError('decision reason is required');
    state.busyHunkId = String(hunkId ?? ''); state.error = null; state.notice = null;
    try {
      const receipt = await api.post(`${reviewPath(state.missionId)}/decisions`, { taskId, hunkId, decision, expectedReviewSha256: state.review.reviewSha256, reason: cleanReason });
      await load({ preserveNotice: true });
      return { ok: true, receipt };
    } catch (error) {
      if (staleError(error)) {
        await load({ preserveNotice: true });
        state.notice = language === 'vi' ? 'Bản duyệt đã thay đổi. Nolane đã tải lại trạng thái mới nhất trước khi bạn quyết định.' : 'The review changed. Nolane refreshed the latest snapshot before you decide.';
        return { ok: false, stale: true, error };
      }
      state.error = error?.message ?? String(error);
      return { ok: false, stale: false, error };
    } finally { state.busyHunkId = null; }
  };
  return Object.freeze({ load, decide, snapshot: () => ({ ...state, review: state.review ? clone(state.review) : null }) });
}

function decisionLabel(decision, language) {
  const vi = language === 'vi';
  return ({ pending: vi ? 'Đang chờ' : 'Pending', accept: vi ? 'Đã chấp nhận' : 'Accepted', reject: vi ? 'Đã từ chối' : 'Rejected' })[decision] ?? String(decision ?? 'pending');
}
function lineKind(line) { return String(line).startsWith('+') ? 'add' : String(line).startsWith('-') ? 'remove' : 'context'; }
function renderServerReview(state, language) {
  const vi = language === 'vi';
  if (state.status === 'loading' && !state.review) return `<section class="page-loading" aria-busy="true"><span class="spinner"></span><span role="status">${vi?'Đang tải bản duyệt…':'Loading review…'}</span></section>`;
  if (state.status === 'error' && !state.review) return `<section class="page-error review-error"><p role="alert">${esc(state.error)}</p><button type="button" data-review-action="retry">${vi?'Thử lại':'Retry'}</button></section>`;
  const review = state.review;
  if (!review) return `<section class="page-empty"><strong>${vi?'Chưa có bản duyệt':'No review snapshot yet'}</strong></section>`;
  const hunks = (review.files ?? []).flatMap((file) => (file.hunks ?? []).map((hunk) => ({ file, hunk })));
  const counts = { pending: 0, accept: 0, reject: 0 };
  for (const { hunk } of hunks) counts[hunk.decision] = (counts[hunk.decision] ?? 0) + 1;
  const files = (review.files ?? []).map((file) => `<button type="button" data-review-file="${esc(file.path)}" data-preserve-key="review-file-${esc(file.taskId)}"><strong>${esc(file.path)}</strong><small>${(file.hunks??[]).length} ${vi?'đoạn':'hunks'} · ${esc(file.kind??'modified')}</small></button>`).join('');
  const body = hunks.length ? hunks.map(({ file, hunk }) => {
    const pending = (hunk.decision ?? 'pending') === 'pending';
    const busy = state.busyHunkId === hunk.id;
    const lines = (hunk.lines ?? []).map((line, index) => `<span data-line-kind="${lineKind(line)}" data-line-index="${index+1}">${esc(line)}</span>`).join('');
    const receipt = hunk.decisionReceiptSha256 ? `<small class="review-hunk__receipt" title="${esc(hunk.decisionReceiptSha256)}">${vi?'Biên nhận':'Receipt'} ${esc(hunk.decisionReceiptSha256.slice(0,12))}</small>` : '';
    const controls = pending ? `<div class="review-hunk__decision"><label><span>${vi?'Lý do quyết định':'Decision reason'}</span><textarea data-review-reason data-preserve-key="review-reason-${esc(hunk.id)}" rows="2" placeholder="${vi?'Ghi rõ lý do để quyết định có thể kiểm tra lại.':'Record why this hunk should be accepted or rejected.'}"></textarea></label><div><button type="button" data-review-decision="reject" data-task-id="${esc(file.taskId)}" data-hunk-id="${esc(hunk.id)}"${busy?' disabled aria-busy="true"':''}>${vi?'Từ chối':'Reject'}</button><button type="button" class="primary-action" data-review-decision="accept" data-task-id="${esc(file.taskId)}" data-hunk-id="${esc(hunk.id)}"${busy?' disabled aria-busy="true"':''}>${vi?'Chấp nhận':'Accept'}</button></div></div>` : '';
    return `<article class="review-hunk" data-review-hunk="${esc(hunk.id)}" data-decision="${esc(hunk.decision??'pending')}"><header><div><span>${esc(file.path)}</span><strong>${esc(hunk.header??hunk.id)}</strong></div><em>${esc(decisionLabel(hunk.decision,language))}</em></header><pre aria-label="${vi?'Nội dung thay đổi':'Diff hunk'}"><code>${lines}</code></pre>${receipt}${controls}</article>`;
  }).join('') : `<div class="page-empty"><strong>${vi?'Chưa có thay đổi cần duyệt':'No reviewable diff yet'}</strong><p>${vi?'Nhiệm vụ này chưa tạo diff có thể quyết định.':'This mission has not produced a decision-ready diff.'}</p></div>`;
  return `<section class="surface-page review-detail"><header class="surface-page__header"><div><p class="eyebrow">${vi?'Quyết định có bằng chứng':'Evidence-bound decision'}</p><h1>${vi?'Duyệt & phát hành':'Review & Ship'}</h1><p>${vi?'Duyệt từng đoạn trên snapshot chính xác; snapshot cũ sẽ bị từ chối.':'Decide each hunk against the exact current snapshot; stale decisions are rejected.'}</p></div><code class="ui-machine-id" title="${esc(review.reviewSha256)}">${esc(review.reviewSha256?.slice(0,12)??'unknown')}</code></header>${state.notice?`<div class="review-notice" role="status">${esc(state.notice)}</div>`:''}${state.error?`<div class="review-inline-error" role="alert">${esc(state.error)}</div>`:''}<div class="review-summary" aria-label="${vi?'Tóm tắt quyết định':'Decision summary'}"><span><strong>${counts.pending??0}</strong><small>${vi?'đang chờ':'pending'}</small></span><span><strong>${counts.accept??0}</strong><small>${vi?'chấp nhận':'accepted'}</small></span><span><strong>${counts.reject??0}</strong><small>${vi?'từ chối':'rejected'}</small></span></div><div class="review-shell"><aside class="change-navigator" aria-label="${vi?'Tệp đã thay đổi':'Changed files'}">${files||`<p>${vi?'Không có tệp thay đổi':'No changed files'}</p>`}</aside><main class="diff-viewport">${body}</main></div></section>`;
}

export function renderReviewView(state, { language = 'en' } = {}) {
  if ('status' in (state ?? {}) && ('review' in (state ?? {}) || state.status === 'loading' || state.status === 'error')) return renderServerReview(state, language);
  const vi = language === 'vi';
  const fileLabel = vi ? 'Tệp đã thay đổi' : 'Changed files';
  const hunkPrefix = vi ? 'Đoạn thay đổi' : 'Hunk';
  return `<section class="review-shell"><aside class="change-navigator"><h3>${fileLabel}</h3>${state.files.map((f) => `<button data-file="${esc(f.id)}">${esc(f.path)}</button>`).join('')}</aside><main class="diff-viewport">${state.hunks.map((h) => `<article data-hunk="${esc(h.id)}"><strong>${hunkPrefix} ${esc(h.id)}</strong><span>${esc(h.decision)}</span></article>`).join('')}</main></section>`;
}
