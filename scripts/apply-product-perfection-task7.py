from pathlib import Path
import subprocess

EXPECTED = {
    'ui-v3/app.mjs': '387655a2f0008e3c128d53df777833cf4d5fb7c9',
    'ui-v3/views/workroom/workroom-view.mjs': '61847c540ab6f93610b18805c2e2ab3cc464c8c4',
    'ui-v3/styles/pages/workroom.css': '0c482ce963d96eeae992d31e62b5bfe1fb682f3c',
    'ui-v3/views/browser/browser-view.mjs': 'eba50802fb5f4faf13803fa78651a595fb06710e',
    'ui-v3/views/browser/browser-inspector.mjs': '03865f0815016c77154a614b59c4355465a33ef4',
    'ui-v3/styles/pages/browser.css': '3bdbe812613bf870a70fa4d46ba29bab912e030b',
}

def blob(path):
    return subprocess.check_output(['git', 'hash-object', path], text=True).strip()

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new)

def replace_exact_count(text, old, new, expected, label):
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'{label}: expected {expected} matches, found {count}')
    return text.replace(old, new)

for path, expected in EXPECTED.items():
    actual = blob(path)
    print(f'guard {path}: {actual}')
    if actual != expected:
        raise SystemExit(f'{path}: unexpected blob {actual}; expected {expected}')

p = Path('ui-v3/views/workroom/workroom-view.mjs')
s = p.read_text()
s = replace_once(s, "  let gitStatus = null;\n", "  let gitStatus = null;\n  let compactPane = 'editor';\n", 'workroom compact state')
s = replace_once(s, "    setPanelSize(name, size) { if (!panels[name]) throw new Error(`Unknown Workroom panel: ${name}`); const number = Number(size); if (!Number.isFinite(number) || number < 160 || number > 900) throw new Error('Panel size out of bounds'); panels[name].size = number; },\n", "    setPanelSize(name, size) { if (!panels[name]) throw new Error(`Unknown Workroom panel: ${name}`); const number = Number(size); if (!Number.isFinite(number) || number < 160 || number > 900) throw new Error('Panel size out of bounds'); panels[name].size = number; },\n    setCompactPane(name) { if (!['files', 'editor', 'agent'].includes(name)) throw new Error(`Unknown compact pane: ${name}`); compactPane = name; },\n", 'workroom compact setter')
s = replace_once(s, "snapshot() { return Object.freeze({ projectId: String(projectId), missionId: missionId ? String(missionId) : null, returnPath: String(returnPath || '/'), language: languageOf(language), panels:", "snapshot() { return Object.freeze({ projectId: String(projectId), missionId: missionId ? String(missionId) : null, returnPath: String(returnPath || '/'), language: languageOf(language), compactPane, panels:", 'workroom compact snapshot')
s = replace_exact_count(s, 'data-panel="agent" data-open="${snapshot.panels.agent.open}"', 'data-panel="agent" data-open="${snapshot.panels.agent.open}" data-compact-active="${snapshot.compactPane === \'agent\'}"', 2, 'workroom agent compact ownership')
s = replace_once(s, "  return `<section class=\"workroom-view\" data-project-id=\"${escapeHtml(snapshot.projectId)}\" data-active-tab=\"${escapeHtml(snapshot.activeTab ?? 'editor')}\">", "  const compactLabel = languageOf(language) === 'vi' ? 'Chuyển bảng Studio' : 'Studio panes';\n  const compactSwitcher = `<nav class=\"workroom-compact-panes\" aria-label=\"${compactLabel}\"><button type=\"button\" data-workroom-pane=\"files\" aria-pressed=\"${snapshot.compactPane === 'files'}\">${c.files}</button><button type=\"button\" data-workroom-pane=\"editor\" aria-pressed=\"${snapshot.compactPane === 'editor'}\">${c.editor}</button><button type=\"button\" data-workroom-pane=\"agent\" aria-pressed=\"${snapshot.compactPane === 'agent'}\">Agent</button></nav>`;\n  return `<section class=\"workroom-view\" data-project-id=\"${escapeHtml(snapshot.projectId)}\" data-active-tab=\"${escapeHtml(snapshot.activeTab ?? 'editor')}\">", 'workroom compact switcher declaration')
s = replace_once(s, '<button type="button" data-workroom-action="layout">${c.layout}</button></div><div class="workroom-grid"', '<button type="button" data-workroom-action="layout">${c.layout}</button>${compactSwitcher}</div><div class="workroom-grid"', 'workroom compact switcher placement')
s = replace_once(s, 'class="workroom-files" data-panel="files" data-open="${snapshot.panels.files.open}"', 'class="workroom-files" data-panel="files" data-open="${snapshot.panels.files.open}" data-compact-active="${snapshot.compactPane === \'files\'}"', 'workroom files compact state')
s = replace_once(s, 'class="workroom-editor" data-panel="editor" data-open="${snapshot.panels.editor.open}"', 'class="workroom-editor" data-panel="editor" data-open="${snapshot.panels.editor.open}" data-compact-active="${snapshot.compactPane === \'editor\'}"', 'workroom editor compact state')
p.write_text(s)

p = Path('ui-v3/app.mjs')
s = p.read_text()
s = replace_once(s, "router.register({ id: 'workroom', pattern: /^\\/workroom(?:\\?.*)?$/, title: 'Studio', load: async () => {", "router.register({ id: 'workroom', pattern: /^\\/workroom(?:\\?.*)?$/, cache: 'path', title: 'Studio', load: async () => {", 'workroom route cache')
s = replace_once(s, "const file = event.target.closest?.('[data-workroom-file]'); const directory = event.target.closest?.('[data-workroom-directory]'); const tab = event.target.closest?.('[data-workroom-tab]'); const agentTab = event.target.closest?.('[data-workroom-agent-tab]'); const action = event.target.closest?.('[data-workroom-action]');", "const file = event.target.closest?.('[data-workroom-file]'); const directory = event.target.closest?.('[data-workroom-directory]'); const tab = event.target.closest?.('[data-workroom-tab]'); const pane = event.target.closest?.('[data-workroom-pane]'); const agentTab = event.target.closest?.('[data-workroom-agent-tab]'); const action = event.target.closest?.('[data-workroom-action]');", 'workroom pane target')
s = replace_once(s, "        if (tab) { model.setTab(tab.dataset.workroomTab); repaint(); return; }\n        if (agentTab)", "        if (tab) { model.setTab(tab.dataset.workroomTab); repaint(); return; }\n        if (pane) { model.setCompactPane(pane.dataset.workroomPane); repaint(); return; }\n        if (agentTab)", 'workroom pane action')
p.write_text(s)

p = Path('ui-v3/styles/pages/workroom.css')
s = p.read_text()
addon = '\n.workroom-compact-panes{display:none}\n@media(max-width:720px){.workroom-tabs{height:auto;flex-wrap:wrap;padding-block:4px}.workroom-compact-panes{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;order:10;flex:1 0 100%;padding-top:4px;border-top:1px solid var(--border-faint)}.workroom-compact-panes button{min-height:32px;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--text-secondary);font-size:9px;font-weight:650}.workroom-compact-panes button[aria-pressed="true"]{border-color:var(--border-subtle);background:var(--surface-selected);color:var(--text-primary)}.workroom-grid>[data-panel][data-compact-active="false"]{display:none}.workroom-grid>[data-panel][data-compact-active="true"]{display:grid}.workroom-files[data-compact-active="true"],.workroom-agent[data-compact-active="true"]{border:0}}\n'
if '.workroom-compact-panes{display:none}' in s: raise SystemExit('workroom compact CSS already exists before Task 7 migration')
p.write_text(s + addon)

p = Path('ui-v3/views/browser/browser-inspector.mjs')
s = p.read_text()
s = replace_once(s, "const text = (value, language) => escapeHtml(String(value ?? '').slice(0, 160));", "const text = (value, language) => escapeHtml(String(value ?? '').slice(0, 160));\nconst originOf = (tabs = []) => { const value = tabs?.[0]?.url; if (!value || value === 'about:blank') return null; try { const parsed = new URL(value); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.origin : null; } catch { return null; } };", 'browser origin helper')
s = replace_once(s, 'return `<aside class="browser-inspector" aria-label="${escapeHtml(t.inspector)}"><header>', 'return `<aside class="browser-inspector" data-browser-trust-boundary aria-label="${escapeHtml(t.inspector)}"><header>', 'browser trust marker')
s = replace_once(s, '<div><dt>${escapeHtml(t.runtime)}</dt><dd>${text(runtimeState, language)}</dd></div><div><dt>${escapeHtml(t.driver)}</dt>', '<div><dt>${escapeHtml(t.runtime)}</dt><dd>${text(runtimeState, language)}</dd></div><div><dt>Origin</dt><dd>${text(originOf(snapshot.tabs) ?? t.none, language)}</dd></div><div><dt>${language === \'vi\' ? \'Phiên\' : \'Session\'}</dt><dd>${escapeHtml(snapshot.sessionOpen ? (language === \'vi\' ? \'Đang hoạt động\' : \'Active\') : (language === \'vi\' ? \'Không có phiên hoạt động\' : \'No active session\'))}</dd></div><div><dt>${escapeHtml(t.driver)}</dt>', 'browser origin session facts')
p.write_text(s)

p = Path('ui-v3/views/browser/browser-view.mjs')
s = p.read_text()
s = replace_once(s, 'export function renderBrowserWorkspace(snapshot = {}) {', "const EXTERNAL_CONTENT_COPY = Object.freeze({ en: Object.freeze({ title: 'External page content', note: 'Page-derived artifacts remain untrusted input; Nolane actions stay constrained by the permission boundary.' }), vi: Object.freeze({ title: 'Nội dung trang bên ngoài', note: 'Artifact lấy từ trang vẫn là dữ liệu không đáng tin; hành động của Nolane luôn bị giới hạn bởi ranh giới quyền.' }) });\n\nexport function renderBrowserWorkspace(snapshot = {}) {", 'browser external content copy')
s = replace_once(s, '  const error = snapshot.errors?.[0]?.message;\n  return `<section class="browser-workspace"', '  const error = snapshot.errors?.[0]?.message;\n  const boundary = EXTERNAL_CONTENT_COPY[language];\n  return `<section class="browser-workspace"', 'browser boundary projection')
s = replace_once(s, '<div class="browser-workspace-grid"><main>${renderNavigation(snapshot, t)}${renderScreenshot(snapshot, t)}${renderPageMap(snapshot, t)}${renderTabs(snapshot, t)}${renderBrowserTimeline(snapshot)} </main>${renderBrowserInspector(snapshot)}</div>', '<div class="browser-workspace-grid"><main>${renderNavigation(snapshot, t)}<section class="browser-content-boundary" data-browser-external-content="bounded" aria-label="${escapeHtml(boundary.title)}"><header><strong>${escapeHtml(boundary.title)}</strong><span>${escapeHtml(boundary.note)}</span></header>${renderScreenshot(snapshot, t)}${renderPageMap(snapshot, t)}${renderTabs(snapshot, t)}</section>${renderBrowserTimeline(snapshot)} </main>${renderBrowserInspector(snapshot)}</div>', 'browser external content boundary')
p.write_text(s)

p = Path('ui-v3/styles/pages/browser.css')
s = p.read_text()
addon = '\n.browser-content-boundary{display:grid;gap:12px;padding:10px;border:1px solid var(--instrument-rule);border-left:2px solid var(--instrument-trace);border-radius:15px;background:color-mix(in srgb,var(--surface-canvas) 54%,transparent)}.browser-content-boundary>header{display:grid;gap:3px;padding:2px 4px 1px}.browser-content-boundary>header strong{color:var(--text-primary);font-size:9px;letter-spacing:.06em;text-transform:uppercase}.browser-content-boundary>header span{color:var(--text-secondary);font-size:9px;line-height:1.45}.browser-content-boundary>.browser-panel{box-shadow:none}.browser-inspector[data-browser-trust-boundary]{border-color:color-mix(in srgb,var(--instrument-trace) 38%,var(--border-subtle))}\n'
if '.browser-content-boundary{' in s: raise SystemExit('browser content-boundary CSS already exists before Task 7 migration')
p.write_text(s + addon)

print('Task 7 Studio/Browser migration applied')
