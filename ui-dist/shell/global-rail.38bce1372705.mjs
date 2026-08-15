import { icon } from '../core/icon.ad3253884c71.mjs';
import { canAccess } from '../core/experience-policy.75de6e6c16ce.mjs';
import { t } from '../core/i18n.a6b5a956cedc.mjs';

export const GLOBAL_DESTINATIONS = Object.freeze([
  { id: 'home', path: '/', label: 'Home', labelKey: 'nav.home', icon: 'chat', minExperience: 'everyday' },
  { id: 'missions', path: '/missions', label: 'Missions', labelKey: 'nav.missions', icon: 'activity', minExperience: 'workspace' },
  { id: 'projects', path: '/projects', label: 'Projects', labelKey: 'nav.projects', icon: 'projects', minExperience: 'everyday' },
  { id: 'review', path: '/review', label: 'Review Queue', labelKey: 'nav.review', icon: 'review', minExperience: 'workspace' },
  { id: 'workroom', path: '/workroom', label: 'Workroom', labelKey: 'nav.workroom', icon: 'studio', minExperience: 'studio' },
  { id: 'browser', path: '/browser', label: 'Browser', labelKey: 'nav.browser', icon: 'globe', minExperience: 'expert' },
  { id: 'control-plane', path: '/control-plane', label: 'Control Plane', labelKey: 'nav.control', icon: 'control', minExperience: 'expert' },
  { id: 'search', path: '/search', label: 'Search', labelKey: 'nav.search', icon: 'search', minExperience: 'everyday' },
  { id: 'settings', path: '/settings', label: 'Settings', labelKey: 'nav.settings', icon: 'settings', minExperience: 'everyday' },
]);

function isCurrent(item, activePath) {
  if (item.path === '/') return activePath === '/';
  return activePath === item.path || activePath.startsWith(`${item.path}/`);
}
export function renderGlobalRail({ activePath = '/', experience = 'everyday', language = 'en' } = {}) {
  const visible = GLOBAL_DESTINATIONS.filter((item) => canAccess(item.minExperience, experience));
  const primary = visible.filter((item) => item.id !== 'settings');
  const settings = visible.find((item) => item.id === 'settings');
  const renderItem = (item) => {
    const label = t(item.labelKey, language, item.label);
    const current = isCurrent(item, activePath) ? ' aria-current="page"' : '';
    return `<a href="#${item.path}" data-route="${item.path}" data-nav-id="${item.id}" data-tooltip="${label}" aria-label="${label}"${current}>${icon(item.icon,{size:20})}<span class="global-rail__label">${label}</span></a>`;
  };
  return `<nav class="global-rail" aria-label="Nolane Agent navigation"><a class="global-rail__logo" href="#/" data-route="/" aria-label="${t('app.name',language)}"><span>N</span></a><div class="global-rail__main">${primary.map(renderItem).join('')}</div>${settings ? `<div class="global-rail__bottom">${renderItem(settings)}</div>` : ''}</nav>`;
}
