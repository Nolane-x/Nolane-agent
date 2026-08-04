import { GLOBAL_DESTINATIONS, renderGlobalRail } from './global-rail.0c3805a5e84c.mjs';
import { createSessionSidebarModel, renderSessionSidebar } from './session-sidebar.d9ca6a7f19cc.mjs';
import { icon } from '../core/icon.c3afdb20bfa7.mjs';
import { experienceMeta, normalizeExperience } from '../core/experience-policy.a90dc2938065.mjs';
import { t } from '../core/i18n.4d2f51f62c3c.mjs';
import { renderExperienceSwitcher } from '../components/experience-switcher/experience-switcher.dd71e5fcc609.mjs';
import { renderUpdateNotice } from '../components/update-notice/update-notice.07c013c36623.mjs';

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

export function renderAppShell({ activePath = '/', content = '', sessionSnapshot = null, routeTitle = 'Nolane Agent', experienceLevel = 'everyday', shellMode = 'default', language = 'en', runtimeState = 'online', updateState = null } = {}) {
  const snapshot = sessionSnapshot ?? (() => { const model = createSessionSidebarModel(); model.update({ runs: [], approvals: [] }); return model.snapshot(); })();
  const requestedExperience = String(experienceLevel || 'everyday');
  const experience = normalizeExperience(requestedExperience);
  const exp = experienceMeta(experience);
  const mode = shellMode === 'settings' ? 'settings' : 'default';
  const sessions = renderSessionSidebar(snapshot) || sessionPlaceholder(language);
  const connectionLabel = runtimeState === 'online' ? t('shell.online', language) : t('shell.offline', language);
  return `<div class="app-shell" data-product="Nolane Agent" data-experience-level="${escapeHtml(requestedExperience)}" data-progressive-experience="${experience}" data-shell-mode="${mode}">
    ${renderGlobalRail({ activePath, experience, language })}
    <aside class="session-sidebar" aria-label="Mission sessions">
      <div class="session-sidebar__brand"><div><span class="session-sidebar__brand-mark">${icon('spark',{size:16})}</span><span><strong>Nolane</strong><small>Agent workspace</small></span></div><button type="button" data-command="collapse-sidebar" aria-label="Collapse sidebar">${icon('menu',{size:17})}</button></div>
      <button class="session-sidebar__new" type="button" data-command="new-mission">${icon('plus',{size:17})}<span>${t('shell.new',language)}</span><kbd>⌘N</kbd></button>
      <label class="session-sidebar__search"><span>${icon('search',{size:15})}</span><input type="search" placeholder="${t('shell.search',language)}" data-session-search><kbd>⌘K</kbd></label>
      <div id="session-groups" class="session-sidebar__groups">${sessions}</div>
      <footer class="session-sidebar__footer"><span class="runtime-dot" data-state="${runtimeState}"></span><span>${escapeHtml(connectionLabel)}</span><button type="button" data-command="help" aria-label="Help">?</button></footer>
    </aside>
    <div class="resize-handle resize-handle--sidebar" role="separator" tabindex="0" aria-label="Resize mission sidebar" aria-orientation="vertical" aria-valuemin="220" aria-valuemax="520" data-resize-region="sidebar"></div>
    <section class="app-main">
      <header class="app-topbar"><div class="app-topbar__trail"><button class="mobile-sidebar-toggle" type="button" data-command="open-sidebar" aria-label="Open navigation">${icon('menu',{size:18})}</button><div class="app-topbar__title">${escapeHtml(routeTitle)}</div></div><div class="app-topbar__actions"><button type="button" data-route="/search" aria-label="${t('shell.search',language)}" title="${t('shell.search',language)}">${icon('search',{size:17})}</button><button type="button" data-command="notifications" aria-label="${t('shell.notifications',language)}" title="${t('shell.notifications',language)}">${icon('activity',{size:17})}<span class="notification-indicator" hidden></span></button>${renderExperienceSwitcher({ current: experience, language })}<button type="button" data-command="toggle-summary" aria-haspopup="dialog" aria-controls="output-summary-root" title="${t('shell.summary',language)}" aria-label="${t('shell.summary',language)}">${icon('activity',{size:17})}</button></div></header>
      <div id="route-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true">${escapeHtml(routeTitle)}</div><div id="update-notice-root">${renderUpdateNotice(updateState,{experience,language})}</div><main id="workspace" tabindex="-1">${content}</main>
    </section><div class="experience-transition-status" data-experience-transition-status role="status" aria-live="polite" hidden></div><div id="output-summary-resizer" class="resize-handle resize-handle--dock output-summary-resizer" role="separator" tabindex="0" aria-label="Resize activity summary" aria-orientation="vertical" aria-valuemin="280" aria-valuemax="720" aria-valuenow="420" data-resize-region="dock" hidden></div><div id="output-summary-root" class="output-summary-root" data-open="false"></div>
  </div>`;
}
