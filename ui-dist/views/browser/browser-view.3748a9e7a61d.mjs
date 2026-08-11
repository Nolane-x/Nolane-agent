import { renderBrowserInspector } from './browser-inspector.5139356b201f.mjs';
import { defaultBrowserTimeline, renderBrowserTimeline } from './browser-timeline.3db2d551b55f.mjs';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const languageKey = (value) => String(value ?? 'en').toLowerCase().startsWith('vi') ? 'vi' : 'en';
const COPY = Object.freeze({
  en: Object.freeze({ back: 'Back to Runtime', eyebrow: 'Local browser workspace', title: 'Browser workspace', description: 'Inspect and direct the selected project browser session without exposing credentials or performing hidden actions.', refresh: 'Refresh', close: 'Close session', runtimeReady: 'Browser runtime ready', runtimeUnavailable: 'Browser runtime unavailable', sessionReady: 'Active browser session', empty: 'No active browser session', tabs: 'Open tabs', noTabs: 'No open tabs', permissions: 'Permission boundary', projectRequired: 'Select a project to inspect a browser session.', loading: 'Loading browser state…', error: 'Browser state is partially unavailable', unavailable: 'Unavailable', aboutBlank: 'Blank page', closeError: 'Unable to close the browser session.', navigation: 'Browser control', navigationTitle: 'Start or navigate this project session', navigationDescription: 'Sign in directly in the visible browser window. This workspace keeps control scoped to the selected project.', address: 'Website address', addressHint: 'HTTP(S) only; private URL parameters stay out of this workspace.', open: 'Open browser', goto: 'Go to URL', openError: 'Unable to open the browser session.', gotoError: 'Unable to navigate the browser session.', urlError: 'Enter an HTTP(S) address or about:blank.', screenshot: 'Screenshot', captureScreenshot: 'Capture screenshot', screenshotEmpty: 'No screenshot captured for this session.', screenshotLoading: 'Capturing a bounded screenshot…', screenshotReady: 'Latest screenshot artifact', screenshotError: 'Screenshot unavailable' }),
  vi: Object.freeze({ back: 'Quay lại Runtime', eyebrow: 'Không gian trình duyệt cục bộ', title: 'Không gian trình duyệt', description: 'Kiểm tra và điều hướng phiên trình duyệt của project đã chọn mà không làm lộ credential hoặc tự ý thực hiện hành động.', refresh: 'Làm mới', close: 'Đóng phiên', runtimeReady: 'Runtime trình duyệt sẵn sàng', runtimeUnavailable: 'Runtime trình duyệt không khả dụng', sessionReady: 'Phiên trình duyệt đang hoạt động', empty: 'Chưa có phiên trình duyệt', tabs: 'Tab đang mở', noTabs: 'Chưa có tab đang mở', permissions: 'Ranh giới quyền', projectRequired: 'Hãy chọn project để kiểm tra phiên trình duyệt.', loading: 'Đang tải trạng thái trình duyệt…', error: 'Một phần trạng thái trình duyệt chưa khả dụng', unavailable: 'Không khả dụng', aboutBlank: 'Trang trống', closeError: 'Không thể đóng phiên trình duyệt.', navigation: 'Điều khiển trình duyệt', navigationTitle: 'Mở hoặc điều hướng phiên của project', navigationDescription: 'Đăng nhập trực tiếp trong cửa sổ trình duyệt hiển thị. Không gian này chỉ điều khiển trong phạm vi project đã chọn.', address: 'Địa chỉ website', addressHint: 'Chỉ HTTP(S); tham số URL riêng tư không xuất hiện trong không gian này.', open: 'Mở trình duyệt', goto: 'Đi tới URL', openError: 'Không thể mở phiên trình duyệt.', gotoError: 'Không thể điều hướng phiên trình duyệt.', urlError: 'Nhập địa chỉ HTTP(S) hoặc about:blank.', screenshot: 'Ảnh chụp màn hình', captureScreenshot: 'Chụp ảnh màn hình', screenshotEmpty: 'Chưa có ảnh chụp cho phiên này.', screenshotLoading: 'Đang chụp ảnh có giới hạn…', screenshotReady: 'Artifact ảnh chụp mới nhất', screenshotError: 'Ảnh chụp chưa khả dụng' }),
});
const copy = (language) => COPY[languageKey(language)];
const errorText = (error) => String(error?.payload?.error ?? error?.message ?? error ?? 'Unavailable').replace(/((?:token|secret|password|credential|api[-_]?key|authorization|cookie|session)[=:])[^\s&]+/gi, '$1[redacted]').slice(0, 240);
const bounded = (value, max = 180) => String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
const SCREENSHOT_FILENAME = 'workspace.png';
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;
const SENSITIVE_QUERY_KEY = /(token|secret|password|credential|api[-_]?key|authorization|cookie|session|code)/i;

function pathWithProject(path, projectId) { return `${path}?projectId=${encodeURIComponent(String(projectId))}`; }
function normalizeNavigationUrl(value) {
  const raw = bounded(value, 4_096);
  if (!raw || raw === 'about:blank') return raw || 'about:blank';
  let parsed;
  try { parsed = new URL(raw); } catch { return raw; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return raw;
  parsed.username = ''; parsed.password = '';
  for (const key of [...parsed.searchParams.keys()]) if (SENSITIVE_QUERY_KEY.test(key)) parsed.searchParams.delete(key);
  return parsed.toString();
}
function browserUrl(value, language) {
  const normalized = normalizeNavigationUrl(value);
  if (normalized === 'about:blank') return normalized;
  let parsed;
  try { parsed = new URL(normalized); } catch { throw new Error(copy(language).urlError); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(copy(language).urlError);
  return normalized;
}
function normalizeTabs(payload) {
  const source = Array.isArray(payload?.tabs) ? payload.tabs : Array.isArray(payload?.sessions) ? payload.sessions : [];
  return Object.freeze(source.slice(0, 24).map((tab, index) => Object.freeze({
    id: bounded(tab?.id ?? tab?.name ?? `tab-${index + 1}`, 96),
    title: bounded(tab?.title || tab?.name || 'Untitled', 120),
    url: bounded(tab?.url || 'about:blank', 4_096),
  })));
}
function safeUrlLabel(url, language) {
  const t = copy(language);
  if (!url || url === 'about:blank') return t.aboutBlank;
  try {
    const parsed = new URL(url); parsed.username = ''; parsed.password = ''; parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) if (SENSITIVE_QUERY_KEY.test(key)) parsed.searchParams.delete(key);
    parsed.search = parsed.searchParams.toString() ? `?${parsed.searchParams.toString()}` : '';
    return bounded(parsed.origin + parsed.pathname + parsed.search, 220);
  } catch { return bounded(url, 220); }
}
function statusTone(value) { const normalized = String(value ?? '').toLowerCase(); return ['ready', 'active', 'connected', 'healthy'].some((item) => normalized.includes(item)) ? 'ready' : ['error', 'failed', 'blocked'].some((item) => normalized.includes(item)) ? 'error' : 'muted'; }

export function createBrowserWorkspaceController({ api, projectId = null, missionId = null, goalId = null, language = 'en' } = {}) {
  if (!api?.get || !api?.post) throw new TypeError('Browser workspace requires an API client');
  const selectedProject = projectId ? String(projectId) : null;
  const selectedMission = missionId ? String(missionId) : null;
  const selectedGoal = goalId ? String(goalId) : selectedMission;
  let state = Object.freeze({ status: 'idle', language: languageKey(language), projectId: selectedProject, missionId: selectedMission, goalId: selectedGoal, urlDraft: 'about:blank', runtime: {}, detect: {}, session: null, tabs: Object.freeze([]), permissions: {}, errors: Object.freeze([]), sessionOpen: false, loadedAt: null, events: Object.freeze([]), screenshot: Object.freeze({ status: 'empty', dataUrl: null, bytes: 0, sha256: null, error: null }) });

  async function load() {
    state = Object.freeze({ ...state, status: 'loading', errors: Object.freeze([]), screenshot: Object.freeze({ status: 'empty', dataUrl: null, bytes: 0, sha256: null, error: null }) });
    const jobs = await Promise.all([
      api.get('/api/browser/runtime').then((value) => ({ key: 'runtime', value }), (error) => ({ key: 'runtime', error })),
      api.get('/api/browser/detect').then((value) => ({ key: 'detect', value }), (error) => ({ key: 'detect', error })),
      selectedProject ? api.get(pathWithProject('/api/browser/status', selectedProject)).then((value) => ({ key: 'session', value }), (error) => ({ key: 'session', error })) : Promise.resolve({ key: 'session', value: null }),
      selectedProject ? api.post('/api/browser/tabs', { projectId: selectedProject }).then((value) => ({ key: 'tabs', value }), (error) => ({ key: 'tabs', error })) : Promise.resolve({ key: 'tabs', value: null }),
      selectedGoal ? api.get(`/api/permissions/browser?goalId=${encodeURIComponent(selectedGoal)}`).then((value) => ({ key: 'permissions', value }), (error) => ({ key: 'permissions', error })) : Promise.resolve({ key: 'permissions', value: null }),
    ]);
    const values = Object.fromEntries(jobs.map((job) => [job.key, job.value]));
    const errors = jobs.filter((job) => job.error).map((job) => Object.freeze({ key: job.key, message: errorText(job.error) }));
    const runtimeUnavailable = values.runtime?.available === false || values.runtime?.ready === false || values.detect?.available === false;
    const tabs = normalizeTabs(values.tabs ?? values.session);
    const sessions = Array.isArray(values.session?.sessions) ? values.session.sessions : [];
    const sessionOpen = sessions.length > 0 || tabs.length > 0;
    const status = runtimeUnavailable ? 'offline' : errors.some((item) => ['runtime', 'detect'].includes(item.key)) ? 'offline' : errors.length ? (sessionOpen ? 'degraded' : 'empty') : sessionOpen ? 'ready' : selectedProject ? 'empty' : 'unavailable';
    const eventStatus = (key) => errors.some((item) => item.key === key) ? 'error' : runtimeUnavailable && ['runtime', 'detect'].includes(key) ? 'offline' : values[key] == null ? 'unavailable' : 'ready';
    state = Object.freeze({ ...state, status, runtime: values.runtime ?? {}, detect: values.detect ?? {}, session: values.session ?? null, tabs, permissions: values.permissions ?? {}, errors: Object.freeze(errors), sessionOpen, loadedAt: new Date().toISOString(), runtimeStatus: eventStatus('runtime'), sessionStatus: eventStatus('session'), tabsStatus: eventStatus('tabs'), permissionsStatus: eventStatus('permissions') });
    state = Object.freeze({ ...state, events: Object.freeze(defaultBrowserTimeline(state)) });
    return state;
  }
  async function captureScreenshot() {
    if (!selectedProject) {
      state = Object.freeze({ ...state, screenshot: Object.freeze({ status: 'error', dataUrl: null, bytes: 0, sha256: null, error: 'A project is required.' }) });
      return state;
    }
    const allowed = Array.isArray(state.permissions?.allowedActions) ? state.permissions.allowedActions : null;
    if (allowed && !allowed.includes('screenshot')) {
      state = Object.freeze({ ...state, screenshot: Object.freeze({ status: 'error', dataUrl: null, bytes: 0, sha256: null, error: 'Browser screenshot permission is not granted.' }) });
      return state;
    }
    state = Object.freeze({ ...state, screenshot: Object.freeze({ status: 'loading', dataUrl: null, bytes: 0, sha256: null, error: null }) });
    try {
      await api.post('/api/browser/screenshot', { projectId: selectedProject, filename: SCREENSHOT_FILENAME });
      const artifact = await api.post('/api/browser/artifact', { projectId: selectedProject, filename: SCREENSHOT_FILENAME });
      const mimeType = String(artifact?.mimeType ?? '');
      const bytes = Number(artifact?.bytes ?? 0);
      const base64 = String(artifact?.contentBase64 ?? '');
      if (!/^image\/(?:png|jpeg|webp)$/.test(mimeType) || !Number.isInteger(bytes) || bytes < 0 || bytes > MAX_SCREENSHOT_BYTES || !base64 || base64.length > Math.ceil(MAX_SCREENSHOT_BYTES * 4 / 3) + 64) throw new Error('Screenshot artifact is invalid or exceeds the UI bound.');
      state = Object.freeze({ ...state, screenshot: Object.freeze({ status: 'ready', dataUrl: `data:${mimeType};base64,${base64}`, bytes, sha256: /^[a-f0-9]{64}$/i.test(String(artifact?.sha256 ?? '')) ? String(artifact.sha256) : null, error: null }) });
    } catch (error) {
      state = Object.freeze({ ...state, status: state.status === 'offline' ? 'offline' : 'degraded', screenshot: Object.freeze({ status: 'error', dataUrl: null, bytes: 0, sha256: null, error: errorText(error) }) });
    }
    return state;
  }
  function setUrl(value) {
    state = Object.freeze({ ...state, urlDraft: normalizeNavigationUrl(value) });
    return state;
  }
  async function navigate(action, value = state.urlDraft) {
    if (!selectedProject) {
      state = Object.freeze({ ...state, status: 'unavailable', errors: Object.freeze([{ key: action, message: copy(state.language).projectRequired }]) });
      return state;
    }
    try {
      const url = browserUrl(value, state.language);
      const payload = action === 'open'
        ? { projectId: selectedProject, url, headed: true, persistent: true }
        : { projectId: selectedProject, url };
      await api.post(`/api/browser/${action}`, payload);
      return load();
    } catch (error) {
      const message = errorText(error);
      state = Object.freeze({ ...state, status: 'degraded', errors: Object.freeze([{ key: action, message: message || copy(state.language)[`${action}Error`] }]) });
      return state;
    }
  }
  async function open(value) { return navigate('open', value); }
  async function goto(value) { return navigate('goto', value); }
  async function close() {
    if (!selectedProject) return state;
    try {
      await api.post('/api/browser/close', { projectId: selectedProject });
      state = Object.freeze({ ...state, session: null, tabs: Object.freeze([]), sessionOpen: false, sessionStatus: 'ready', events: Object.freeze(defaultBrowserTimeline({ ...state, sessionStatus: 'ready', tabs: [] })) });
    } catch (error) {
      state = Object.freeze({ ...state, status: 'degraded', errors: Object.freeze([...state.errors, Object.freeze({ key: 'close', message: errorText(error) })]) });
    }
    return state;
  }
  return Object.freeze({ load, refresh: load, setUrl, open, goto, close, captureScreenshot, snapshot: () => state });
}

function renderStatusPill(label, value) { return `<span class="browser-status-pill" data-tone="${escapeHtml(statusTone(value))}"><i aria-hidden="true"></i>${escapeHtml(label)}</span>`; }
function renderTabs(snapshot, t) {
  if (!snapshot.tabs.length) return `<section class="browser-tabs browser-panel"><header><div><p class="browser-eyebrow">${escapeHtml(t.tabs)}</p><h2>${escapeHtml(t.noTabs)}</h2></div></header><p class="browser-empty">${escapeHtml(snapshot.sessionOpen ? t.noTabs : t.empty)}</p></section>`;
  return `<section class="browser-tabs browser-panel"><header><div><p class="browser-eyebrow">${escapeHtml(t.tabs)}</p><h2>${escapeHtml(snapshot.tabs.length === 1 ? t.sessionReady : `${snapshot.tabs.length} ${t.tabs.toLowerCase()}`)}</h2></div></header><ol>${snapshot.tabs.map((tab) => `<li><span class="browser-tab-icon" aria-hidden="true">▣</span><div><strong>${escapeHtml(tab.title)}</strong><small>${escapeHtml(safeUrlLabel(tab.url, snapshot.language))}</small></div><span class="browser-tab-state" data-tone="ready">${escapeHtml(t.runtimeReady)}</span></li>`).join('')}</ol></section>`;
}

function renderScreenshot(snapshot, t) {
  const screenshot = snapshot.screenshot ?? {};
  const body = screenshot.status === 'ready' && screenshot.dataUrl
    ? `<figure class="browser-screenshot-figure"><img src="${escapeHtml(screenshot.dataUrl)}" alt="${escapeHtml(t.screenshotReady)}"><figcaption>${escapeHtml(t.screenshotReady)}${screenshot.bytes ? ` · ${screenshot.bytes.toLocaleString()} B` : ''}${screenshot.sha256 ? ` · ${escapeHtml(screenshot.sha256.slice(0, 16))}…` : ''}</figcaption></figure>`
    : screenshot.status === 'loading' ? `<p class="browser-empty" aria-live="polite">${escapeHtml(t.screenshotLoading)}</p>`
      : screenshot.status === 'error' ? `<p class="browser-empty" role="alert">${escapeHtml(t.screenshotError)}: ${escapeHtml(screenshot.error ?? t.unavailable)}</p>`
        : `<p class="browser-empty">${escapeHtml(t.screenshotEmpty)}</p>`;
  return `<section class="browser-screenshot browser-panel"><header><div><p class="browser-eyebrow">${escapeHtml(t.screenshot)}</p><h2>${escapeHtml(t.screenshotReady)}</h2></div><button type="button" data-browser-action="screenshot" ${snapshot.sessionOpen ? '' : 'disabled'} aria-busy="${screenshot.status === 'loading'}">${escapeHtml(t.captureScreenshot)}</button></header>${body}</section>`;
}

function renderNavigation(snapshot, t) {
  const disabled = snapshot.projectId ? '' : 'disabled';
  const navigateDisabled = snapshot.projectId && snapshot.sessionOpen ? '' : 'disabled';
  return `<section class="browser-navigation browser-panel"><header><div><p class="browser-eyebrow">${escapeHtml(t.navigation)}</p><h2>${escapeHtml(t.navigationTitle)}</h2><p>${escapeHtml(t.navigationDescription)}</p></div></header><label class="browser-navigation-field"><span>${escapeHtml(t.address)}</span><input data-browser-url type="url" inputmode="url" autocomplete="url" spellcheck="false" value="${escapeHtml(snapshot.urlDraft ?? 'about:blank')}" aria-describedby="browser-address-hint"><small id="browser-address-hint">${escapeHtml(t.addressHint)}</small></label><div class="browser-navigation-actions"><button type="button" data-browser-action="open" ${disabled}>${escapeHtml(t.open)}</button><button type="button" data-browser-action="goto" ${navigateDisabled}>${escapeHtml(t.goto)}</button></div></section>`;
}

export function renderBrowserWorkspace(snapshot = {}) {
  const language = languageKey(snapshot.language);
  const t = copy(language);
  const status = String(snapshot.status ?? 'idle');
  const runtimeReady = status !== 'offline' && snapshot.runtime?.available !== false && snapshot.runtime?.ready !== false && snapshot.detect?.available !== false;
  const runtimeLabel = runtimeReady ? t.runtimeReady : t.runtimeUnavailable;
  const project = snapshot.projectId ? bounded(snapshot.projectId, 120) : null;
  const error = snapshot.errors?.[0]?.message;
  return `<section class="browser-workspace" data-browser-status="${escapeHtml(status)}"><header class="browser-workspace-hero"><div><a class="browser-back-link" href="#/control-plane/runtime" data-route="/control-plane/runtime">← ${escapeHtml(t.back)}</a><p class="browser-eyebrow">${escapeHtml(t.eyebrow)}</p><h1>${escapeHtml(t.title)}</h1><p>${escapeHtml(t.description)}</p></div><div class="browser-hero-actions"><button type="button" data-browser-action="refresh" aria-busy="${status === 'loading'}">${escapeHtml(t.refresh)}</button><button type="button" data-browser-action="close" ${snapshot.sessionOpen ? '' : 'disabled'}>${escapeHtml(t.close)}</button></div></header><div class="browser-status-strip" role="status" aria-live="polite">${renderStatusPill(runtimeLabel, runtimeReady ? 'ready' : 'offline')}${renderStatusPill(project || t.projectRequired, project ? 'ready' : 'unavailable')}${renderStatusPill(snapshot.sessionOpen ? t.sessionReady : t.empty, snapshot.sessionOpen ? 'ready' : 'muted')}<span class="browser-status-copy">${escapeHtml(status === 'loading' ? t.loading : error ? `${t.error}: ${error}` : snapshot.status === 'unavailable' ? t.projectRequired : '')}</span></div>${status === 'loading' ? `<section class="browser-loading browser-panel" aria-live="polite">${escapeHtml(t.loading)}</section>` : `<div class="browser-workspace-grid"><main>${renderNavigation(snapshot, t)}${renderScreenshot(snapshot, t)}${renderTabs(snapshot, t)}${renderBrowserTimeline(snapshot)} </main>${renderBrowserInspector(snapshot)}</div>`}</section>`;
}
