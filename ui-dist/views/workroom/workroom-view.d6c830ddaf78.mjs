const PANEL_DEFAULTS = Object.freeze({ files: { open: true, size: 220 }, editor: { open: true, size: null }, agent: { open: true, size: 360 } });
const TERMINAL_OUTPUT_LIMIT = 100_000;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const languageOf = (value) => value === 'vi' ? 'vi' : 'en';

function initialTerminal() { return { id: null, title: 'Terminal', status: 'idle', output: '', exited: false }; }

export function createWorkroomModel({ projectId, missionId = null, returnPath = '/', language = 'en' } = {}) {
  if (!projectId) throw new Error('Workroom requires projectId');
  const panels = Object.fromEntries(Object.entries(PANEL_DEFAULTS).map(([key, value]) => [key, { ...value }]));
  const openFiles = [];
  let activeFile = null;
  let tree = [];
  let file = null;
  let draftContent = '';
  let activeTab = 'editor';
  let diff = null;
  let error = null;
  let loading = false;
  let terminal = initialTerminal();
  let agentTab = 'agent';
  let gitStatus = null;
  let compactPane = 'editor';
  return Object.freeze({
    setPanel(name, open) { if (!panels[name]) throw new Error(`Unknown Workroom panel: ${name}`); panels[name].open = Boolean(open); },
    setPanelSize(name, size) { if (!panels[name]) throw new Error(`Unknown Workroom panel: ${name}`); const number = Number(size); if (!Number.isFinite(number) || number < 160 || number > 900) throw new Error('Panel size out of bounds'); panels[name].size = number; },
    setCompactPane(name) { if (!['files', 'editor', 'agent'].includes(name)) throw new Error(`Unknown compact pane: ${name}`); compactPane = name; },
    openFile(path) { const value = String(path ?? '').trim(); if (!value) throw new Error('File path is required'); if (!openFiles.includes(value)) openFiles.push(value); activeFile = value; activeTab = 'editor'; diff = null; },
    closeFile(path) { const value = String(path ?? ''); const index = openFiles.indexOf(value); if (index >= 0) openFiles.splice(index, 1); if (activeFile === value) { activeFile = openFiles.at(-1) ?? null; file = null; draftContent = ''; diff = null; } },
    setTree(entries = []) { tree = Array.isArray(entries) ? entries.map((entry) => Object.freeze({ ...entry })) : []; },
    setFile(value = null) { file = value && typeof value === 'object' ? Object.freeze({ ...value }) : null; draftContent = file?.content ?? ''; activeFile = file?.path ?? activeFile; if (activeFile && !openFiles.includes(activeFile)) openFiles.push(activeFile); activeTab = 'editor'; diff = null; error = null; },
    setDraftContent(value) { draftContent = String(value ?? ''); },
    setTab(value) { activeTab = ['editor', 'changes', 'preview'].includes(value) ? value : 'editor'; },
    setDiff(value = null) { diff = value && typeof value === 'object' ? Object.freeze({ ...value }) : null; },
    setError(value = null) { error = value == null ? null : String(value); },
    setLoading(value) { loading = Boolean(value); },
    setTerminal(value = {}) { terminal = { ...terminal, ...value, id: value.id == null ? terminal.id : String(value.id), title: String(value.title ?? terminal.title), status: String(value.status ?? terminal.status), output: String(value.output ?? terminal.output).slice(-TERMINAL_OUTPUT_LIMIT), exited: Boolean(value.exited ?? terminal.exited) }; },
    setGitStatus(value = null) { gitStatus = value && typeof value === 'object' ? Object.freeze({ clean: Boolean(value.clean), entries: Object.freeze(Array.isArray(value.entries) ? value.entries.map((entry) => Object.freeze({ ...entry })) : []) }) : null; },
    appendTerminalOutput(value) { terminal = { ...terminal, output: `${terminal.output}${String(value ?? '')}`.slice(-TERMINAL_OUTPUT_LIMIT) }; },
    clearTerminal() { terminal = initialTerminal(); },
    setAgentTab(value) { agentTab = value === 'terminal' && terminal.id ? 'terminal' : 'agent'; },
    snapshot() { return Object.freeze({ projectId: String(projectId), missionId: missionId ? String(missionId) : null, returnPath: String(returnPath || '/'), language: languageOf(language), compactPane, panels: Object.freeze(Object.fromEntries(Object.entries(panels).map(([key, value]) => [key, Object.freeze({ ...value })]))), openFiles: Object.freeze([...openFiles]), activeFile, tree: Object.freeze([...tree]), file, draftContent, dirty: file ? draftContent !== String(file.content ?? '') : false, activeTab, diff, error, loading, agentTab, terminal: Object.freeze({ ...terminal }), gitStatus }); },
  });
}

function copy(language) {
  const vi = languageOf(language) === 'vi';
  return {
    back: vi ? 'Quay lại nhiệm vụ' : 'Back to mission', studio: 'Studio', description: vi ? 'Tệp, terminal, diff và hoạt động AI trong một không gian kỹ thuật tập trung.' : 'Files, terminal, diffs, and live agent work in one focused surface.',
    command: vi ? 'Lệnh' : 'Command', terminal: 'Terminal', editor: vi ? 'Trình soạn thảo' : 'Editor', changes: vi ? 'Thay đổi' : 'Changes', preview: vi ? 'Xem trước' : 'Preview', layout: vi ? 'Bố cục' : 'Layout', files: vi ? 'Tệp' : 'Files', filterFiles: vi ? 'Lọc tệp' : 'Filter files', noFile: vi ? 'Chưa mở tệp' : 'No file open',
    noTree: vi ? 'Chưa tải được cây tệp.' : 'The file tree is not available yet.', loading: vi ? 'Đang tải…' : 'Loading…', save: vi ? 'Lưu' : 'Save', saving: vi ? 'Đang lưu…' : 'Saving…', diff: vi ? 'Xem diff' : 'View diff', clean: vi ? 'Không có thay đổi chưa lưu' : 'No unsaved changes',
    welcome: vi ? 'Mở tệp, kiểm tra diff hoặc yêu cầu agent điều hướng kho mã.' : 'Open a file, inspect a diff, or ask the agent to navigate the repository.', agent: vi ? 'AI / Terminal' : 'Agent / Terminal', agentReady: vi ? 'Agent đã sẵn sàng' : 'Agent is ready', agentHint: vi ? 'Bắt đầu hoặc gắn một nhiệm vụ để xem lượt đọc tệp, lệnh, công cụ và bằng chứng kiểm chứng.' : 'Start or attach a mission to see file reads, commands, tools, and verification here.', steer: vi ? 'Điều hướng agent…' : 'Steer the agent…',
    local: vi ? 'Cục bộ' : 'Local', bytes: vi ? 'byte' : 'bytes', changed: vi ? 'đã thay đổi' : 'changed', unchanged: vi ? 'không thay đổi' : 'unchanged', original: vi ? 'Bản gốc' : 'Original', modified: vi ? 'Bản nháp' : 'Draft', previewUnavailable: vi ? 'Chưa có bản xem trước cho tệp này.' : 'No preview is available for this file yet.', gitClean: vi ? 'Git sạch' : 'Git clean', gitUnavailable: vi ? 'Không có trạng thái Git' : 'Git status unavailable', filesChanged: vi ? 'tệp đã thay đổi' : 'files changed', unsaved: vi ? 'Có thay đổi chưa lưu' : 'Unsaved changes', saved: vi ? 'Đã lưu' : 'Saved', terminalConnected: vi ? 'Terminal đã kết nối' : 'Terminal connected', terminalIdle: vi ? 'Terminal chưa mở' : 'Terminal not open',
    openTerminal: vi ? 'Mở terminal' : 'Open terminal', terminalUnavailable: vi ? 'Terminal cục bộ chưa mở.' : 'No local terminal is open.', terminalHint: vi ? 'Terminal chạy trong project hiện tại và tuân theo chính sách shell của runtime.' : 'The terminal runs in the current project and follows the runtime shell policy.', closeTerminal: vi ? 'Đóng terminal' : 'Close terminal', terminalInput: vi ? 'Nhập lệnh terminal' : 'Enter terminal command', send: vi ? 'Gửi' : 'Send', terminalDisconnected: vi ? 'Đã ngắt kết nối' : 'Disconnected',
  };
}

function renderTree(snapshot, language) {
  const c = copy(language);
  const entries = Array.isArray(snapshot.tree) ? snapshot.tree : [];
  if (snapshot.loading && !entries.length) return `<div class="workroom-empty"><span class="spinner"></span><p>${c.loading}</p></div>`;
  if (!entries.length) return `<div class="workroom-empty"><span>⌘P</span><p>${c.noTree}</p></div>`;
  return entries.map((entry) => {
    const path = escapeHtml(entry.path);
    const name = escapeHtml(entry.name ?? entry.path?.split('/').at(-1));
    return entry.type === 'directory'
      ? `<button type="button" class="workroom-tree-entry workroom-tree-entry--directory" data-workroom-directory="${path}"><span aria-hidden="true">▸</span><strong>${name}</strong></button>`
      : `<button type="button" class="workroom-tree-entry" data-workroom-file="${path}" aria-current="${String(snapshot.activeFile === entry.path)}"><span aria-hidden="true">${escapeHtml((entry.name ?? '').split('.').at(-1)?.toUpperCase() || 'FILE')}</span><strong>${name}</strong><small>${entry.bytes == null ? '' : `${Number(entry.bytes).toLocaleString()} ${c.bytes}`}</small></button>`;
  }).join('');
}

function renderEditor(snapshot, language) {
  const c = copy(language);
  const file = snapshot.file;
  if (snapshot.activeTab === 'changes') {
    const diff = snapshot.diff;
    return `<div class="workroom-diff-view">${diff ? `<header><strong>${escapeHtml(diff.path ?? snapshot.activeFile)}</strong><span data-tone="${diff.changed ? 'warning' : 'success'}">${diff.changed ? c.changed : c.unchanged}</span></header><div class="workroom-diff-columns"><section><h3>${c.original}</h3><pre>${escapeHtml(String(diff.original ?? '').slice(0, 80000))}</pre></section><section><h3>${c.modified}</h3><pre>${escapeHtml(String(diff.modified ?? '').slice(0, 80000))}</pre></section></div>` : `<div class="editor-placeholder"><h2>${c.diff}</h2><p>${c.clean}</p></div>`}</div>`;
  }
  if (snapshot.activeTab === 'preview') return `<div class="workroom-preview"><pre>${file ? escapeHtml(String(snapshot.draftContent ?? '').slice(0, 80000)) : c.previewUnavailable}</pre></div>`;
  if (!file) return `<div class="editor-welcome"><span>N</span><h2>Nolane Studio</h2><p>${c.welcome}</p><div><kbd>⌘P</kbd><span>${languageOf(language) === 'vi' ? 'Mở nhanh' : 'Quick open'}</span><kbd>⌘⇧F</kbd><span>${languageOf(language) === 'vi' ? 'Tìm kiếm' : 'Search'}</span></div></div>`;
  return `<div class="workroom-editor-surface"><textarea data-workroom-editor spellcheck="false" aria-label="${escapeHtml(file.path)}">${escapeHtml(snapshot.draftContent)}</textarea><footer><span>${snapshot.dirty ? (languageOf(language) === 'vi' ? 'Có thay đổi chưa lưu' : 'Unsaved changes') : c.clean}</span><span>${Number(file.bytes ?? new Blob([snapshot.draftContent]).size).toLocaleString()} ${c.bytes}</span></footer></div>`;
}

function renderAgentPane(snapshot, language) {
  const c = copy(language);
  const terminal = snapshot.terminal;
  const terminalOpen = Boolean(terminal.id) && snapshot.agentTab === 'terminal';
  const terminalDisabled = snapshot.projectId === 'unselected' ? ' disabled' : '';
  const controls = `<header><div><button type="button" data-workroom-agent-tab="agent" aria-pressed="${!terminalOpen}">Agent</button><button type="button" data-workroom-agent-tab="terminal" aria-pressed="${terminalOpen}"${terminalDisabled}>${c.terminal}</button></div></header>`;
  if (!terminalOpen) return `<aside class="workroom-agent" aria-label="${c.agent}" data-panel="agent" data-open="${snapshot.panels.agent.open}" data-compact-active="${snapshot.compactPane === 'agent'}">${controls}<div class="workroom-agent__body"><div class="agent-state-orb"><span></span></div><strong>${c.agentReady}</strong><p>${c.agentHint}</p><button type="button" data-workroom-action="terminal"${terminalDisabled}>${c.openTerminal}</button></div><footer><textarea data-workroom-steer placeholder="${c.steer}" aria-label="${c.steer}"${terminalDisabled}></textarea><button type="button" data-workroom-action="steer" aria-label="${languageOf(language) === 'vi' ? 'Gửi chỉ dẫn' : 'Send direction'}"${terminalDisabled}>↑</button></footer></aside>`;
  return `<aside class="workroom-agent" aria-label="${c.agent}" data-panel="agent" data-open="${snapshot.panels.agent.open}" data-compact-active="${snapshot.compactPane === 'agent'}">${controls}<div class="workroom-terminal" data-terminal-status="${escapeHtml(terminal.status)}"><header><div><strong>${escapeHtml(terminal.title)}</strong><small>${terminal.exited ? c.terminalDisconnected : escapeHtml(terminal.status)}</small></div><button type="button" data-workroom-action="terminal-close">${c.closeTerminal}</button></header><pre data-workroom-terminal-output aria-live="polite">${escapeHtml(terminal.output)}</pre><form data-workroom-terminal-form><label class="sr-only" for="workroom-terminal-input">${c.terminalInput}</label><input id="workroom-terminal-input" data-workroom-terminal-input autocomplete="off" spellcheck="false" placeholder="${c.terminalInput}"${terminal.exited ? ' disabled' : ''}><button type="submit"${terminal.exited ? ' disabled' : ''}>${c.send}</button></form></div></aside>`;
}

function renderStatusBar(snapshot, c) {
  const git = snapshot.gitStatus;
  const changeCount = Array.isArray(git?.entries) ? git.entries.length : 0;
  const gitState = git == null ? 'unavailable' : git.clean ? 'clean' : 'changed';
  const gitLabel = git == null ? c.gitUnavailable : git.clean ? c.gitClean : `${changeCount} ${c.filesChanged}`;
  const terminal = snapshot.terminal ?? {};
  const terminalState = terminal.id && !terminal.exited ? 'connected' : terminal.exited ? 'disconnected' : 'idle';
  const terminalLabel = terminalState === 'connected' ? c.terminalConnected : terminalState === 'disconnected' ? c.terminalDisconnected : c.terminalIdle;
  return `<footer class="workroom-statusbar"><span data-workroom-git-status="${gitState}">${escapeHtml(gitLabel)}</span><span data-workroom-file-state="${snapshot.dirty ? 'dirty' : 'saved'}">${snapshot.dirty ? c.unsaved : c.saved}</span><span data-workroom-terminal-state="${terminalState}">${escapeHtml(terminalLabel)}</span><i></i><span>${c.local}</span><span>UTF-8</span></footer>`;
}

export function renderWorkroomView(snapshot, { language = snapshot?.language ?? 'en' } = {}) {
  const c = copy(language);
  const error = snapshot.error ? `<div class="workroom-notice workroom-notice--error" role="alert">${escapeHtml(snapshot.error)}</div>` : '';
  const terminalDisabled = snapshot.projectId === 'unselected' ? ' disabled' : '';
  const missionTrace = snapshot.missionId ? `<div class="workroom-mission-trace" role="status"><span>${languageOf(language) === 'vi' ? 'Ngữ cảnh nhiệm vụ' : 'Mission context'}</span><code>${escapeHtml(snapshot.missionId)}</code><i aria-hidden="true"></i><span>${languageOf(language) === 'vi' ? 'Studio giữ nguyên dòng bằng chứng của nhiệm vụ' : 'Studio remains attached to this mission lineage'}</span></div>` : '';
  const compactLabel = languageOf(language) === 'vi' ? 'Chuyển bảng Studio' : 'Studio panes';
  const compactSwitcher = `<nav class="workroom-compact-panes" aria-label="${compactLabel}"><button type="button" data-workroom-pane="files" aria-pressed="${snapshot.compactPane === 'files'}">${c.files}</button><button type="button" data-workroom-pane="editor" aria-pressed="${snapshot.compactPane === 'editor'}">${c.editor}</button><button type="button" data-workroom-pane="agent" aria-pressed="${snapshot.compactPane === 'agent'}">Agent</button></nav>`;
  return `<section class="workroom-view" data-project-id="${escapeHtml(snapshot.projectId)}" data-active-tab="${escapeHtml(snapshot.activeTab ?? 'editor')}"><header class="workroom-header"><div><a href="#${escapeHtml(snapshot.returnPath)}" data-route="${escapeHtml(snapshot.returnPath)}">← ${c.back}</a><h1>${c.studio}</h1><p>${c.description}</p></div><div><button type="button" data-workroom-action="command">⌘ ${c.command}</button><button type="button" data-workroom-action="terminal"${terminalDisabled}>＋ ${c.terminal}</button></div></header>${missionTrace}${error}<div class="workroom-tabs"><button type="button" data-workroom-tab="editor" aria-pressed="${snapshot.activeTab === 'editor'}">${c.editor}</button><button type="button" data-workroom-tab="changes" aria-pressed="${snapshot.activeTab === 'changes'}">${c.changes}${snapshot.dirty ? ' •' : ''}</button><button type="button" data-workroom-tab="preview" aria-pressed="${snapshot.activeTab === 'preview'}">${c.preview}</button><span></span><button type="button" data-workroom-action="layout">${c.layout}</button>${compactSwitcher}</div><div class="workroom-grid" data-active-file="${escapeHtml(snapshot.activeFile ?? '')}"><aside class="workroom-files" data-panel="files" data-open="${snapshot.panels.files.open}" data-compact-active="${snapshot.compactPane === 'files'}"><header><strong>${c.files}</strong></header><label><span>⌕</span><input type="search" data-workroom-filter placeholder="${c.filterFiles}" aria-label="${c.filterFiles}"></label><div data-workroom-tree>${renderTree(snapshot, language)}</div></aside><main class="workroom-editor" data-panel="editor" data-open="${snapshot.panels.editor.open}" data-compact-active="${snapshot.compactPane === 'editor'}"><header>${snapshot.activeFile ? `<span>${escapeHtml(snapshot.activeFile)}</span><span class="workroom-editor-actions"><button type="button" data-workroom-action="diff"${snapshot.file ? '' : ' disabled'}>${c.diff}</button><button type="button" data-workroom-action="save"${!snapshot.dirty ? ' disabled' : ''}>${snapshot.loading ? c.saving : c.save}</button></span>` : `<span>${c.noFile}</span>`}</header>${renderEditor(snapshot, language)}</main>${renderAgentPane(snapshot, language)}</div>${renderStatusBar(snapshot, c)}</section>`;
}
