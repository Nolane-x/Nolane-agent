import { applyRuntimePerformancePolicy } from './runtime-performance-policy.js';
function ensureModuleStyle(href) {
  if (document.querySelector(`link[data-forge-module-style="${href}"]`)) return;
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href; link.dataset.forgeModuleStyle = href; document.head.append(link);
}
ensureModuleStyle('/advanced.css');
const byId = (id) => document.getElementById(id);
const escapePath = (value) => encodeURIComponent(String(value));
const languageFor = (file) => {
  const extension = String(file).split('.').pop()?.toLowerCase();
  return ({ js: 'javascript', mjs: 'javascript', cjs: 'javascript', ts: 'typescript', tsx: 'typescript', jsx: 'javascript', json: 'json', md: 'markdown', css: 'css', html: 'html', py: 'python', rs: 'rust', go: 'go', java: 'java', cpp: 'cpp', c: 'c', h: 'cpp', yml: 'yaml', yaml: 'yaml', toml: 'ini', sh: 'shell', ps1: 'powershell', sql: 'sql' })[extension] || 'plaintext';
};
const decodeBase64 = (value) => Uint8Array.from(atob(String(value || '')), (char) => char.charCodeAt(0));

class TerminalSocket {
  constructor({ token, onEvent, onStatus }) {
    this.token = token; this.onEvent = onEvent; this.onStatus = onStatus; this.sequence = 0; this.pending = new Map(); this.socket = null;
    this.clientId = localStorage.getItem('forgeTerminalClientId') || crypto.randomUUID();
    localStorage.setItem('forgeTerminalClientId', this.clientId);
  }
  async connect() {
    if (this.socket?.readyState === WebSocket.OPEN) return;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/terminal?token=${encodeURIComponent(this.token)}&clientId=${encodeURIComponent(this.clientId)}`;
    const socket = new WebSocket(url); this.socket = socket;
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id); this.pending.delete(message.id); clearTimeout(pending.timer);
        if (message.error) pending.reject(Object.assign(new Error(message.error.message), { code: message.error.code })); else pending.resolve(message.result);
      } else this.onEvent?.(message);
    };
    socket.onclose = () => { this.onStatus?.('disconnected'); for (const pending of this.pending.values()) pending.reject(new Error('Terminal connection closed')); this.pending.clear(); };
    socket.onerror = () => this.onStatus?.('error');
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.addEventListener('error', () => reject(new Error('Cannot open terminal connection')), { once: true }); });
    this.onStatus?.('connected');
  }
  async request(type, payload = {}, timeoutMs = 15_000) {
    await this.connect(); const id = String(++this.sequence);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Terminal request timed out: ${type}`)); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer }); this.socket.send(JSON.stringify({ id, type, ...payload }));
    });
  }
}

export function initWorkroom({ api, state, toast, token }) {
  const editorState = { monaco: null, editor: null, diffEditor: null, models: new Map(), activePath: null, projectId: null, fallback: byId('editor-fallback') };
  const terminalState = { api: null, Terminal: null, FitAddon: null, sessions: new Map(), activeId: null, runtime: null, performancePolicy: state.performancePolicy ?? null };
  let stagedManifest = null;

  const assetStatus = async () => {
    const status = await api('/api/ui-assets');
    byId('asset-status').textContent = status.ready ? 'Monaco + xterm đã sẵn sàng offline' : `Chưa cài tài nguyên UI (${status.reason || 'unknown'})`;
    byId('install-ui-assets').hidden = status.ready;
    return status;
  };
  const desktopUpdater = window.nolaneDesktop ?? null;
  const updateBanner = byId('update-banner');
  const showUpdateBanner = ({ title = 'Bản cập nhật Nolane Agent', message, action = 'download' } = {}) => {
    if (!updateBanner) return;
    byId('update-banner-title').textContent = title;
    byId('update-banner-message').textContent = message || 'Một phiên bản mới đã sẵn sàng.';
    byId('update-banner-action').dataset.action = action;
    byId('update-banner-action').textContent = action === 'install' ? 'Cài đặt và khởi động lại' : 'Tải bản cập nhật';
    updateBanner.hidden = false;
  };
  const refreshDesktopUpdateStatus = async () => {
    if (!desktopUpdater?.getUpdateStatus) return { ready: false, reason: 'not-electron' };
    const status = await desktopUpdater.getUpdateStatus();
    byId('install-update').hidden = !status.ready;
    if (status.ready) showUpdateBanner({ message: `Phiên bản ${status.version} đã tải xong và được xác minh.`, action: 'install' });
    return status;
  };
  const stageSelectedUpdate = async () => {
    if (!stagedManifest) return;
    const result = await api('/api/updates/stage', { method: 'POST', body: JSON.stringify({ manifest: stagedManifest }) });
    byId('update-output').textContent = JSON.stringify(result, null, 2);
    byId('install-update').hidden = false;
    await refreshDesktopUpdateStatus();
    toast('Bản cập nhật đã tải xong và được xác minh chữ ký');
  };
  const installStagedUpdate = async () => {
    if (!desktopUpdater?.installStagedUpdate) throw new Error('Cài đặt tự động chỉ khả dụng trong ứng dụng Electron trên Windows');
    await desktopUpdater.installStagedUpdate();
  };
  const autoCheckUpdate = async () => {
    if (!terminalState.runtime?.updates?.configured) return;
    const result = await api('/api/updates/check', { method: 'POST', body: '{}' });
    stagedManifest = result.manifest || null;
    byId('stage-update').hidden = !result.available;
    if (result.available) showUpdateBanner({ message: `Phiên bản ${result.manifest.version} đã sẵn sàng trên GitHub Releases.`, action: 'download' });
  };

  const loadRuntime = async () => {
    terminalState.runtime = await api('/api/runtime');
    const runtime = terminalState.runtime;
    state.runtime = runtime;
    terminalState.performancePolicy = applyRuntimePerformancePolicy(runtime);
    state.performancePolicy = terminalState.performancePolicy;
    byId('runtime-status').textContent = `${runtime.platform}/${runtime.arch} · ${runtime.resources.state} · RSS ${Math.round((runtime.resources.metrics?.rssBytes || 0) / 1048576)} MB`;
    byId('terminal-shell').replaceChildren(...(runtime.allowedShells || []).map((shell) => new Option(shell, shell)));
    byId('new-terminal').disabled = !runtime.ptyHost.configured || !runtime.allowedShells?.length;
    byId('vault-backend').textContent = `${runtime.credentialVault.backend}${runtime.credentialVault.configured ? '' : ' · helper missing'}`;
    byId('update-status').textContent = runtime.updates.configured ? `Kênh ${runtime.updates.channel}` : 'Feed cập nhật ký số chưa được cấu hình';
    await refreshDesktopUpdateStatus();
  };

  const ensureMonaco = async () => {
    if (editorState.monaco) return editorState.monaco;
    const status = await assetStatus(); if (!status.ready) return null;
    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-monaco-loader]');
      if (existing && window.require) return resolve();
      const script = document.createElement('script'); script.src = '/vendor-assets/monaco/vs/loader.js'; script.dataset.monacoLoader = 'true'; script.onload = resolve; script.onerror = () => reject(new Error('Không thể tải Monaco từ tài nguyên local')); document.head.append(script);
    });
    window.MonacoEnvironment = { getWorkerUrl: (_moduleId, label) => `/vendor-assets/monaco/vs/base/worker/workerMain.js#${encodeURIComponent(label)}` };
    window.require.config({ paths: { vs: '/vendor-assets/monaco/vs' } });
    await new Promise((resolve, reject) => window.require(['vs/editor/editor.main'], resolve, reject));
    editorState.monaco = window.monaco;
    editorState.editor = window.monaco.editor.create(byId('editor-host'), {
      theme: 'vs-dark', automaticLayout: true, minimap: { enabled: false }, fontSize: 13, tabSize: 2,
      renderWhitespace: 'selection', smoothScrolling: true, bracketPairColorization: { enabled: true }, stickyScroll: { enabled: true },
    });
    editorState.editor.addCommand(window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.KeyS, () => saveActive().catch((error) => toast(error.message, true)));
    editorState.editor.onDidChangeModelContent(() => { const record = editorState.models.get(editorState.activePath); if (record) { record.dirty = editorState.editor.getValue() !== record.original; renderTabs(); } });
    editorState.fallback.hidden = true; byId('editor-host').hidden = false;
    return editorState.monaco;
  };

  const renderTabs = () => {
    byId('editor-tabs').replaceChildren(...[...editorState.models.entries()].map(([file, record]) => {
      const tab = document.createElement('button'); tab.className = `editor-tab ${file === editorState.activePath ? 'active' : ''}`; tab.textContent = `${record.dirty ? '● ' : ''}${file.split('/').pop()}`;
      tab.title = file; tab.onclick = () => activateFile(file); return tab;
    }));
  };
  const enforceModelLimit = () => {
    const limit = terminalState.runtime?.resources?.policy?.maxEditorModels || 12;
    while (editorState.models.size > limit) {
      const candidate = [...editorState.models.entries()].find(([path, record]) => path !== editorState.activePath && !record.dirty);
      if (!candidate) break; candidate[1].model?.dispose(); editorState.models.delete(candidate[0]);
    }
  };
  const activateFile = (file) => {
    const record = editorState.models.get(file); if (!record) return;
    editorState.activePath = file;
    if (editorState.editor && record.model) editorState.editor.setModel(record.model); else { editorState.fallback.value = record.value; editorState.fallback.hidden = false; }
    byId('active-file').textContent = file; renderTabs();
  };
  const openFile = async (file) => {
    if (!state.projectId) return toast('Hãy chọn dự án', true);
    if (editorState.models.has(file)) return activateFile(file);
    const document = await api(`/api/workroom/file?projectId=${encodeURIComponent(state.projectId)}&file=${escapePath(file)}`);
    const monaco = await ensureMonaco();
    const uri = monaco?.Uri.parse(`inmemory://forge/${encodeURIComponent(state.projectId)}/${file}`);
    const model = monaco?.editor.createModel(document.content, languageFor(file), uri);
    editorState.models.set(file, { model, value: document.content, original: document.content, sha256: document.sha256, dirty: false });
    enforceModelLimit(); activateFile(file);
  };
  const closeModels = () => { for (const record of editorState.models.values()) record.model?.dispose(); editorState.models.clear(); editorState.activePath = null; editorState.editor?.setModel(null); editorState.fallback.value = ''; renderTabs(); };
  const currentValue = () => editorState.editor && !editorState.fallback.hidden ? editorState.editor.getValue() : editorState.fallback.value;
  const saveActive = async () => {
    const file = editorState.activePath; if (!file) return toast('Chưa mở file', true);
    const record = editorState.models.get(file); const content = currentValue();
    try {
      await api('/api/workroom/file', { method: 'PUT', body: JSON.stringify({ projectId: state.projectId, file, content, expectedSha256: record.sha256 }) });
      const refreshed = await api(`/api/workroom/file?projectId=${encodeURIComponent(state.projectId)}&file=${escapePath(file)}`);
      record.original = refreshed.content; record.sha256 = refreshed.sha256; record.value = refreshed.content; record.dirty = false; renderTabs(); toast(`Đã lưu ${file} qua Nolane Agent Core broker`);
    } catch (error) {
      if (error.payload?.code === 'FILE_CONFLICT') { toast('File đã thay đổi trên đĩa; mở Diff để hợp nhất', true); await showDiff(error.payload.current?.content ?? ''); return; }
      throw error;
    }
  };
  const showDiff = async (diskContent = null) => {
    const file = editorState.activePath; if (!file) return toast('Chưa mở file', true);
    const modified = currentValue();
    const result = diskContent == null ? await api('/api/workroom/diff', { method: 'POST', body: JSON.stringify({ projectId: state.projectId, file, content: modified }) }) : { original: diskContent, modified };
    const monaco = await ensureMonaco(); if (!monaco) { byId('diff-output').textContent = `--- disk\n${result.original}\n+++ editor\n${result.modified}`; return; }
    byId('diff-pane').hidden = false;
    editorState.diffEditor?.dispose();
    editorState.diffEditor = monaco.editor.createDiffEditor(byId('diff-host'), { theme: 'vs-dark', automaticLayout: true, readOnly: true, renderSideBySide: true });
    const original = monaco.editor.createModel(result.original, languageFor(file)); const modifiedModel = monaco.editor.createModel(result.modified, languageFor(file));
    editorState.diffEditor.setModel({ original, modified: modifiedModel });
    editorState.diffEditor.onDidDispose(() => { original.dispose(); modifiedModel.dispose(); });
  };

  const renderTree = async (directory = '.') => {
    if (!state.projectId) return;
    const tree = await api(`/api/workroom/tree?projectId=${encodeURIComponent(state.projectId)}&directory=${encodeURIComponent(directory)}`);
    const list = document.createDocumentFragment();
    if (tree.directory && tree.directory !== '.') { const up = document.createElement('button'); up.className = 'tree-item folder'; up.textContent = '↰ ..'; up.onclick = () => renderTree(tree.directory.split('/').slice(0, -1).join('/') || '.'); list.append(up); }
    for (const entry of tree.entries) {
      const item = document.createElement('button'); item.className = `tree-item ${entry.type}`; item.textContent = `${entry.type === 'directory' ? '▸' : '·'} ${entry.name}`;
      item.onclick = () => entry.type === 'directory' ? renderTree(entry.path) : openFile(entry.path).catch((error) => toast(error.message, true)); list.append(item);
    }
    byId('file-tree-path').textContent = tree.directory; byId('file-tree').replaceChildren(list);
  };

  const ensureTerminalLibraries = async () => {
    if (terminalState.Terminal) return true;
    const status = await assetStatus(); if (!status.ready) return false;
    if (!document.querySelector('link[data-xterm-css]')) { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/vendor-assets/xterm/xterm.css'; link.dataset.xtermCss = 'true'; document.head.append(link); }
    const [{ Terminal }, { FitAddon }] = await Promise.all([import('/vendor-assets/xterm/xterm.mjs'), import('/vendor-assets/xterm/addon-fit.mjs')]);
    terminalState.Terminal = Terminal; terminalState.FitAddon = FitAddon;
    terminalState.api = new TerminalSocket({ token, onEvent: terminalEvent, onStatus: (statusText) => { byId('terminal-status').textContent = statusText; } });
    await terminalState.api.connect(); await recoverTerminals(); return true;
  };
  const flushTerminalWrites = (session) => {
    session.writeTimer = null;
    const pending = session.pendingWrites?.splice(0) ?? [];
    for (const data of pending) session.term.write(data);
  };
  const scheduleTerminalWrite = (session, data) => {
    session.pendingWrites ??= [];
    session.pendingWrites.push(data);
    if (session.writeTimer) return;
    const interval = terminalState.performancePolicy?.terminalFrameIntervalMs ?? 16;
    session.writeTimer = setTimeout(() => flushTerminalWrites(session), interval);
  };
  const terminalEvent = (event) => {
    const session = terminalState.sessions.get(event.sessionId); if (!session) return;
    if (event.type === 'output') { session.cursor = Math.max(session.cursor || 0, Number(event.cursor) || 0); scheduleTerminalWrite(session, decodeBase64(event.data)); }
    if (event.type === 'title') { session.title = event.title || session.title; renderTerminalTabs(); }
    if (event.type === 'exit') { session.term.write(`\r\n[process exited: ${event.exitCode ?? event.signal ?? 'unknown'}]\r\n`); session.exited = true; renderTerminalTabs(); }
    if (event.type === 'session-error') session.term.write(`\r\n[terminal error: ${event.message || 'unknown'}]\r\n`);
  };
  const createTerminalView = (entry) => {
    if (terminalState.sessions.has(entry.id)) return terminalState.sessions.get(entry.id);
    const container = document.createElement('div'); container.className = 'terminal-instance'; container.hidden = true; byId('terminal-host').append(container);
    const term = new terminalState.Terminal({ convertEol: false, cursorBlink: true, scrollback: 5000, fontSize: 13, fontFamily: 'Cascadia Mono, Consolas, monospace', theme: { background: '#090d14', foreground: '#dbe7ff' } });
    const fit = new terminalState.FitAddon(); term.loadAddon(fit); term.open(container); fit.fit();
    const session = { ...entry, term, fit, container, cursor: Number(entry.cursor) || 0, title: entry.shell?.split(/[\\/]/).pop() || 'Terminal', exited: entry.state === 'exited' };
    term.onData((data) => { if (!session.exited) terminalState.api.request('input', { sessionId: entry.id, data }).catch((error) => toast(error.message, true)); });
    term.onResize(({ cols, rows }) => { if (!session.exited) terminalState.api.request('resize', { sessionId: entry.id, cols, rows }).catch(() => {}); });
    terminalState.sessions.set(entry.id, session); activateTerminal(entry.id); return session;
  };
  const activateTerminal = (id) => {
    terminalState.activeId = id; for (const [sessionId, session] of terminalState.sessions) session.container.hidden = sessionId !== id;
    terminalState.sessions.get(id)?.fit.fit(); renderTerminalTabs();
  };
  const renderTerminalTabs = () => {
    byId('terminal-tabs').replaceChildren(...[...terminalState.sessions.values()].map((session) => {
      const button = document.createElement('button'); button.className = `terminal-tab ${session.id === terminalState.activeId ? 'active' : ''}`; button.textContent = `${session.exited ? '○' : '●'} ${session.title}`; button.onclick = () => activateTerminal(session.id); return button;
    }));
  };
  const recoverTerminals = async () => {
    const sessions = await terminalState.api.request('list');
    for (const entry of sessions) { const session = createTerminalView(entry); const chunks = await terminalState.api.request('snapshot', { sessionId: entry.id, afterCursor: session.cursor || 0 }); for (const chunk of (Array.isArray(chunks) ? chunks : [chunks])) if (chunk?.data) { session.cursor = Number(chunk.cursor) || session.cursor; session.term.write(decodeBase64(chunk.data)); } }
  };
  const newTerminal = async () => {
    if (!state.projectId) return toast('Hãy chọn dự án', true);
    if (!await ensureTerminalLibraries()) return toast('Hãy cài Monaco/xterm assets trước', true);
    const shell = byId('terminal-shell').value; if (!shell) return toast('Không có shell được cho phép', true);
    const entry = await terminalState.api.request('create', { projectId: state.projectId, shell, cwd: '.', cols: 100, rows: 30 }); createTerminalView(entry);
  };
  const closeTerminal = async () => {
    const id = terminalState.activeId; if (!id) return;
    await terminalState.api.request('terminate', { sessionId: id }); const session = terminalState.sessions.get(id); session?.term.dispose(); session?.container.remove(); terminalState.sessions.delete(id); terminalState.activeId = terminalState.sessions.keys().next().value || null; if (terminalState.activeId) activateTerminal(terminalState.activeId); else renderTerminalTabs();
  };

  const loadCredentials = async () => {
    const values = await api('/api/credentials');
    byId('credential-list').replaceChildren(...values.map((item) => { const row = document.createElement('div'); row.className = 'credential-row'; const label = document.createElement('span'); label.textContent = `${item.service} · ${item.account}`; const remove = document.createElement('button'); remove.textContent = 'Xóa'; remove.onclick = async () => { await api(`/api/credentials/${encodeURIComponent(item.service)}/${encodeURIComponent(item.account)}`, { method: 'DELETE' }); await loadCredentials(); }; row.append(label, remove); return row; }));
  };
  const loadInstructions = async () => { if (state.projectId) byId('instruction-output').textContent = JSON.stringify(await api(`/api/instructions?projectId=${encodeURIComponent(state.projectId)}`), null, 2); };

  byId('install-ui-assets').onclick = async () => { try { byId('install-ui-assets').disabled = true; byId('asset-status').textContent = 'Đang tải và xác minh SHA-512…'; await api('/api/ui-assets/install', { method: 'POST', body: '{}' }); await assetStatus(); await ensureMonaco(); toast('Đã cài Monaco 0.55.1 và xterm 6.0.0 từ gói đã ghim'); } catch (error) { toast(error.message, true); } finally { byId('install-ui-assets').disabled = false; } };
  byId('refresh-tree').onclick = () => renderTree('.').catch((error) => toast(error.message, true));
  byId('save-file').onclick = () => saveActive().catch((error) => toast(error.message, true));
  byId('diff-file').onclick = () => showDiff().catch((error) => toast(error.message, true));
  byId('close-diff').onclick = () => { byId('diff-pane').hidden = true; editorState.diffEditor?.dispose(); editorState.diffEditor = null; };
  editorState.fallback.oninput = () => { const record = editorState.models.get(editorState.activePath); if (record) { record.dirty = editorState.fallback.value !== record.original; renderTabs(); } };
  byId('new-terminal').onclick = () => newTerminal().catch((error) => toast(error.message, true));
  byId('close-terminal').onclick = () => closeTerminal().catch((error) => toast(error.message, true));
  byId('credential-form').onsubmit = async (event) => { event.preventDefault(); try { await api('/api/credentials', { method: 'POST', body: JSON.stringify({ service: byId('credential-service').value, account: byId('credential-account').value, secret: byId('credential-secret').value }) }); byId('credential-secret').value = ''; await loadCredentials(); toast('Secret đã được lưu trong OS vault'); } catch (error) { toast(error.message, true); } };
  byId('check-update').onclick = async () => { try { const result = await api('/api/updates/check', { method: 'POST', body: '{}' }); stagedManifest = result.manifest || null; byId('stage-update').hidden = !result.available; byId('update-output').textContent = JSON.stringify(result, null, 2); if (result.available) showUpdateBanner({ message: `Phiên bản ${result.manifest.version} đã sẵn sàng trên GitHub Releases.`, action: 'download' }); } catch (error) { toast(error.message, true); } };
  byId('stage-update').onclick = () => stageSelectedUpdate().catch((error) => toast(error.message, true));
  byId('install-update').onclick = () => installStagedUpdate().catch((error) => toast(error.message, true));
  byId('update-banner-action').onclick = () => (byId('update-banner-action').dataset.action === 'install' ? installStagedUpdate() : stageSelectedUpdate()).catch((error) => toast(error.message, true));
  byId('update-banner-dismiss').onclick = () => { updateBanner.hidden = true; };
  desktopUpdater?.onUpdateState?.((status) => { if (status?.ready) showUpdateBanner({ message: `Phiên bản ${status.version} đã tải xong và được xác minh.`, action: 'install' }); });
  byId('load-instructions').onclick = () => loadInstructions().catch((error) => toast(error.message, true));

  const setProject = async (projectId) => {
    if (editorState.projectId !== projectId) { editorState.projectId = projectId; closeModels(); }
    await Promise.allSettled([renderTree('.'), loadInstructions()]);
  };
  Promise.allSettled([assetStatus(), loadRuntime(), loadCredentials()]).then(async () => { await ensureMonaco(); await autoCheckUpdate().catch(() => {}); }).catch(() => {});
  return { setProject, refreshRuntime: loadRuntime };
}
