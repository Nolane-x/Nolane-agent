import { icon } from '../core/icon.a719e492545d.mjs';
import { t } from '../core/i18n.8af8c66b3366.mjs';
import { renderProjectPicker } from './project-picker.c08d9a76b470.mjs';

const NEEDS_USER = new Set(['needs_input', 'awaiting_approval', 'permission_required', 'action_required']);
const RUNNING = new Set(['planning', 'running', 'testing', 'recovering', 'paused']);
const REVIEW = new Set(['review', 'ready_to_review', 'ready_to_ship']);

function newestFirst(left, right) {
  return Number(right.updatedAt ?? right.createdAt ?? 0) - Number(left.updatedAt ?? left.createdAt ?? 0) || String(left.id).localeCompare(String(right.id));
}

export function buildSessionGroups(runs = [], approvals = []) {
  const groups = { needsYou: [], running: [], review: [], recent: [] };
  for (const approval of approvals) {
    groups.needsYou.push({ ...approval, id: String(approval.missionId ?? approval.id), status: 'awaiting_approval', attention: true });
  }
  for (const run of runs) {
    if (!run || run.archived) continue;
    const item = { ...run, id: String(run.id) };
    if (NEEDS_USER.has(item.status)) groups.needsYou.push(item);
    else if (RUNNING.has(item.status)) groups.running.push(item);
    else if (REVIEW.has(item.status)) groups.review.push(item);
    else groups.recent.push(item);
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
      const filtered = [...runs.values()].filter((item) => !needle || `${item.title ?? ''} ${item.id}`.toLowerCase().includes(needle));
      const grouped = buildSessionGroups(filtered, approvals);
      const totalRecent = grouped.recent.length;
      const visibleRecent = grouped.recent.slice(Math.max(0, recentOffset), Math.max(0, recentOffset) + Math.max(1, recentLimit));
      const visible = { ...grouped, recent: Object.freeze(visibleRecent) };
      const visibleKeys = new Map();
      for (const item of Object.values(visible).flat()) visibleKeys.set(item.id, ensureKey(item.id));
      return Object.freeze({ groups: Object.freeze(visible), totalRecent, rowKeys: visibleKeys, virtualized: totalRecent > recentLimit });
    },
  });
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function renderSessionSidebar(snapshot, { projects = [], selectedProjectId = null, language = 'en' } = {}) {
  const section = (title, items) => items.length ? `<section><h2>${title}</h2>${items.map((item) => `<button class="session-row" data-mission-id="${escapeHtml(item.id)}"><span>${escapeHtml(item.title ?? item.id)}</span><small>${escapeHtml(item.status)}</small></button>`).join('')}</section>` : '';
  const projectRows = projects.length
    ? `<section class="session-sidebar__projects"><header><h2>${t('shell.projects', language)}</h2><button type="button" data-project-action="new" aria-label="${escapeHtml(t('shell.newProject', language))}">${icon('plus', { size: 14 })}</button></header>${projects.slice(0, 8).map((project) => `<button type="button" class="session-project-row" data-project-choice data-project-id="${escapeHtml(project.id)}" aria-current="${String(project.id) === String(selectedProjectId) ? 'true' : 'false'}"><span>${icon('projects', { size: 15 })}</span><span>${escapeHtml(project.name ?? project.workspaceRoot ?? project.id)}</span></button>`).join('')}</section>`
    : '';
  return `${renderProjectPicker({ id: 'sidebar-project-picker', projects, selectedProjectId, language, mode: 'sidebar' })}${projectRows}${[section(t('session.needsYou', language), snapshot.groups.needsYou), section(t('session.running', language), snapshot.groups.running), section(t('session.review', language), snapshot.groups.review), section(t('session.recent', language), snapshot.groups.recent)].join('')}`;
}
