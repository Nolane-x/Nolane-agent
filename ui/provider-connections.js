const API_PROVIDER_IDS = Object.freeze({
  'openai-responses': 'openai-api',
  'anthropic-messages': 'anthropic-api',
  'gemini-generate-content': 'gemini-api',
  'openai-compatible': 'openai-compatible',
});
const API_PROVIDER_LABELS = Object.freeze({
  'openai-responses': 'OpenAI API',
  'anthropic-messages': 'Anthropic API',
  'gemini-generate-content': 'Google Gemini API',
  'openai-compatible': 'OpenAI-compatible API',
});
const $ = (id) => document.getElementById(id);
const all = (selector) => [...document.querySelectorAll(selector)];

function installStyle() {
  if (document.querySelector('link[data-provider-connections]')) return;
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/provider-connections.css'; link.dataset.providerConnections = 'true'; document.head.append(link);
}
function statusText(connection) {
  if (!connection) return 'Chưa cài';
  if (connection.authenticated && connection.healthy) return 'Đã kết nối';
  if (connection.available === false) return 'Chưa cài';
  if (connection.authenticated) return 'Cần kiểm tra';
  return 'Cần đăng nhập';
}

export function initProviderConnections({ api, state, showDialog, onReadinessChange } = {}) {
  installStyle();
  let pollTimer = null;
  const connectionById = (id) => state.providerConnections?.find((item) => item.id === id) ?? null;
  const setMessage = (message, tone = '') => { const node = $('provider-connection-message'); node.textContent = String(message); node.className = `provider-connection-message${tone ? ` ${tone}` : ''}`; };
  const stopPolling = () => { if (pollTimer) clearInterval(pollTimer); pollTimer = null; };
  function official(id, aliases = []) {
    const connection = [id, ...aliases].map(connectionById).find(Boolean) ?? null;
    const card = document.querySelector(`[data-provider-card="${id}"]`);
    const status = $(`${id === 'codex-app-server' ? 'codex' : id}-provider-status`);
    const connected = Boolean(connection?.authenticated && connection?.healthy);
    card?.classList.toggle('connected', connected);
    if (status) { status.textContent = statusText(connection); status.className = `provider-status ${connected ? 'connected' : connection?.available === false ? 'error' : 'checking'}`; status.title = connection?.error || connection?.planType || ''; }
    all(`[data-provider-logout="${id}"]`).forEach((button) => { button.hidden = !connected; });
    all(`[data-provider-login="${id}"]`).forEach((button) => { button.hidden = connected; });
  }
  function configured() {
    const direct = (state.providerConnections ?? []).filter((item) => item.configured && Object.hasOwn(API_PROVIDER_LABELS, item.kind));
    $('configured-api-providers').replaceChildren(...direct.map((item) => {
      const row = document.createElement('article'); row.className = 'configured-provider-row';
      const copy = document.createElement('div'); const title = document.createElement('strong'); title.textContent = API_PROVIDER_LABELS[item.kind] ?? item.label ?? item.id;
      const meta = document.createElement('small'); meta.textContent = `${item.model ?? item.config?.model ?? 'Model'} · ${statusText(item)}`; copy.append(title, meta);
      const test = document.createElement('button'); test.type = 'button'; test.className = 'secondary-button compact-button'; test.textContent = 'Kiểm tra';
      test.onclick = async () => { test.disabled = true; try { setMessage(`Đang kiểm tra ${title.textContent}...`); await api(`/api/provider-connections/${encodeURIComponent(item.id)}/test`, { method: 'POST', body: '{}' }); await load(); setMessage(`${title.textContent} đã sẵn sàng.`, 'success'); } catch (error) { setMessage(error.message, 'error'); } finally { test.disabled = false; } };
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'text-button'; remove.textContent = 'Xóa';
      remove.onclick = async () => { if (!window.confirm(`Xóa kết nối ${title.textContent}?`)) return; await api(`/api/provider-connections/${encodeURIComponent(item.id)}`, { method: 'DELETE' }); await load(); setMessage('Đã xóa kết nối.'); };
      row.append(copy, test, remove); return row;
    }));
  }
  function render() { official('codex-app-server', ['codex']); official('claude'); configured(); }
  async function load({ refresh = false } = {}) {
    if (refresh) await api('/api/provider-connections/refresh', { method: 'POST', body: '{}' });
    const [connections, readiness] = await Promise.all([api('/api/provider-connections'), api('/api/provider-connections/readiness')]);
    state.providerConnections = connections; state.providerReadiness = readiness; onReadinessChange?.(readiness); render(); return readiness;
  }
  function external(value) {
    try { const url = new URL(value); if (url.protocol !== 'https:') return false; window.open(url.toString(), '_blank', 'noopener,noreferrer'); return true; } catch { return false; }
  }
  function startPolling() {
    stopPolling(); let attempts = 0;
    pollTimer = setInterval(async () => {
      attempts += 1; if (!$('provider-dialog').open || attempts > 60) { stopPolling(); return; }
      try { const ready = await load({ refresh: true }); if (ready.ready) { setMessage('AI đã kết nối. Nolane Agent có thể bắt đầu nhiệm vụ.', 'success'); stopPolling(); } } catch {}
    }, 2000);
  }
  async function login(id, type) {
    setMessage(`Đang mở đăng nhập ${id === 'claude' ? 'Claude Code' : 'Codex'}...`);
    const result = await api(`/api/provider-connections/${encodeURIComponent(id)}/login`, { method: 'POST', body: JSON.stringify({ type }) });
    external(result.authUrl || result.verificationUrl);
    const code = result.userCode || result.deviceCode;
    setMessage(code ? `Mở trang đăng nhập và nhập mã: ${code}` : (result.launched ? 'Cửa sổ đăng nhập chính thức đã được mở. Hoàn tất đăng nhập rồi quay lại Nolane Agent.' : 'Hoàn tất đăng nhập trong cửa sổ vừa mở.'));
    startPolling();
  }
  all('[data-provider-login]').forEach((button) => { button.onclick = async () => { button.disabled = true; try { await login(button.dataset.providerLogin, button.dataset.loginType); } catch (error) { setMessage(error.message, 'error'); } finally { button.disabled = false; } }; });
  all('[data-provider-logout]').forEach((button) => { button.onclick = async () => { button.disabled = true; try { await api(`/api/provider-connections/${encodeURIComponent(button.dataset.providerLogout)}/logout`, { method: 'POST', body: '{}' }); await load({ refresh: true }); setMessage('Đã đăng xuất khỏi kết nối này.'); } catch (error) { setMessage(error.message, 'error'); } finally { button.disabled = false; } }; });
  $('refresh-providers').onclick = async () => { try { await open({ refresh: true }); } catch (error) { setMessage(error.message, 'error'); } };
  $('provider-kind').onchange = () => { const custom = $('provider-kind').value === 'openai-compatible'; $('provider-base-url-label').hidden = !custom; $('provider-api-key').required = !custom; };
  $('api-provider-form').onsubmit = async (event) => {
    event.preventDefault(); const kind = $('provider-kind').value; const submit = event.submitter; if (submit) submit.disabled = true;
    try {
      setMessage('Đang lưu key vào OS Vault và kiểm tra model...');
      await api('/api/provider-connections/configure', { method: 'POST', body: JSON.stringify({ id: API_PROVIDER_IDS[kind], kind, model: $('provider-model').value.trim(), apiKey: $('provider-api-key').value, ...(kind === 'openai-compatible' && $('provider-base-url').value.trim() ? { baseUrl: $('provider-base-url').value.trim() } : {}) }) });
      $('provider-api-key').value = ''; await load(); setMessage(`${API_PROVIDER_LABELS[kind]} đã kết nối và sẵn sàng.`, 'success');
    } catch (error) { setMessage(error.message, 'error'); } finally { if (submit) submit.disabled = false; }
  };
  $('provider-dialog').addEventListener('close', stopPolling);
  async function open({ refresh = true, message = '' } = {}) {
    showDialog('provider-dialog'); setMessage(message || 'Đang kiểm tra Codex, Claude Code và các API đã lưu.', message ? 'error' : '');
    try { const readiness = await load({ refresh }); setMessage(message || (readiness.ready ? 'AI đã sẵn sàng. Bạn có thể giao việc ngay.' : 'Chọn một cách kết nối bên dưới. Bạn chỉ cần làm việc này một lần.'), message ? 'error' : readiness.ready ? 'success' : ''); } catch (error) { setMessage(error.message, 'error'); }
    return state.providerReadiness;
  }
  return Object.freeze({ open, load, stop: stopPolling });
}
