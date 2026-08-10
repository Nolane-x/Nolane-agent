import { t } from '../../core/i18n.09d7ba371880.mjs';

const PANEL_DEFAULTS = Object.freeze({ files: { open: true, size: 220 }, editor: { open: true, size: null }, agent: { open: true, size: 360 } });
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const languageOf = (value) => value === 'vi' ? 'vi' : 'en';

export function createWorkroomModel({ projectId, missionId = null, returnPath = '/', language = 'en' } = {}) {
  if (!projectId) throw new Error('Workroom requires projectId');
  const panels = Object.fromEntries(Object.entries(PANEL_DEFAULTS).map(([key, value]) => [key, { ...value }]));
  const openFiles = []; let activeFile = null; let tree = []; let file = null; let draftContent = ''; let activeTab = 'editor'; let diff = null; let error = null; let loading = false;
  return Object.freeze({
    setPanel(name, open) { if (!panels[name]) throw new Error(`Unknown Workroom panel: ${name}`); panels[name].open = Boolean(open); },
    setPanelSize(name, size) { if (!panels[name]) throw new Error(`Unknown Workroom panel: ${name}`); const number = Number(size); if (!Number.isFinite(number) || number < 160 || number > 900) throw new Error('Panel size out of bounds'); panels[name].size = number; },
    openFile(path) { const value = String(path ?? '').trim(); if (!value) throw new Error('File path is required'); if (!openFiles.includes(value)) openFiles.push(value); activeFile = value; activeTab = 'editor'; diff = null; },
    closeFile(path) { const value = String(path ?? ''); const index = openFiles.indexOf(value); if (index >= 0) openFiles.splice(index, 1); if (activeFile === value) { activeFile = openFiles.at(-1) ?? null; file = null; draftContent = ''; diff = null; } },
    setTree(entries = []) { tree = Array.isArray(entries) ? entries.map((entry) => Object.freeze({ ...entry })) : []; },
    setFile(value = null) { file = value && typeof value === 'object' ? Object.freeze({ ...value }) : null; draftContent = file?.content ?? ''; activeFile = file?.path ?? activeFile; if (activeFile && !openFiles.includes(activeFile)) openFiles.push(activeFile); activeTab = 'editor'; diff = null; error = null; },
    setDraftContent(value) { draftContent = String(value ?? ''); },
    setTab(value) { activeTab = ['editor', 'changes', 'preview'].includes(value) ? value : 'editor'; },
    setDiff(value = null) { diff = value && typeof value === 'object' ? Object.freeze({ ...value }) : null; },
    setError(value = null) { error = value == null ? null : String(value); },
    setLoading(value) { loading = Boolean(value); },
    snapshot() { return Object.freeze({ projectId: String(projectId), missionId: missionId ? String(missionId) : null, returnPath: String(returnPath || '/'), language: languageOf(language), panels: Object.freeze(Object.fromEntries(Object.entries(panels).map(([key, value]) => [key, Object.freeze({ ...value })]))), openFiles: Object.freeze([...openFiles]), activeFile, tree: Object.freeze([...tree]), file, draftContent, dirty: file ? draftContent !== String(file.content ?? '') : false, activeTab, diff, error, loading }); },
  });
}

function copy(language) {
  const vi = languageOf(language) === 'vi';
  return {
    back: vi ? 'Quay lại nhiệm vụ' : 'Back to mission', studio: 'Studio', description: vi ? 'Tệp, terminal, diff và hoạt động AI trong một không gian kỹ thuật tập trung.' : 'Files, terminal, diffs, and live agent work in one focused surface.',
    command: vi ? 'Lệnh' : 'Command', terminal: vi ? 'Terminal' : 'Terminal', editor: vi ? 'Trình soạn thảo' : 'Editor', changes: vi ? 'Thay đổi' : 'Changes', preview: vi ? 'Xem trước' : 'Preview', layout: vi ? 'Bố cục' : 'Layout', files: vi ? 'Tệp' : 'Files', filterFiles: vi ? 'Lọc tệp' : 'Filter files', noFile: vi ? 'Chưa mở tệp' : 'No file open', openFile: vi ? 'Mở một tệp hoặc dùng tìm kiếm kho mã để bắt đầu.' : 'Open a file or use repository search to begin.',
    noTree: vi ? 'Chưa tải được cây tệp.' : 'The file tree is not available yet.', loading: vi ? 'Đang tải…' : 'Loading…', save: vi ? 'Lưu' : 'Save', saving: vi ? 'Đang lưu…' : 'Saving…', saved: vi ? 'Đã lưu' : 'Saved', diff: vi ? 'Xem diff' : 'View diff', discard: vi ? 'Bỏ thay đổi' : 'Discard changes', clean: vi ? 'Không có thay đổi chưa lưu' : 'No unsaved changes', editorReady: vi ? 'Trình soạn thảo đã sẵn sàng.' : 'Editor host is ready for the selected file.', welcome: vi ? 'Mở tệp, kiểm tra diff hoặc yêu cầu agent điều hướng kho mã.' : 'Open a file, inspect a diff, or ask the agent to navigate the repository.', agent: vi ? 'AI / Terminal' : 'Agent / Terminal', agentReady: vi ? 'Agent đã sẵn sàng' : 'Agent is ready', agentHint: vi ? 'Bắt đầu hoặc gắn một nhiệm vụ để xem lượt đọc tệp, lệnh, công cụ và bằng chứng kiểm chứng.' : 'Start or attach a mission to see file reads, commands, tools, and verification here.', steer: vi ? 'Điều hướng agent…' : 'Steer the agent…', local: vi ? 'Cục bộ' : 'Local', errors: vi ? 'lỗi' : 'errors', warnings: vi ? 'cảnh báo' : 'warnings', bytes: vi ? 'byte' : 'bytes', changed: vi ? 'đã thay đổi' : 'changed', unchanged: vi ? 'không thay đổi' : 'unchanged', original: vi ? 'Bản gốc' : 'Original', modified: vi ? 'Bản nháp' : 'Draft', previewUnavailable: vi ? 'Chưa có bản xem trước cho tệp này.' : 'No preview is available for this file yet.',
  };
}

function renderTree(snapshot, language) {
  const c = copy(language); const entries = Array.isArray(snapshot.tree) ? snapshot.tree : [];
  if (snapshot.loading && !entries.length) return `<div class="workroom-empty"><span class="spinner"></span><p>${c.loading}</p></div>`;
  if (!entries.length) return `<div class="workroom-empty"><span>⌘P</span><p>${c.noTree}</p></div>`;
  return entries.map((entry) => {
    const path = escapeHtml(entry.path); const name = escapeHtml(entry.name ?? entry.path?.split('/').at(-1)); const isDirectory = entry.type === 'directory';
    return isDirectory
      ? `<button type="button" class="workroom-tree-entry workroom-tree-entry--directory" data-workroom-directory="${path}"><span aria-hidden="true">▸</span><strong>${name}</strong></button>`
      : `<button type="button" class="workroom-tree-entry" data-workroom-file="${path}" aria-current="${String(snapshot.activeFile === entry.path)}"><span aria-hidden="true">${escapeHtml((entry.name ?? '').split('.').at(-1)?.toUpperCase() || 'FILE')}</span><strong>${name}</strong><small>${entry.bytes == null ? '' : `${Number(entry.bytes).toLocaleString()} ${c.bytes}`}</small></button>`;
  }).join('');
}

function renderEditor(snapshot, language) {
  const c = copy(language); const file = snapshot.file;
  if (snapshot.activeTab === 'changes') {
    const diff = snapshot.diff;
    return `<div class="workroom-diff-view">${diff ? `<header><strong>${escapeHtml(diff.path ?? snapshot.activeFile)}</strong><span data-tone="${diff.changed ? 'warning' : 'success'}">${diff.changed ? c.changed : c.unchanged}</span></header><div class="workroom-diff-columns"><section><h3>${c.original}</h3><pre>${escapeHtml(String(diff.original ?? '').slice(0, 80000))}</pre></section><section><h3>${c.modified}</h3><pre>${escapeHtml(String(diff.modified ?? '').slice(0, 80000))}</pre></section></div>` : `<div class="editor-placeholder"><h2>${c.diff}</h2><p>${c.clean}</p></div>`}</div>`;
  }
  if (snapshot.activeTab === 'preview') return `<div class="workroom-preview"><pre>${file ? escapeHtml(String(snapshot.draftContent ?? '').slice(0, 80000)) : c.previewUnavailable}</pre></div>`;
  if (!file) return `<div class="editor-welcome"><span>N</span><h2>Nolane Studio</h2><p>${c.welcome}</p><div><kbd>⌘P</kbd><span>${languageOf(language) === 'vi' ? 'Mở nhanh' : 'Quick open'}</span><kbd>⌘⇧F</kbd><span>${languageOf(language) === 'vi' ? 'Tìm kiếm' : 'Search'}</span></div></div>`;
  return `<div class="workroom-editor-surface"><textarea data-workroom-editor spellcheck="false" aria-label="${escapeHtml(file.path)}">${escapeHtml(snapshot.draftContent)}</textarea><footer><span>${snapshot.dirty ? (languageOf(language) === 'vi' ? 'Có thay đổi chưa lưu' : 'Unsaved changes') : c.clean}</span><span>${Number(file.bytes ?? new Blob([snapshot.draftContent]).size).toLocaleString()} ${c.bytes}</span></footer></div>`;
}

export function renderWorkroomView(snapshot, { language = snapshot?.language ?? 'en' } = {}) {
  const c = copy(language); const lang = languageOf(language); const dirty = Boolean(snapshot.dirty); const error = snapshot.error ? `<div class="workroom-notice workroom-notice--error" role="alert">${escapeHtml(snapshot.error)}</div>` : '';
  return `<section class="workroom-view" data-project-id="${escapeHtml(snapshot.projectId)}" data-active-tab="${escapeHtml(snapshot.activeTab ?? 'editor')}"><header class="workroom-header"><div><a href="#${escapeHtml(snapshot.returnPath)}" data-route="${escapeHtml(snapshot.returnPath)}">← ${c.back}</a><h1>${c.studio}</h1><p>${c.description}</p></div><div><button type="button" data-workroom-action="command">⌘ ${c.command}</button><button type="button" data-workroom-action="terminal">＋ ${c.terminal}</button></div></header>${error}<div class="workroom-tabs"><button type="button" data-workroom-tab="editor" aria-pressed="${snapshot.activeTab === 'editor'}">${c.editor}</button><button type="button" data-workroom-tab="changes" aria-pressed="${snapshot.activeTab === 'changes'}">${c.changes}${dirty ? ' •' : ''}</button><button type="button" data-workroom-tab="preview" aria-pressed="${snapshot.activeTab === 'preview'}">${c.preview}</button><span></span><button type="button" data-workroom-action="layout">${c.layout}</button></div><div class="workroom-grid" data-active-file="${escapeHtml(snapshot.activeFile ?? '')}"><aside class="workroom-files" data-panel="files" data-open="${snapshot.panels.files.open}"><header><strong>${c.files}</strong><button type="button" aria-label="${lang === 'vi' ? 'Tùy chọn tệp' : 'File options'}">•••</button></header><label><span>⌕</span><input type="search" data-workroom-filter placeholder="${c.filterFiles}" aria-label="${c.filterFiles}"></label><div data-workroom-tree>${renderTree(snapshot, lang)}</div></aside><main class="workroom-editor" data-panel="editor" data-open="${snapshot.panels.editor.open}"><header>${snapshot.activeFile ? `<span>${escapeHtml(snapshot.activeFile)}</span><span class="workroom-editor-actions"><button type="button" data-workroom-action="diff"${snapshot.file ? '' : ' disabled'}>${c.diff}</button><button type="button" data-workroom-action="save"${!dirty ? ' disabled' : ''}>${snapshot.loading ? c.saving : c.save}</button></span>` : `<span>${c.noFile}</span>`}</header>${renderEditor(snapshot, lang)}</main><aside class="workroom-agent" aria-label="${c.agent}" data-panel="agent" data-open="${snapshot.panels.agent.open}"><header><div><button type="button" aria-pressed="true">${lang === 'vi' ? 'Agent' : 'Agent'}</button><button type="button">${c.terminal}</button></div><button type="button" aria-label="${lang === 'vi' ? 'Tùy chọn agent' : 'Agent options'}">•••</button></header><div class="workroom-agent__body"><div class="agent-state-orb"><span></span></div><strong>${c.agentReady}</strong><p>${c.agentHint}</p></div><footer><textarea placeholder="${c.steer}" aria-label="${c.steer}"></textarea><button type="button" aria-label="${lang === 'vi' ? 'Gửi chỉ dẫn' : 'Send direction'}">↑</button></footer></aside></div><footer class="workroom-statusbar"><span>main</span><span>0 ${c.errors}</span><span>0 ${c.warnings}</span><i></i><span>${c.local}</span><span>UTF-8</span></footer></section>`;
}
