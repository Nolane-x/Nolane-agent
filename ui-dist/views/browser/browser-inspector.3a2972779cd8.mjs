const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

const COPY = Object.freeze({
  en: Object.freeze({ inspector: 'Session inspector', runtime: 'Runtime', project: 'Project', driver: 'Driver', version: 'Version', permission: 'Permission boundary', allowed: 'Allowed actions', denied: 'Denied actions', none: 'None', redacted: 'Private values remain redacted.' }),
  vi: Object.freeze({ inspector: 'Bảng kiểm tra phiên', runtime: 'Runtime', project: 'Project', driver: 'Driver', version: 'Phiên bản', permission: 'Ranh giới quyền', allowed: 'Hành động được phép', denied: 'Hành động bị từ chối', none: 'Không có', redacted: 'Giá trị riêng tư luôn được che.' }),
});

const languageKey = (value) => String(value ?? 'en').toLowerCase().startsWith('vi') ? 'vi' : 'en';
const text = (value, language) => escapeHtml(String(value ?? '').slice(0, 160));

export function renderBrowserInspector(snapshot = {}) {
  const language = languageKey(snapshot.language);
  const t = COPY[language];
  const runtime = snapshot.runtime ?? {};
  const detect = snapshot.detect ?? {};
  const permissions = snapshot.permissions ?? {};
  const allowed = Array.isArray(permissions.allowedActions) ? permissions.allowedActions : Array.isArray(permissions.actions) ? permissions.actions : [];
  const denied = Array.isArray(permissions.denied) ? permissions.denied : Array.isArray(permissions.availableWriteActions) ? permissions.availableWriteActions.filter((item) => !allowed.includes(item)) : [];
  const chips = (items, tone) => items.length ? items.slice(0, 12).map((item) => `<span class="browser-permission-chip" data-tone="${tone}">${text(item, language)}</span>`).join('') : `<span class="browser-muted">${escapeHtml(t.none)}</span>`;
  const runtimeState = runtime.ready === false || runtime.available === false ? 'offline' : runtime.state ?? 'ready';
  return `<aside class="browser-inspector" aria-label="${escapeHtml(t.inspector)}"><header><p class="browser-eyebrow">${escapeHtml(t.inspector)}</p><h2>${escapeHtml(t.permission)}</h2></header><dl class="browser-facts"><div><dt>${escapeHtml(t.project)}</dt><dd>${text(snapshot.projectName || snapshot.projectId || t.none, language)}</dd></div><div><dt>${escapeHtml(t.runtime)}</dt><dd>${text(runtimeState, language)}</dd></div><div><dt>${escapeHtml(t.driver)}</dt><dd>${text(detect.driver ?? 'playwright-cli', language)}</dd></div><div><dt>${escapeHtml(t.version)}</dt><dd>${text(detect.version ?? runtime.version ?? t.none, language)}</dd></div></dl><section class="browser-permission-group"><h3>${escapeHtml(t.allowed)}</h3><div class="browser-permission-list">${chips(allowed, 'ready')}</div></section><section class="browser-permission-group"><h3>${escapeHtml(t.denied)}</h3><div class="browser-permission-list">${chips(denied, 'blocked')}</div></section><p class="browser-redaction-note">${escapeHtml(t.redacted)}</p></aside>`;
}
