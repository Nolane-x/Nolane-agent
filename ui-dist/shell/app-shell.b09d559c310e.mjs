import { GLOBAL_DESTINATIONS, renderGlobalRail } from './global-rail.37c33e5b1e64.mjs';
import { createSessionSidebarModel, renderSessionSidebar } from './session-sidebar.df2cd5c889f9.mjs';
import { icon } from '../core/icon.669d52052301.mjs';
import { experienceMeta, normalizeExperience } from '../core/experience-policy.a95fd0f3233b.mjs';
import { t } from '../core/i18n.87fe48f05868.mjs';
import { renderExperienceSwitcher } from '../components/experience-switcher/experience-switcher.4190daaf28c6.mjs';
import { renderUpdateNotice } from '../components/update-notice/update-notice.105d9b771155.mjs';

let instanceCounter = 0;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
export { GLOBAL_DESTINATIONS };

export function createAppShellModel() {
  const railInstanceId = `rail-${++instanceCounter}`;
  const sidebarInstanceId = `sidebar-${++instanceCounter}`;
  let activePath = '/';
  return Object.freeze({ activate(path) { activePath = String(path || '/'); }, snapshot() { return Object.freeze({ product: 'Nolane Agent', activePath, railInstanceId, sidebarInstanceId }); } });
}

function sessionPlaceholder(language) {
  return `<div class="session-sidebar__empty"><span class="session-sidebar__orb">${icon('spark',{size:17})}</span><strong>${language === 'vi' ? 'Không gian làm việc yên tĩnh' : 'A quiet workspace'}</strong><p>${language === 'vi' ? 'Cuộc trò chuyện và nhiệm vụ gần đây sẽ xuất hiện ở đây.' : 'Recent conversations and missions will appear here.'}</p></div>`;
}

export function localizeRouteTitle(activePath, routeTitle, language) {
  const path = String(activePath || '/').split('?')[0];
  if (path === '/onboarding') return t('onboarding.title', language, routeTitle);
  const destination = GLOBAL_DESTINATIONS.find((item) => item.path === '/' ? path === '/' : path === item.path || path.startsWith(`${item.path}/`));
  return destination ? t(destination.labelKey, language, routeTitle) : routeTitle;
}

export function renderAppShell({ activePath = '/', content = '', sessionSnapshot = null, projects = [], selectedProjectId = null, sidebarCollapsed = false, routeTitle = 'Nolane Agent', experienceLevel = 'everyday', shellMode = 'default', language = 'en', runtimeState = 'online', updateState = null } = {}) {
  const snapshot = sessionSnapshot ?? (() => { const model = createSessionSidebarModel(); model.update({ runs: [], approvals: [] }); return model.snapshot(); })();
  const requestedExperience = String(experienceLevel || 'everyday');
  const experience = normalizeExperience(requestedExperience);
  const exp = experienceMeta(experience);
  const mode = shellMode === 'settings' ? 'settings' : 'default';
  const sessions = renderSessionSidebar(snapshot, { projects, selectedProjectId, language }) || sessionPlaceholder(language);
  const connectionLabel = runtimeState === 'online' ? t('shell.online', language) : t('shell.offline', language);
  const localizedTitle = localizeRouteTitle(activePath, routeTitle, language);
  return `<div class="app-shell" data-product="Nolane Agent" data-experience-level="${escapeHtml(requestedExperience)}" data-progressive-experience="${experience}" data-shell-mode="${mode}" data-sidebar-collapsed="${Boolean(sidebarCollapsed)}">
    ${renderGlobalRail({ activePath, experience, language })}
    <aside class="session-sidebar" aria-label="${t('shell.sessions',language)}">
      <div class="session-sidebar__brand"><div><span class="session-sidebar__brand-mark">${icon('spark',{size:16})}</span><span><strong>Nolane</strong><small>${t('shell.workspace',language)}</small></span></div><button type="button" data-command="collapse-sidebar" aria-label="${t('shell.collapse',language)}">${icon('menu',{size:17})}</button></div>
      <button class="session-sidebar__new" type="button" data-command="new-mission">${icon('plus',{size:17})}<span>${t('shell.new',language)}</span><kbd>⌘N</kbd></button>
      <label class="session-sidebar__search"><span>${icon('search',{size:15})}</span><input type="search" placeholder="${t('shell.search',language)}" data-session-search><kbd>⌘K</kbd></label>
      <div id="session-groups" class="session-sidebar__groups">${sessions}</div>
      <footer class="session-sidebar__footer"><span class="runtime-dot" data-state="${runtimeState}"></span><span>${escapeHtml(connectionLabel)}</span><button type="button" data-command="help" aria-label="${t('shell.help',language)}">?</button></footer>
    </aside>
    <div class="resize-handle resize-handle--sidebar" role="separator" tabindex="0" aria-label="${t('shell.resizeSidebar',language)}" aria-orientation="vertical" aria-valuemin="220" aria-valuemax="520" aria-valuenow="288" data-resize-region="sidebar"></div>
    <section class="app-main">
      <header class="app-topbar"><div class="app-topbar__trail"><button class="mobile-sidebar-toggle" type="button" data-command="open-sidebar" aria-label="${t('shell.openNavigation',language)}">${icon('menu',{size:18})}</button><div class="app-topbar__title">${escapeHtml(localizedTitle)}</div></div><button class="shell-command-search" type="button" data-command="global-search" aria-label="${t('shell.searchWorkspace',language)}">${icon('search',{size:16})}<span>${t('shell.searchWorkspace',language)}</span><kbd>⌘K</kbd></button><div class="app-topbar__actions"><span class="shell-runtime-status" data-state="${runtimeState}" role="status"><i></i><span>${escapeHtml(connectionLabel)}</span></span><button type="button" data-command="notifications" aria-label="${t('shell.notifications',language)}" title="${t('shell.notifications',language)}">${icon('activity',{size:17})}<span class="notification-indicator" hidden></span></button>${renderExperienceSwitcher({ current: experience, language })}<button type="button" data-command="toggle-summary" aria-haspopup="dialog" aria-controls="output-summary-root" title="${t('shell.summary',language)}" aria-label="${t('shell.summary',language)}">${icon('activity',{size:17})}</button></div></header>
      <div id="route-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true">${escapeHtml(localizedTitle)}</div><div id="update-notice-root">${renderUpdateNotice(updateState,{experience,language})}</div><main id="workspace" tabindex="-1">${content}</main>
    </section><div class="experience-transition-status" data-experience-transition-status role="status" aria-live="polite" hidden></div><div id="output-summary-resizer" class="resize-handle resize-handle--dock output-summary-resizer" role="separator" tabindex="0" aria-label="${t('shell.resizeSummary',language)}" aria-orientation="vertical" aria-valuemin="280" aria-valuemax="720" aria-valuenow="420" data-resize-region="dock" hidden></div><div id="output-summary-root" class="output-summary-root" data-open="false"></div>
  </div>`;
}
