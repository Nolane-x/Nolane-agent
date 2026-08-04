const STATUS_COPY = Object.freeze({ pending: 'Chờ quyết định', accept: 'Đã chấp nhận', reject: 'Đã loại bỏ' });

function ensureStyles() {
  if (document.querySelector('link[data-forge-diff-review-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = '/diff-review-center.css';
  link.dataset.forgeDiffReviewStyles = 'true';
  document.head.append(link);
}

function node(tag, className, text = null) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== null) element.textContent = String(text);
  return element;
}

function lineClass(line) {
  if (line.startsWith('+')) return 'added';
  if (line.startsWith('-')) return 'removed';
  return 'context';
}

function formatPath(file) {
  if (file.kind === 'renamed') return `${file.oldPath} → ${file.newPath}`;
  return file.path ?? file.newPath ?? file.oldPath ?? 'Unknown file';
}

function count(snapshot, decision) {
  return (snapshot?.files ?? []).flatMap((file) => file.hunks ?? []).filter((hunk) => (hunk.decision ?? 'pending') === decision).length;
}

export function createDiffReviewCenter({ root, api, toast }) {
  ensureStyles();
  if (!root) throw new TypeError('Diff Review Center root is required');
  if (typeof api !== 'function') throw new TypeError('Diff Review Center API client is required');
  let missionId = null;
  let snapshot = null;
  let loading = false;

  const renderEmpty = (message) => {
    const empty = node('div', 'diff-review-empty', message);
    root.replaceChildren(empty);
  };

  const renderHeader = () => {
    const header = node('header', 'diff-review-header');
    const copy = node('div');
    copy.append(node('span', 'eyebrow', 'Candidate worktree review'), node('h2', null, 'Diff Review Center'));
    const description = node('p', null, 'Chấp nhận hoặc loại bỏ từng hunk bằng snapshot hash. Branch chính không bị chỉnh sửa trực tiếp.');
    copy.append(description);
    const metrics = node('div', 'diff-review-metrics');
    const total = (snapshot.files ?? []).reduce((sum, file) => sum + (file.hunks?.length ?? 0), 0);
    for (const [label, value, tone] of [
      ['Files', snapshot.files?.length ?? 0, 'neutral'],
      ['Pending', count(snapshot, 'pending'), 'pending'],
      ['Accepted', count(snapshot, 'accept'), 'accepted'],
      ['Rejected', count(snapshot, 'reject'), 'rejected'],
      ['Hunks', total, 'neutral'],
    ]) {
      const metric = node('div', `diff-review-metric ${tone}`);
      metric.append(node('span', null, label), node('strong', null, value));
      metrics.append(metric);
    }
    const refresh = node('button', 'secondary-button diff-review-refresh', 'Làm mới');
    refresh.type = 'button';
    refresh.onclick = () => load(missionId, { force: true }).catch((error) => toast(error.message, true));
    header.append(copy, metrics, refresh);
    return header;
  };

  const decide = async ({ taskId, hunkId, decision, reason }) => {
    if (!snapshot || !missionId) return;
    try {
      await api(`/api/agent/runs/${encodeURIComponent(missionId)}/diff-review/decisions`, {
        method: 'POST',
        body: JSON.stringify({ taskId, hunkId, decision, reason, expectedReviewSha256: snapshot.reviewSha256 }),
      });
      toast(decision === 'accept' ? 'Đã chấp nhận hunk.' : 'Đã loại bỏ hunk khỏi candidate worktree.');
      await load(missionId, { force: true });
    } catch (error) {
      if (error.status === 409 || error.payload?.code === 'DIFF_REVIEW_STALE') {
        toast('Diff đã thay đổi. Nolane Agent đang tải snapshot mới để tránh áp quyết định lên mã cũ.', true);
        await load(missionId, { force: true });
        return;
      }
      throw error;
    }
  };

  const renderHunk = (file, hunk) => {
    const decision = hunk.decision ?? 'pending';
    const article = node('article', `diff-review-hunk ${decision}`);
    article.dataset.hunkId = hunk.id;
    const heading = node('header', 'diff-hunk-heading');
    const copy = node('div');
    copy.append(node('code', null, hunk.header), node('small', null, hunk.context || `Hunk ${String(hunk.id).slice(0, 10)}`));
    const badge = node('span', `diff-decision-badge ${decision}`, STATUS_COPY[decision] ?? decision);
    heading.append(copy, badge);
    const code = node('pre', 'diff-hunk-code');
    for (const raw of hunk.lines ?? []) {
      const line = node('code', `diff-hunk-line ${lineClass(raw)}`);
      const marker = node('span', 'diff-line-marker', raw[0] || ' ');
      const text = node('span', 'diff-line-text', raw.slice(1));
      line.append(marker, text); code.append(line);
    }
    article.append(heading, code);
    if (decision === 'pending') {
      const controls = node('div', 'diff-hunk-controls');
      const reason = document.createElement('input');
      reason.className = 'diff-review-reason'; reason.type = 'text'; reason.maxLength = 500;
      reason.placeholder = 'Lý do quyết định (khuyến nghị)';
      const accept = node('button', 'diff-decision-button accept', 'Chấp nhận');
      accept.type = 'button'; accept.setAttribute('data-diff-decision', 'accept');
      accept.onclick = () => decide({ taskId: file.taskId, hunkId: hunk.id, decision: 'accept', reason: reason.value.trim() || 'Accepted during hunk review' }).catch((error) => toast(error.message, true));
      const reject = node('button', 'diff-decision-button reject', 'Loại bỏ hunk');
      reject.type = 'button'; reject.setAttribute('data-diff-decision', 'reject');
      reject.disabled = file.kind !== 'modified';
      reject.title = reject.disabled ? 'Partial reject hiện chỉ hỗ trợ file modified, không áp dụng cho add/delete/rename.' : 'Áp reverse patch chính xác lên candidate worktree.';
      reject.onclick = () => decide({ taskId: file.taskId, hunkId: hunk.id, decision: 'reject', reason: reason.value.trim() || 'Rejected during hunk review' }).catch((error) => toast(error.message, true));
      controls.append(reason, accept, reject); article.append(controls);
    } else {
      const evidence = node('div', 'diff-decision-evidence');
      evidence.append(node('span', null, `${hunk.decisionActor ?? 'unknown'} · ${hunk.decisionReason ?? 'No reason'}`), node('code', null, `${String(hunk.decisionReceiptSha256 ?? '').slice(0, 18)}…`));
      article.append(evidence);
    }
    return article;
  };

  const renderFile = (file) => {
    const article = node('article', 'diff-review-file');
    const heading = node('header', 'diff-review-file-heading');
    const copy = node('div');
    copy.append(node('strong', null, formatPath(file)), node('small', null, `${file.kind} · task ${file.taskId}`));
    const countBadge = node('span', 'diff-file-count', `${file.hunks?.length ?? 0} hunks`);
    heading.append(copy, countBadge);
    const hunks = node('div', 'diff-review-hunks');
    hunks.append(...(file.hunks ?? []).map((hunk) => renderHunk(file, hunk)));
    article.append(heading, hunks); return article;
  };

  const render = () => {
    if (!snapshot?.files?.length) { renderEmpty('Nhiệm vụ chưa có diff trong builder/integrator worktree.'); return; }
    root.replaceChildren(renderHeader(), ...(snapshot.files ?? []).map(renderFile));
  };

  async function load(nextMissionId, { force = false } = {}) {
    if (!nextMissionId) { missionId = null; snapshot = null; renderEmpty('Chọn một nhiệm vụ để xem diff.'); return null; }
    if (loading) return snapshot;
    if (!force && missionId === nextMissionId && snapshot) return snapshot;
    loading = true; missionId = nextMissionId; root.setAttribute('aria-busy', 'true');
    try {
      snapshot = await api(`/api/agent/runs/${encodeURIComponent(missionId)}/diff-review`);
      render(); return snapshot;
    } finally { loading = false; root.removeAttribute('aria-busy'); }
  }

  return Object.freeze({ load, clear() { missionId = null; snapshot = null; renderEmpty('Chọn một nhiệm vụ để xem diff.'); } });
}
