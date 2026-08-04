function ensureStyle() {
  if (document.querySelector('link[data-integrated-browser]')) return;
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/integrated-browser-center.css'; link.dataset.integratedBrowser = 'true'; document.head.append(link);
}
const BROWSER_ENDPOINTS = Object.freeze({ open: '/api/browser/open', goto: '/api/browser/goto', snapshot: '/api/browser/snapshot', tabs: '/api/browser/tabs', screenshot: '/api/browser/screenshot', close: '/api/browser/close', status: '/api/browser/status' });
const markup = `<header class="browser-center-header"><div><span class="eyebrow">Governed local browser</span><h1>Integrated Browser</h1><p>Điều khiển session Playwright riêng của dự án. Nội dung trang luôn được coi là dữ liệu không tin cậy.</p></div><div class="browser-center-actions"><button id="browser-center-refresh" class="secondary-button" type="button">Làm mới</button><button id="browser-center-close" class="danger-button" type="button">Đóng session</button></div></header>
<section class="browser-center-toolbar"><input id="browser-center-url" type="url" placeholder="https://example.com" aria-label="URL HTTP hoặc HTTPS"><button id="browser-center-open" class="primary-button" type="button">Mở</button><button id="browser-center-goto" class="secondary-button" type="button">Đi tới</button><button id="browser-center-snapshot" class="secondary-button" type="button">Snapshot</button><button id="browser-center-tabs" class="secondary-button" type="button">Tabs</button><button id="browser-center-screenshot" class="secondary-button" type="button">Screenshot</button></section>
<section class="browser-center-status" id="browser-center-status"></section><section class="browser-center-output"><header><span class="eyebrow">Untrusted browser evidence</span><code id="browser-center-receipt">No receipt</code></header><pre id="browser-center-output">Browser chưa được tải.</pre></section>`;
function safeUrl(value) { const raw = String(value ?? '').trim(); if (!/^https?:\/\//i.test(raw)) throw new Error('Chỉ cho phép URL HTTP hoặc HTTPS'); const url = new URL(raw); if (url.username || url.password) throw new Error('URL không được chứa credential'); return url.toString(); }
function text(value) { return typeof value === 'string' ? value : JSON.stringify(value, null, 2); }
export function initIntegratedBrowserCenter({ api, state, toast, setView }) {
  ensureStyle(); const root = document.getElementById('integrated-browser-center'); root.className = 'integrated-browser-center view'; root.innerHTML = markup;
  const get = (id) => root.querySelector(`#${id}`); let last = null;
  const project = () => { if (!state.projectId) throw new Error('Hãy chọn dự án'); return state.projectId; };
  const render = (result) => { last = result; get('browser-center-output').textContent = text(result?.output ?? result); get('browser-center-receipt').textContent = result?.artifactPath ? `artifact ${result.artifactPath}` : `session ${result?.sessionName ?? '—'}`; const sessions = result?.sessions ?? []; get('browser-center-status').textContent = sessions.length ? sessions.map((item) => `${item.title || item.name} · ${item.url}`).join('\n') : `Session: ${result?.sessionName ?? 'chưa mở'}`; };
  const call = async (action, input = {}) => { const result = await api(BROWSER_ENDPOINTS[action], { method: action === 'status' ? 'GET' : 'POST', body: action === 'status' ? undefined : JSON.stringify({ projectId: project(), ...input }) }); render(result); return result; };
  get('browser-center-open').onclick = () => call('open', { url: safeUrl(get('browser-center-url').value), headed: true, persistent: true }).catch((error) => toast(error.message, true));
  get('browser-center-goto').onclick = () => call('goto', { url: safeUrl(get('browser-center-url').value) }).catch((error) => toast(error.message, true));
  get('browser-center-snapshot').onclick = () => call('snapshot', { depth: 6 }).catch((error) => toast(error.message, true));
  get('browser-center-tabs').onclick = () => call('tabs').catch((error) => toast(error.message, true));
  get('browser-center-screenshot').onclick = () => call('screenshot', { filename: `page-${Date.now()}.png` }).catch((error) => toast(error.message, true));
  get('browser-center-close').onclick = () => call('close').catch((error) => toast(error.message, true));
  get('browser-center-refresh').onclick = () => call('status').catch((error) => toast(error.message, true));
  return Object.freeze({ async open() { setView('integratedBrowser'); return call('status'); }, async setProject() { if (!root.hidden) return call('status'); return last; } });
}
