const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const languageKey = (value) => String(value ?? 'en').toLowerCase().startsWith('vi') ? 'vi' : 'en';
const COPY = Object.freeze({ en: { title: 'Session timeline', empty: 'No browser events recorded yet.', runtime: 'Runtime check', session: 'Session status', tabs: 'Tab inventory', permissions: 'Permission check' }, vi: { title: 'Dòng thời gian phiên', empty: 'Chưa có sự kiện trình duyệt nào.', runtime: 'Kiểm tra runtime', session: 'Trạng thái phiên', tabs: 'Danh sách tab', permissions: 'Kiểm tra quyền' } });

export function renderBrowserTimeline({ events = [], language = 'en' } = {}) {
  const t = COPY[languageKey(language)];
  const rows = Array.isArray(events) ? events.slice(0, 8).map((event) => `<li data-tone="${escapeHtml(event.status ?? 'muted')}"><span>${escapeHtml(event.label ?? '')}</span><small>${escapeHtml(event.detail ?? '')}</small></li>`).join('') : '';
  return `<section class="browser-timeline"><header><p class="browser-eyebrow">${escapeHtml(t.title)}</p></header>${rows ? `<ol>${rows}</ol>` : `<p class="browser-empty">${escapeHtml(t.empty)}</p>`}</section>`;
}

export function defaultBrowserTimeline(snapshot = {}) {
  const language = languageKey(snapshot.language);
  const t = COPY[language];
  const state = (value) => value === 'error' ? 'error' : value === 'offline' || value === 'unavailable' ? 'muted' : 'ready';
  return [
    { label: t.runtime, status: state(snapshot.runtimeStatus), detail: String(snapshot.runtimeStatus ?? 'unknown') },
    { label: t.session, status: state(snapshot.sessionStatus), detail: String(snapshot.sessionStatus ?? 'unknown') },
    { label: t.tabs, status: state(snapshot.tabsStatus), detail: `${Number(snapshot.tabs?.length ?? 0)} tab(s)` },
    { label: t.permissions, status: state(snapshot.permissionsStatus), detail: String(snapshot.permissionsStatus ?? 'unknown') },
  ];
}
