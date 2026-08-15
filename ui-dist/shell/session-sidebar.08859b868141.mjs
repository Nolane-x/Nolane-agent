import { icon } from '../core/icon.9bb9407145e5.mjs';
import { t } from '../core/i18n.95300b438fb2.mjs';
import { renderProjectPicker } from './project-picker.1328492b2330.mjs';

const NEEDS_USER = new Set(['needs_input', 'awaiting_approval', 'permission_required', 'action_required', 'waiting_for_user', 'blocked', 'failed', 'error']);
const RUNNING = new Set(['planning', 'queued', 'running', 'testing', 'recovering', 'paused']);
const REVIEW = new Set(['review', 'ready_to_review', 'ready_to_ship']);

const STATUS_COPY = Object.freeze({
  needs_input: ['Needs input', 'Cần phản hồi'],
  awaiting_approval: ['Approval', 'Chờ phê duyệt'],
  permission_required: ['Permission', 'Cần cấp quyền'],
  action_required: ['Action needed', 'Cần xử lý'],
  waiting_for_user: ['Waiting for you', 'Đang chờ bạn'],
  blocked: ['Blocked', 'Bị chặn'],
  failed: ['Failed', 'Thất bại'],
  error: ['Error', 'Lỗi'],
  planning: ['Planning', 'Lập kế hoạch'],
  queued: ['Queued', 'Đang xếp hàng'],
  running: ['Running', 'Đang chạy'],
  testing: ['Testing', 'Đang kiểm thử'],
  recovering: ['Recovering', 'Đang phục hồi'],
  paused: ['Paused', 'Tạm dừng'],
  review: ['Review', 'Cần đánh giá'],
  ready_to_review: ['Ready to review', 'Sẵn sàng đánh giá'],
  ready_to_ship: ['Ready to ship', 'Sẵn sàng phát hành'],
  completed: ['Complete', 'Hoàn tất'],
  cancelled: ['Cancelled', 'Đã hủy'],
  archived: ['Archived', 'Đã lưu trữ'],
});

function newestFirst(left, right) {
  return Number(right.updatedAt ?? right.createdAt ?? 0) - Number(left.updatedAt ?? left.createdAt ?? 0) || String(left.id).localeCompare(String(right.id));
}

function normalizeStatus(status) {
  return String(status ?? 'unknown').trim().toLowerCase().replace(/[\s-]+/g, '_') || 'unknown';
}

export function sessionStatusMeta(status, language = 'en') {
  const normalized = normalizeStatus(status);
  const copy = STATUS_COPY[normalized];
  const label = copy?.[language === 'vi' ? 1 : 0]
    ?? normalized.replace(/_/g, ' ').replace(/^./, (character) => character.toUpperCase());
  const kind = NEEDS_USER.has(normalized)
    ? 'attention'
    : RUNNING.has(normalized)
      ? 'running'
      : REVIEW.has(normalized)
        ? 'review'
        : normalized === 'completed'
          ? 'success'
          : 'muted';
  return Object.freeze({ status: normalized, label, kind });
}

export function buildSessionGroups(runs = [], approvals = []) {
  const groups = { needsYou: [], running: [], review: [], recent: [] };
  const seen = new Set();
  const pushUnique = (group, item) => {
    const id = String(item.id);
    if (seen.has(id)) return;
    seen.add(id);
    groups[group].push(item);
  };
  for (const approval of approvals) {
    const id = String(approval.missionId ?? approval.id);
    pushUnique('needsYou', { ...approval, id, status: 'awaiting_approval', attention: true });
  }
  for (const run of runs) {
    if (!run || run.archived) continue;
    const item = { ...run, id: String(run.id), status: normalizeStatus(run.status) };
    if (NEEDS_USER.has(item.status)) pushUnique('needsYou', item);
    else if (RUNNING.has(item.status)) pushUnique('running', item);
    else if (REVIEW.has(item.status)) pushUnique('review', item);
    else pushUnique('recent', item);
  }
  for (const values of Object.values(groups)) values.sort(newestFirst);
  return Object.freeze(Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, Object.freeze(value)])));
}

let rowSequence = 0;
export function createSessionSidebarModel() {
  const runs = new Map();
  let approvals = [];
  const rowKeys = new Map();

  function ensureKey(id) {
    if (!rowKeys.has(id)) rowKeys.set(id, Object.freeze({ id, sequence: ++rowSequence }));
    return rowKeys.get(id);
  }

  return Object.freeze({
    update({ runs: nextRuns = [], approvals: nextApprovals = [] } = {}) {
      runs.clear();
      for (const run of nextRuns) { const id = String(run.id); runs.set(id, { ...run, id }); ensureKey(id); }
      approvals = nextApprovals.map((item) => ({ ...item, missionId: String(item.missionId ?? item.id) }));
      for (const item of approvals) ensureKey(item.missionId);
    },
    patch(id, patch) {
      const key = String(id); const current = runs.get(key);
      if (!current) return false;
      runs.set(key, { ...current, ...patch, id: key }); ensureKey(key); return true;
    },
    snapshot({ recentOffset = 0, recentLimit = 100, query = '' } = {}) {
      const needle = String(query).trim().toLowerCase();
      const matches = (item, id = item.id) => !needle || `${item.title ?? ''} ${id ?? ''}`.toLowerCase().includes(needle);
      const filtered = [...runs.values()].filter((item) => matches(item));
      const filteredApprovals = approvals.filter((item) => matches(item, item.missionId));
      const grouped = buildSessionGroups(filtered, filteredApprovals);
      const totalRecent = grouped.recent.length;
      const visibleRecent = grouped.recent.slice(Math.max(0, recentOffset), Math.max(0, recentOffset) + Math.max(1, recentLimit));
      const visible = { ...grouped, recent: Object.freeze(visibleRecent) };
      const visibleKeys = new Map();
      for (const item of Object.values(visible).flat()) visibleKeys.set(item.id, ensureKey(item.id));
      const counts = Object.freeze(Object.fromEntries(Object.entries(grouped).map(([key, items]) => [key, items.length])));
      return Object.freeze({ groups: Object.freeze(visible), counts, totalRecent, rowKeys: visibleKeys, virtualized: totalRecent > recentLimit, query: String(query) });
    },
  });
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function projectNameFor(item, projectById) {
  const id = String(item?.projectId ?? item?.metadata?.projectId ?? '');
  if (!id) return '';
  const project = projectById.get(id);
  return String(project?.name ?? project?.workspaceRoot ?? '');
}

function rowAccessibleLabel(item, status, projectName) {
  return [item.title ?? item.id, status.label, projectName].filter(Boolean).join(' · ');
}

export function renderSessionSidebar(snapshot, { projects = [], selectedProjectId = null, activeMissionId = null, language = 'en' } = {}) {
  const projectById = new Map(projects.map((project) => [String(project.id), project]));
  const section = (key, title, items) => {
    if (!items.length) return '';
    const rows = items.map((item) => {
      const status = sessionStatusMeta(item.status, language);
      const projectName = projectNameFor(item, projectById);
      const active = String(item.id) === String(activeMissionId ?? '');
      const attention = Boolean(item.attention) || status.kind === 'attention';
      return `<button type="button" class="session-row" data-mission-id="${escapeHtml(item.id)}" data-state="${escapeHtml(status.status)}" data-state-kind="${status.kind}" data-attention="${attention}"${active ? ' aria-current="page"' : ''} aria-label="${escapeHtml(rowAccessibleLabel(item, status, projectName))}">
        <span class="session-row__trace" aria-hidden="true"></span>
        <span class="session-row__body"><strong title="${escapeHtml(item.title ?? item.id)}">${escapeHtml(item.title ?? item.id)}</strong>${projectName ? `<span class="session-row__context">${escapeHtml(projectName)}</span>` : ''}</span>
        <span class="session-row__status"><small>${escapeHtml(status.label)}</small>${attention ? `<span class="session-row__attention" aria-hidden="true">${icon('activity', { size: 11 })}</span>` : ''}</span>
      </button>`;
    }).join('');
    return `<section data-session-section="${key}"><header class="session-sidebar__section-header"><h2>${title}</h2><span class="session-sidebar__section-count" aria-label="${escapeHtml(`${title}: ${items.length}`)}">${items.length}</span></header>${rows}</section>`;
  };
  const projectRows = projects.length
    ? `<section class="session-sidebar__projects"><header><h2>${t('shell.projects', language)}</h2><button type="button" data-project-action="new" aria-label="${escapeHtml(t('shell.newProject', language))}">${icon('plus', { size: 14 })}</button></header>${projects.slice(0, 8).map((project) => `<button type="button" class="session-project-row" data-project-choice data-project-id="${escapeHtml(project.id)}" aria-current="${String(project.id) === String(selectedProjectId) ? 'true' : 'false'}"><span>${icon('projects', { size: 15 })}</span><span>${escapeHtml(project.name ?? project.workspaceRoot ?? project.id)}</span></button>`).join('')}</section>`
    : '';
  return `${renderProjectPicker({ id: 'sidebar-project-picker', projects, selectedProjectId, language, mode: 'sidebar' })}${projectRows}${[
    section('needs-you', t('session.needsYou', language), snapshot.groups.needsYou),
    section('running', t('session.running', language), snapshot.groups.running),
    section('review', t('session.review', language), snapshot.groups.review),
    section('recent', t('session.recent', language), snapshot.groups.recent),
  ].join('')}`;
}
