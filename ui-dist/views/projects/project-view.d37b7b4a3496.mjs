import { icon } from '../../core/icon.fa514a45d751.mjs';
import { t } from '../../core/i18n.3b3d8488d35f.mjs';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const activeStatuses = new Set(['planning', 'running', 'needs-input', 'needs_input', 'reviewing', 'testing']);

export function buildProjectViewModel({ id, path, name = null, trust = 'unknown', missions = [], defaultProvider = 'auto', defaultMode = 'balanced', rulesSummary = null } = {}) {
  if (!id || !path) throw new Error('Project view requires id and path');
  return Object.freeze({
    id: String(id),
    path: String(path),
    name: name ?? String(path).split(/[\\/]/).filter(Boolean).at(-1) ?? String(id),
    trust: String(trust),
    activeMissions: missions.filter((mission) => activeStatuses.has(mission.status)).length,
    completedMissions: missions.filter((mission) => mission.status === 'completed').length,
    defaultProvider,
    defaultMode,
    rulesSummary,
    openIntelligenceRoute: `/control-plane/intelligence/repository?project=${encodeURIComponent(id)}`,
  });
}

export function renderProjectView(value) {
  return renderProjectsView({ projects: [value], language: 'en' });
}

export function createProjectsController({ api, language = 'en' } = {}) {
  let state = { status: 'loading', language, projects: [], missions: [], error: null, query: '', view: 'grid' };
  const snapshot = () => structuredClone(state);
  return Object.freeze({
    snapshot,
    async load() {
      state.status = 'loading';
      const result = await Promise.allSettled([api.get('/api/projects'), api.get('/api/missions')]);
      const projects = result[0].status === 'fulfilled' ? (Array.isArray(result[0].value) ? result[0].value : result[0].value?.projects ?? []) : [];
      const missions = result[1].status === 'fulfilled' ? (Array.isArray(result[1].value) ? result[1].value : result[1].value?.missions ?? []) : [];
      state = {
        ...state,
        status: 'ready',
        projects: projects.map((project) => buildProjectViewModel({ ...project, path: project.path ?? project.root ?? project.id, missions: missions.filter((mission) => String(mission.projectId) === String(project.id)) })),
        missions,
        error: result.every((entry) => entry.status === 'rejected') ? 'Nolane runtime could not be reached.' : null,
      };
      return snapshot();
    },
    setQuery(query) {
      state.query = String(query ?? '');
      return snapshot();
    },
    setView(view) {
      state.view = view === 'activity' ? 'activity' : 'grid';
      return snapshot();
    },
  });
}

function trustTone(trust) {
  return trust === 'trusted' ? 'success' : trust === 'blocked' ? 'danger' : 'warning';
}

function missionTone(status) {
  return activeStatuses.has(status) ? 'active' : status === 'completed' ? 'success' : status === 'failed' ? 'danger' : 'warning';
}

function projectCard(project, language) {
  const optionsLabel = language === 'vi' ? `Mở thông tin ${project.name}` : `Open intelligence for ${project.name}`;
  return `<article class="project-card" data-project-id="${esc(project.id)}"><header><span class="project-card__mark">${icon('projects', { size: 19 })}</span><div><h2>${esc(project.name)}</h2><code>${esc(project.path)}</code></div><a class="project-card__options" href="#${esc(project.openIntelligenceRoute)}" data-route="${esc(project.openIntelligenceRoute)}" aria-label="${esc(optionsLabel)}">${icon('control', { size: 15 })}</a></header><div class="project-card__metrics"><span><strong>${project.activeMissions}</strong><small>${language === 'vi' ? 'đang chạy' : 'active'}</small></span><span><strong>${project.completedMissions}</strong><small>${language === 'vi' ? 'hoàn tất' : 'completed'}</small></span><span><i data-tone="${trustTone(project.trust)}"></i><small>${esc(project.trust)}</small></span></div><footer><a href="#/?project=${encodeURIComponent(project.id)}" data-route="/?project=${encodeURIComponent(project.id)}">${icon('chat', { size: 15 })}${t('projects.open', language)}</a><a href="#${esc(project.openIntelligenceRoute)}" data-route="${esc(project.openIntelligenceRoute)}">${icon('control', { size: 15 })}${t('projects.intelligence', language)}</a></footer></article>`;
}

function renderProjectActivity({ projects, missions, language }) {
  const byId = new Map(projects.map((project) => [String(project.id), project]));
  const entries = missions.filter((mission) => byId.has(String(mission.projectId)));
  if (!entries.length) return `<div class="empty-state page-empty project-activity-empty"><span>${icon('activity', { size: 20 })}</span><strong>${language === 'vi' ? 'Chưa có hoạt động dự án' : 'No project activity yet'}</strong><p>${language === 'vi' ? 'Các nhiệm vụ trong workspace đã chọn sẽ xuất hiện ở đây.' : 'Missions in the selected workspaces will appear here.'}</p></div>`;
  return `<div class="project-activity-list">${entries.map((mission) => {
    const project = byId.get(String(mission.projectId));
    const title = mission.title ?? mission.objective ?? mission.id;
    const status = String(mission.status ?? 'queued');
    return `<article class="project-activity" data-tone="${missionTone(status)}"><span class="project-activity__mark">${icon('activity', { size: 16 })}</span><div><strong>${esc(title)}</strong><small>${esc(project.name)} · ${esc(status)}</small></div><a href="#/?project=${encodeURIComponent(project.id)}" data-route="/?project=${encodeURIComponent(project.id)}" aria-label="${esc(language === 'vi' ? `Mở ${project.name}` : `Open ${project.name}`)}">${icon('arrow', { size: 14 })}</a></article>`;
  }).join('')}</div>`;
}

export function renderProjectsView(state = {}) {
  const language = state.language ?? 'en';
  const query = String(state.query ?? '').toLowerCase();
  const projects = (state.projects ?? []).filter((project) => !query || `${project.name} ${project.path} ${project.id}`.toLowerCase().includes(query));
  const view = state.view === 'activity' ? 'activity' : 'grid';
  const content = state.status === 'loading'
    ? `<div class="page-loading"><span class="spinner"></span>${t('common.loading', language)}</div>`
    : state.error
      ? `<div class="page-error">${icon('warning', { size: 18 })}<span>${esc(state.error)}</span></div>`
      : !projects.length
        ? `<div class="empty-state page-empty"><span>${icon('projects', { size: 20 })}</span><strong>${language === 'vi' ? 'Chưa có dự án' : 'No projects yet'}</strong><p>${t('projects.empty', language)}</p></div>`
        : view === 'activity'
          ? renderProjectActivity({ projects, missions: state.missions ?? [], language })
          : `<div class="project-grid">${projects.map((project) => projectCard(project, language)).join('')}</div>`;
  return `<section class="surface-page projects-page" data-project-view="${view}"><header class="surface-page__header"><div><p class="eyebrow">${language === 'vi' ? 'Danh mục workspace' : 'Workspace registry'}</p><h1>${t('projects.title', language)}</h1><p>${t('projects.subtitle', language)}</p></div><button type="button" class="surface-primary" data-project-action="add">${icon('plus', { size: 16 })}<span>${language === 'vi' ? 'Thêm dự án' : 'Add project'}</span></button></header><div class="surface-toolbar"><label class="surface-search">${icon('search', { size: 15 })}<input type="search" data-project-search placeholder="${language === 'vi' ? 'Tìm dự án…' : 'Search projects…'}" value="${esc(state.query ?? '')}"></label><div class="surface-view-toggle"><button type="button" data-project-view="grid" aria-pressed="${view === 'grid'}" aria-label="${language === 'vi' ? 'Chế độ lưới dự án' : 'Project grid view'}">${icon('projects', { size: 15 })}</button><button type="button" data-project-view="activity" aria-pressed="${view === 'activity'}" aria-label="${language === 'vi' ? 'Chế độ hoạt động dự án' : 'Project activity view'}">${icon('activity', { size: 15 })}</button></div></div>${content}</section>`;
}
