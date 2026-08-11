import { icon } from '../core/icon.587fe16a935a.mjs';
import { t } from '../core/i18n.6551ad72d3e2.mjs';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function normalizeProject(value = {}) {
  const id = String(value.id ?? '').trim();
  const name = String(value.name ?? value.path ?? value.workspaceRoot ?? id).trim() || id;
  const path = String(value.path ?? value.workspaceRoot ?? '').trim();
  return Object.freeze({ ...value, id, name, path, available: value.available !== false });
}

function sortProjects(left, right) {
  return Number(right.trusted) - Number(left.trusted)
    || Number(right.lastOpenedAt ?? right.updatedAt ?? 0) - Number(left.lastOpenedAt ?? left.updatedAt ?? 0)
    || left.name.localeCompare(right.name);
}

export function createProjectPickerModel({ projects = [], selectedProjectId = null, query = '', language = 'en', open = false } = {}) {
  const allProjects = projects.map(normalizeProject).filter((project) => project.id).sort(sortProjects);
  let state = { selectedProjectId: String(selectedProjectId ?? ''), query: String(query ?? ''), language, open: Boolean(open) };
  const snapshot = () => {
    const needle = state.query.trim().toLocaleLowerCase();
    const visible = allProjects.filter((project) => !needle || `${project.name} ${project.path}`.toLocaleLowerCase().includes(needle));
    const selected = allProjects.find((project) => project.id === state.selectedProjectId) ?? null;
    return Object.freeze({
      ...state,
      projects: Object.freeze(visible),
      selectedProject: selected,
      selectedProjectId: selected?.id ?? '',
      newProjectLabel: t('shell.newProject', state.language),
      noneLabel: t('shell.noProjectChoice', state.language),
      searchLabel: t('shell.searchProjects', state.language),
      selectLabel: t('shell.chooseProject', state.language),
    });
  };
  return Object.freeze({
    snapshot,
    setQuery(value) { state = { ...state, query: String(value ?? '') }; return snapshot(); },
    setOpen(value) { state = { ...state, open: Boolean(value) }; return snapshot(); },
    select(value) {
      const id = String(value ?? '');
      if (id && !allProjects.some((project) => project.id === id)) throw new Error(`Unknown project: ${id}`);
      state = { ...state, selectedProjectId: id, query: '', open: false };
      return snapshot();
    },
  });
}

export function renderProjectPicker({ id = 'project-picker', projects = [], selectedProjectId = null, language = 'en', query = '', open = false, mode = 'compact', name = 'projectId' } = {}) {
  const picker = createProjectPickerModel({ projects, selectedProjectId, language, query, open });
  const model = picker.snapshot();
  const selectedLabel = model.selectedProject?.name ?? t('home.noProject', language);
  const menuId = `${id}-menu`;
  const rows = model.projects.length
    ? model.projects.map((project) => `<button type="button" role="option" class="project-picker__row" aria-selected="${project.id === model.selectedProjectId}" data-project-choice data-project-id="${escapeHtml(project.id)}" data-project-search-text="${escapeHtml(`${project.name} ${project.path}`)}"><span class="project-picker__folder">${icon('projects', { size: 16 })}</span><span class="project-picker__copy"><strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(project.path)}</small></span><span class="project-picker__check">${project.id === model.selectedProjectId ? icon('check', { size: 15 }) : ''}</span></button>`).join('')
    : `<p class="project-picker__empty">${escapeHtml(t('projects.empty', language))}</p>`;
  return `<div class="project-picker project-picker--${escapeHtml(mode)}" data-project-picker="${escapeHtml(id)}" data-project-picker-mode="${escapeHtml(mode)}" data-selected-project-id="${escapeHtml(model.selectedProjectId)}">
    <button type="button" class="project-picker__trigger" data-project-picker-toggle aria-haspopup="dialog" aria-expanded="${model.open}" aria-controls="${escapeHtml(menuId)}"><span class="project-picker__trigger-icon">${icon('projects', { size: 15 })}</span><span class="project-picker__trigger-label">${escapeHtml(selectedLabel)}</span><span class="project-picker__trigger-chevron">${icon('chevron', { size: 15 })}</span></button>
    <div id="${escapeHtml(menuId)}" class="project-picker__menu" data-project-picker-menu role="dialog" aria-label="${escapeHtml(model.selectLabel)}"${model.open ? '' : ' hidden'}>
      <label class="project-picker__search"><span>${icon('search', { size: 15 })}</span><input type="search" data-project-search placeholder="${escapeHtml(model.searchLabel)}" value="${escapeHtml(model.query)}" autocomplete="off"></label>
      <div class="project-picker__list" role="listbox" aria-label="${escapeHtml(model.selectLabel)}">${rows}</div>
      <div class="project-picker__actions"><button type="button" data-project-action="new">${icon('plus', { size: 16 })}<span>${escapeHtml(model.newProjectLabel)}</span></button><button type="button" data-project-action="none">${icon('close', { size: 16 })}<span>${escapeHtml(model.noneLabel)}</span></button></div>
    </div>
    <input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(model.selectedProjectId)}" data-project-value>
  </div>`;
}

export function projectNameFromPath(value) {
  const normalized = String(value ?? '').replace(/[\\/]+$/, '');
  return normalized.split(/[\\/]/).at(-1) || t('shell.newProject', 'en');
}
