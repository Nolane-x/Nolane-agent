from pathlib import Path
import subprocess

EXPECTED = {
    'ui-v3/app.mjs': '7a4cc63c5c1751f0560164c831b3068d1d5ef7c8',
    'ui-v3/views/skills/skills-view.mjs': 'ea307059c9552e1337df63e7e0810b6775ee3748',
    'ui-v3/styles/pages/skills.css': 'f2ecd1d96fa88cfa53c289b334dda259633d3892',
    'ui-v3/control-plane/live-domain-workspace.mjs': 'a23a244fbb11a826e3a08877c3d4da4643c52de8',
}

def blob(path):
    return subprocess.check_output(['git', 'hash-object', path], text=True).strip()

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new)

for path, expected in EXPECTED.items():
    actual = blob(path)
    print(f'guard {path}: {actual}')
    if actual != expected:
        raise SystemExit(f'{path}: unexpected blob {actual}; expected {expected}')

# Skills: preserve only backend-declared capability facets; never infer readiness.
p = Path('ui-v3/views/skills/skills-view.mjs')
s = p.read_text()
anchor = "const SKILL_RENDER_BATCH = 48;\n"
addition = """const SKILL_RENDER_BATCH = 48;
const CAPABILITY_STATE_LABELS = Object.freeze({
  en: Object.freeze({ installed:'Installed', 'not-installed':'Not installed', enabled:'Enabled', disabled:'Disabled', configured:'Configured', 'not-configured':'Not configured', ready:'Ready', 'not-ready':'Not ready', blocked:'Blocked' }),
  vi: Object.freeze({ installed:'Đã cài', 'not-installed':'Chưa cài', enabled:'Đã bật', disabled:'Đã tắt', configured:'Đã cấu hình', 'not-configured':'Chưa cấu hình', ready:'Sẵn sàng', 'not-ready':'Chưa sẵn sàng', blocked:'Bị chặn' }),
});
function declaredCapabilityStates(item = {}) {
  const states = [];
  const facet = (key, yes, no) => { if (typeof item?.[key] !== 'boolean') return; states.push(item[key] ? yes : no); };
  facet('installed', 'installed', 'not-installed');
  facet('enabled', 'enabled', 'disabled');
  facet('configured', 'configured', 'not-configured');
  facet('ready', 'ready', 'not-ready');
  if (item?.blocked === true) states.push('blocked');
  return Object.freeze([...new Set(states)]);
}
function capabilityStateLabel(state, language = 'en') { return (CAPABILITY_STATE_LABELS[language === 'vi' ? 'vi' : 'en'] ?? CAPABILITY_STATE_LABELS.en)[state] ?? state; }
"""
s = replace_once(s, anchor, addition, 'Skills capability helpers')
s = replace_once(s, "    contentSha256: String(item?.contentSha256 ?? ''),\n", "    contentSha256: String(item?.contentSha256 ?? ''),\n    capabilityStates: declaredCapabilityStates(item),\n", 'Skills normalized capability state')
s = replace_once(s, "    return [skill.title, skill.id, skill.source, skill.maturity, skill.description].join(' ').toLowerCase().includes(query);\n", "    return [skill.title, skill.id, skill.source, skill.maturity, skill.description, ...(skill.capabilityStates ?? [])].join(' ').toLowerCase().includes(query);\n", 'Skills state search')
old_render = "function renderSkillItem(skill, selected, text) {\n  const meta = [sourceLabel(skill, text), skill.provenanceStatus || skill.maturity].filter(Boolean).join(' · ');\n  return `<button type=\"button\" class=\"skill-library-item\" data-skill-library-select=\"${esc(skill.id)}\" aria-pressed=\"${selected}\" aria-label=\"${esc(`${text.inspect}: ${skill.title}`)}\"><span class=\"skill-library-item__icon\">${icon('spark',{size:17})}</span><span class=\"skill-library-item__body\"><strong>${esc(skill.title)}</strong>${skill.description ? `<small>${esc(skill.description)}</small>` : ''}${meta ? `<em>${esc(meta)}</em>` : ''}</span><span class=\"skill-library-item__arrow\" aria-hidden=\"true\">→</span></button>`;\n}\n"
new_render = "function renderSkillItem(skill, selected, text, language = 'en') {\n  const meta = [sourceLabel(skill, text), skill.provenanceStatus || skill.maturity].filter(Boolean).join(' · ');\n  const states = (skill.capabilityStates ?? []).map((state) => `<span data-skill-capability-state=\"${esc(state)}\">${esc(capabilityStateLabel(state, language))}</span>`).join('');\n  return `<button type=\"button\" class=\"skill-library-item\" data-skill-library-select=\"${esc(skill.id)}\" aria-pressed=\"${selected}\" aria-label=\"${esc(`${text.inspect}: ${skill.title}`)}\"><span class=\"skill-library-item__icon\">${icon('spark',{size:17})}</span><span class=\"skill-library-item__body\"><strong>${esc(skill.title)}</strong>${skill.description ? `<small>${esc(skill.description)}</small>` : ''}${states ? `<span class=\"skill-library-item__states\">${states}</span>` : ''}${meta ? `<em>${esc(meta)}</em>` : ''}</span><span class=\"skill-library-item__arrow\" aria-hidden=\"true\">→</span></button>`;\n}\n"
s = replace_once(s, old_render, new_render, 'Skills item capability rendering')
s = replace_once(s, "${skills.map((skill) => `<div role=\"listitem\">${renderSkillItem(skill, String(selectedId === skill.id), text)}</div>`).join('')}", "${skills.map((skill) => `<div role=\"listitem\">${renderSkillItem(skill, String(selectedId === skill.id), text, state.language)}</div>`).join('')}", 'Skills render language')
p.write_text(s)

p = Path('ui-v3/styles/pages/skills.css')
s = p.read_text()
if '.skill-library-item__states{' in s:
    raise SystemExit('Skills capability state CSS already exists')
s += "\n.skill-library-item__states{display:flex;flex-wrap:wrap;gap:4px;margin-top:2px}.skill-library-item__states>[data-skill-capability-state]{display:inline-flex;align-items:center;min-height:18px;padding:1px 6px;border:1px solid var(--border-subtle);border-radius:999px;background:color-mix(in srgb,var(--surface-panel) 64%,transparent);color:var(--text-secondary);font:600 8px/1.2 var(--font-sans);letter-spacing:.02em}.skill-library-item__states>[data-skill-capability-state=\"ready\"],.skill-library-item__states>[data-skill-capability-state=\"enabled\"]{border-color:color-mix(in srgb,var(--state-success) 32%,var(--border-subtle));color:var(--state-success)}.skill-library-item__states>[data-skill-capability-state=\"blocked\"]{border-color:color-mix(in srgb,var(--state-error) 36%,var(--border-subtle));color:var(--state-error)}.skill-library-item__states>[data-skill-capability-state=\"not-ready\"],.skill-library-item__states>[data-skill-capability-state=\"disabled\"],.skill-library-item__states>[data-skill-capability-state=\"not-configured\"]{border-color:color-mix(in srgb,var(--state-warning) 34%,var(--border-subtle));color:var(--text-primary)}\n"
p.write_text(s)

# Settings: preserve search focus/caret through its custom debounced rerender path.
p = Path('ui-v3/app.mjs')
s = p.read_text()
old = "const rerender=({preserveFocus=null,forcePreferencePaths=[]}={})=>{if(!mountedRoot)return;const viewState=captureViewState(mountedRoot);const focusPath=preserveFocus??document.activeElement?.dataset?.settingPath??null;applySettingsPreview({forcePreferencePaths});mountedRoot.innerHTML=renderSettingsView(controller.snapshot());restoreViewState(mountedRoot,viewState);if(focusPath)mountedRoot.querySelector(`[data-setting-path=\"${CSS.escape(focusPath)}\"]`)?.focus({preventScroll:true});const pill=document.querySelector('[data-command=\"toggle-experience\"]');if(pill)pill.querySelector('span:nth-child(2)').textContent=normalizeExperience(cachedPreferences.experience).replace(/^./,x=>x.toUpperCase());};"
new = "const rerender=({preserveFocus=null,forcePreferencePaths=[]}={})=>{if(!mountedRoot)return;const viewState=captureViewState(mountedRoot);const activeSearch=document.activeElement?.matches?.('[data-settings-search]')?document.activeElement:null;const settingsSearchState=activeSearch?{value:activeSearch.value,selection:activeSearch.selectionStart==null?null:[activeSearch.selectionStart,activeSearch.selectionEnd]}:null;const focusPath=preserveFocus??document.activeElement?.dataset?.settingPath??null;applySettingsPreview({forcePreferencePaths});mountedRoot.innerHTML=renderSettingsView(controller.snapshot());restoreViewState(mountedRoot,viewState);if(settingsSearchState){const next=mountedRoot.querySelector('[data-settings-search]');if(next){next.value=settingsSearchState.value;next.focus({preventScroll:true});if(settingsSearchState.selection)next.setSelectionRange?.(...settingsSearchState.selection);}}else if(focusPath)mountedRoot.querySelector(`[data-setting-path=\"${CSS.escape(focusPath)}\"]`)?.focus({preventScroll:true});const pill=document.querySelector('[data-command=\"toggle-experience\"]');if(pill)pill.querySelector('span:nth-child(2)').textContent=normalizeExperience(cachedPreferences.experience).replace(/^./,x=>x.toUpperCase());};"
s = replace_once(s, old, new, 'Settings search focus preservation')
s = replace_once(s, "if(event.target.matches?.('[data-settings-search]')){clearTimeout(inputTimer);inputTimer=setTimeout(()=>{controller.search(event.target.value);rerender();},80);return;}", "if(event.target.matches?.('[data-settings-search]')){const value=event.target.value;clearTimeout(inputTimer);inputTimer=setTimeout(()=>{controller.search(value);rerender();},80);return;}", 'Settings debounced query capture')
p.write_text(s)

# Control Plane: HTTP success is not health. Count only semantically ready records.
p = Path('ui-v3/control-plane/live-domain-workspace.mjs')
s = p.read_text()
s = replace_once(s, "  const paths=records.filter(item=>item.path.startsWith('/')).map(item=>item.path); const routes=atlasFor(paths); const failures=records.filter(item=>item.status==='error');\n  return Object.freeze({domain,...meta,language:languageKey(language),projectId,missionId,status:failures.length?'degraded':'ready',", "  const paths=records.filter(item=>item.path.startsWith('/')).map(item=>item.path); const routes=atlasFor(paths); const activeRecords=records.filter(item=>item.status!=='unavailable'); const hardFailures=activeRecords.filter(item=>statusClass(item.status)==='error'); const warnings=activeRecords.filter(item=>statusClass(item.status)==='warning'); const workspaceStatus=hardFailures.length?'degraded':warnings.length?'attention':'ready';\n  return Object.freeze({domain,...meta,language:languageKey(language),projectId,missionId,status:workspaceStatus,", 'Control Plane aggregate truth')
s = replace_once(s, "function statusClass(value){ const normalized=String(value??'unknown').toLowerCase(); return ['ready','active','pass','trusted','healthy','connected'].some(item=>normalized.includes(item))?'ready':['error','failed','blocked','denied'].some(item=>normalized.includes(item))?'error':['unavailable','unknown','empty','suspended'].some(item=>normalized.includes(item))?'muted':'warning'; }", "function statusClass(value){ const normalized=String(value??'unknown').toLowerCase(); return ['unavailable','unknown','empty','suspended'].some(item=>normalized.includes(item))?'muted':['error','failed','blocked','denied','offline','unhealthy','not-ready','not_ready','unready'].some(item=>normalized.includes(item))?'error':['ready','active','pass','trusted','healthy','connected','online'].some(item=>normalized.includes(item))?'ready':'warning'; }", 'Control Plane status classification')
s = replace_once(s, "function metricCards(workspace){ const t=copy(workspace.language); const ready=workspace.records.filter(item=>item.status!=='error'&&item.status!=='unavailable').length;", "function metricCards(workspace){ const t=copy(workspace.language); const ready=workspace.records.filter(item=>statusClass(item.status)==='ready').length;", 'Control Plane online KPI truth')
s = replace_once(s, "<input type=\"search\" data-skill-catalog-search value=\"${escapeHtml(record.query??'')}\"", "<input type=\"search\" data-skill-catalog-search data-preserve-key=\"control-plane-skill-search\" value=\"${escapeHtml(record.query??'')}\"", 'Control Plane skill search focus token')
p.write_text(s)

print('Task 8 Skills/Settings/Control Plane migration applied')
