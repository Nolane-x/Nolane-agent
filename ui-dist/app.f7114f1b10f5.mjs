import { createRouter } from './core/router.0d28b972cbbb.mjs';
import { createUiStore } from './core/ui-store.3d7e35c4df6b.mjs';
import { createUiBus } from './core/ui-bus.1d2dfc61f691.mjs';
import { createApiClient } from './core/api-client.bf483f0926af.mjs';
import { createLayoutStore } from './core/layout-store.e93fce6cf224.mjs';
import { createResizableRegionController } from './core/resizable-region.eba2da3f5d55.mjs';
import { applyPreferences, readCachedPreferences } from './core/preference-runtime.c67621f50928.mjs';
import { createLanguageSyncController } from './core/language-sync-controller.eef0bc41128e.mjs';
import { normalizeExperience } from './core/experience-policy.dada10c0ce75.mjs';
import { createExperienceTransitionController } from './core/experience-transition-controller.00a3ed488872.mjs';
import { createViewStateBridge } from './core/view-state-bridge.8543828bf395.mjs';
import { captureViewState, restoreViewState } from './core/view-state-preserver.12cda2395c94.mjs';
import { createSessionRestoreController } from './core/session-restore-controller.cecb3a9a8a6b.mjs';
import { createUpdateStateController } from './core/update-state-controller.6adec3fd5ef9.mjs';
import { routeFromHash, scrubBootstrapToken } from './core/route-auth.a33260ee2952.mjs';
import { settingsSectionFromRoute } from './core/settings-route.c656fbd8f99e.mjs';
import { localizeRouteTitle, renderAppShell } from './shell/app-shell.89c8817557d1.mjs';
import { renderUpdateNotice } from './components/update-notice/update-notice.4ea4ff6af3e8.mjs';
import { closeOptionPickers, handleOptionPickerKeydown, selectOptionPicker, toggleOptionPicker } from './components/option-picker.6e3add8d2c82.mjs';
import { createSessionSidebarModel } from './shell/session-sidebar.953b88f8be24.mjs';
import { projectNameFromPath } from './shell/project-picker.82abccfb00a7.mjs';
import { openProjectCreateDialog } from './components/project-create-dialog.67a70a97ccfa.mjs';
import { createOutputSummaryController, renderOutputSummary } from './views/summary/output-summary.62938c5fa72b.mjs';
import { BACKEND_ATLAS } from './generated/backend-atlas.d4557fd3c9e1.mjs';

document.addEventListener('click', (event) => {
  const toggle = event.target.closest?.('[data-option-picker-toggle]');
  if (toggle) { toggleOptionPicker(document, toggle); return; }
  const option = event.target.closest?.('[data-option-picker-option]');
  if (option) {
    const selection = selectOptionPicker(document, option);
    if (!selection) return;
    const valueInput = option.closest('[data-option-picker]')?.querySelector('[data-option-picker-value]');
    valueInput?.dispatchEvent(new Event('input', { bubbles: true }));
    valueInput?.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  if (!event.target.closest?.('[data-option-picker]')) closeOptionPickers(document);
});
document.addEventListener('keydown', (event) => { handleOptionPickerKeydown(document, event); });

const store = createUiStore({ route: '/', ready: false });
const bus = createUiBus();
const router = createRouter({ initialPath: '/' });
const api = createApiClient();
const layoutStore = createLayoutStore();
const viewStateBridge = createViewStateBridge();
const experienceTransition = createExperienceTransitionController({ api, viewStateBridge });
const sessionRestore = createSessionRestoreController({ api });
const updateStateController = createUpdateStateController({ onChange: (state) => renderUpdateNoticeRoot(state), beforeInstall: () => persistCurrentSession({ immediate: true }) });
const sessionModel = createSessionSidebarModel();
let cachedPreferences = readCachedPreferences();
let activeViewCleanup = null;
let resizer = null;
let currentRouteState = null;
let shellSnapshot = sessionModel.snapshot();
let shellProjects = [];
let shellDataLoadedAt = 0;
let onboardingRequired = false;
let currentExperience = normalizeExperience(cachedPreferences.experience);
let activeProjectId = null;

function renderUpdateNoticeRoot(state = updateStateController.snapshot()) {
  const root = document.querySelector('#update-notice-root');
  if (!root) return;
  root.innerHTML = renderUpdateNotice(state, { experience: currentExperience, language: cachedPreferences.language });
}

function composerDraft(root = document) {
  const form = root?.querySelector?.('#mission-composer');
  const objective = form?.querySelector?.('#objective');
  if (!form || !objective) return null;
  return {
    objective: objective.value,
    selection: [objective.selectionStart ?? objective.value.length, objective.selectionEnd ?? objective.value.length],
    projectId: form.elements.projectId?.value || null,
    intent: form.elements.intent?.value || 'ask',
    modelChoice: form.elements.modelChoice?.value || 'auto',
    planningEffort: form.elements.planningEffort?.value || null,
    skillIds: [...form.querySelectorAll('[data-selected-skill-id]')].map((item) => item.dataset.selectedSkillId).filter(Boolean),
    attachmentRefs: []
  };
}

function persistCurrentSession({ immediate = false } = {}) {
  const patch = {
    activeRoute: currentRouteState?.path ?? routeFromHash(),
    experienceLevel: currentExperience,
    view: {
      summaryOpen: summaryRoot()?.dataset?.open === 'true',
      workspaceScrollTop: document.querySelector('#workspace')?.scrollTop ?? 0,
      sidebarScrollTop: document.querySelector('#session-groups')?.scrollTop ?? 0
    }
  };
  const draft = composerDraft();
  if (immediate) return sessionRestore.flush({ restorePatch: patch, drafts: draft ? [{ scope: 'home', draft }] : [] });
  sessionRestore.scheduleRestore(patch);
  if (draft) sessionRestore.scheduleDraft('home', draft);
  return null;
}

function summaryRoot() { return document.querySelector('#output-summary-root'); }
function renderSummary(snapshot = summaryController.snapshot()) { const root = summaryRoot(); if (!root) return; const open=Boolean(snapshot.open); root.innerHTML = renderOutputSummary({ ...snapshot, language: cachedPreferences.language }); root.dataset.open = String(open); const handle=document.querySelector('#output-summary-resizer'); if(handle) handle.hidden=!open; }
const summaryController = createOutputSummaryController({ api, getProjectId: () => activeProjectId, onChange: renderSummary });
const simpleRoute = (title, text) => async () => ({ render: () => `<section class="route-view"><p class="eyebrow">Nolane Agent</p><h1>${title}</h1><p>${text}</p></section>` });

function cachedPreferenceDocument(experience = cachedPreferences.experience) {
  return {
    appearance: { theme: cachedPreferences.theme, accent: cachedPreferences.accent, density: cachedPreferences.density, motion: cachedPreferences.motion, zoom: cachedPreferences.zoom, codeFontSize: cachedPreferences.codeFontSize },
    accessibility: { highContrast: cachedPreferences.highContrast, alwaysShowFocus: cachedPreferences.alwaysShowFocus, keyboardResizeStep: cachedPreferences.keyboardResizeStep },
    general: { language: cachedPreferences.language },
    experience: { level: experience }
  };
}

function setExperienceMenu(open, { focusSelected = false } = {}) {
  const menu = document.querySelector('[data-experience-menu]');
  const button = document.querySelector('[data-command="toggle-experience"]');
  if (!menu || !button) return;
  menu.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
  if (open && focusSelected) requestAnimationFrame(() => menu.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true }));
}

function focusExperienceTrigger() {
  requestAnimationFrame(() => document.querySelector('[data-command=\"toggle-experience\"]')?.focus({ preventScroll: true }));
}

function announceExperience(message, state = 'ready') {
  const status = document.querySelector('[data-experience-transition-status]');
  if (!status) return;
  status.textContent = String(message ?? '');
  status.dataset.state = state;
  status.hidden = false;
  clearTimeout(announceExperience.timer);
  announceExperience.timer = setTimeout(() => { status.hidden = true; }, state === 'error' ? 6500 : 2800);
}

async function selectExperience(level) {
  const target = normalizeExperience(level);
  const current = currentExperience;
  const restoreSwitcherFocus = Boolean(document.activeElement?.closest?.('[data-experience-switcher]'));
  setExperienceMenu(false);
  if (target === current) { if (restoreSwitcherFocus) focusExperienceTrigger(); return; }
  const button = document.querySelector('[data-command="toggle-experience"]');
  if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
  const result = await experienceTransition.transition({ fromExperience: current, toExperience: target, currentPath: currentRouteState?.path ?? '/' });
  if (!result.ok) {
    if (button) { button.disabled = false; button.setAttribute('aria-busy', 'false'); }
    if (restoreSwitcherFocus) focusExperienceTrigger();
    announceExperience(cachedPreferences.language === 'vi' ? `Không thể lưu tầng giao diện: ${result.error}` : `Could not save experience level: ${result.error}`, 'error');
    return;
  }
  cachedPreferences = applyPreferences(result.preferences ?? cachedPreferenceDocument(target));
  await render(result.path);
  viewStateBridge.restore(document, { experience: target });
  if (restoreSwitcherFocus) focusExperienceTrigger();
  announceExperience(cachedPreferences.language === 'vi' ? `Đã chuyển sang ${target}. Quyền agent không thay đổi.` : `Switched to ${target}. Agent permissions were not changed.`);
}

function syncProjectSelection(projectId) {
  const id = String(projectId ?? '');
  const project = shellProjects.find((item) => String(item.id) === id);
  document.querySelectorAll('[data-project-picker]').forEach((picker) => {
    picker.dataset.selectedProjectId = id;
    const value = picker.querySelector('[data-project-value]');
    if (value) value.value = id;
    const label = picker.querySelector('.project-picker__trigger-label');
    if (label) label.textContent = project?.name ?? (cachedPreferences.language === 'vi' ? 'Không có dự án khả dụng' : 'No project available');
    picker.querySelectorAll('[data-project-choice]').forEach((choice) => choice.setAttribute('aria-selected', String(String(choice.dataset.projectId) === id)));
  });
  document.querySelectorAll('.session-project-row').forEach((row) => row.setAttribute('aria-current', String(String(row.dataset.projectId) === id)));
}

function projectRootName(root) { return projectNameFromPath(root); }

async function requestProjectCreation() {
  const selectDirectory = globalThis.nolaneDesktop?.selectDirectory;
  try {
    const workspaceRoot = typeof selectDirectory === 'function'
      ? await selectDirectory()
      : await openProjectCreateDialog({ language: cachedPreferences.language });
    if (!workspaceRoot) return null;
    const project = await api.post('/api/projects', { name: projectRootName(workspaceRoot), workspaceRoot });
    activeProjectId = String(project?.id ?? '');
    await refreshShellData({ force: true });
    await render(currentRouteState?.path ?? '/');
    announceExperience(cachedPreferences.language === 'vi' ? `Đã thêm dự án ${project?.name ?? projectRootName(workspaceRoot)}.` : `Added project ${project?.name ?? projectRootName(workspaceRoot)}.`);
    return project;
  } catch (error) {
    announceExperience(cachedPreferences.language === 'vi' ? `Không thể thêm dự án: ${error?.message ?? error}` : `Could not add project: ${error?.message ?? error}`, 'error');
    return null;
  }
}

async function reconcileEffectivePreferences() {
  try {
    const effective = await api.get('/api/settings/effective');
    cachedPreferences = applyPreferences(effective?.value ?? cachedPreferenceDocument());
  } catch {
    cachedPreferences = applyPreferences(cachedPreferenceDocument());
  }
  return cachedPreferences;
}

const languageSync = createLanguageSyncController({
  preferenceDocument: () => cachedPreferenceDocument(),
  apply: (value) => (cachedPreferences = applyPreferences(value)),
  rerender: (path) => render(path),
  reconcile: () => reconcileEffectivePreferences(),
  invalidate: (options) => router.invalidate(options),
  captureViewState: () => captureViewState(document),
  restoreViewState: (snapshot) => restoreViewState(document, snapshot),
});

function routeForExperience(level = cachedPreferences.experience) {
  const experience = normalizeExperience(level);
  if (experience === 'expert') return '/control-plane/overview';
  if (experience === 'studio') return '/workroom';
  if (experience === 'workspace') return '/missions';
  return '/';
}

async function refreshShellData({ force = false } = {}) {
  const now = Date.now(); if (!force && now - shellDataLoadedAt < 5000) return shellSnapshot;
  shellDataLoadedAt = now;
  const [missions, kernel, projects] = await Promise.all([
    api.get('/api/missions').catch(() => []), api.get('/api/sovereign-kernel/snapshot').catch(() => ({})), api.get('/api/projects').catch(() => []),
  ]);
  const runs = Array.isArray(missions) ? missions : missions?.missions ?? [];
  const approvals = Array.isArray(kernel?.approvals) ? kernel.approvals : [];
  shellProjects = Array.isArray(projects) ? projects : projects?.projects ?? [];
  sessionModel.update({ runs, approvals }); shellSnapshot = sessionModel.snapshot(); return shellSnapshot;
}

function rerenderView(root, view, { preserve = null } = {}) {
  const viewState = captureViewState(root);
  const active = preserve ?? document.activeElement;
  const token = active?.dataset?.preserveKey ?? active?.name ?? active?.id ?? null;
  const selection = active?.selectionStart == null ? null : [active.selectionStart, active.selectionEnd];
  const value = active?.value;
  root.innerHTML = view.render();
  restoreViewState(root, viewState);
  if (token) {
    const next = root.querySelector(`[data-preserve-key="${CSS.escape(token)}"], [name="${CSS.escape(token)}"], #${CSS.escape(token)}`);
    if (next) {
      if (value !== undefined) next.value = value;
      next.focus({ preventScroll: true });
      if (selection) next.setSelectionRange?.(...selection);
    }
  }
}

router.register({ id: 'home', pattern: /^\/(?:\?.*)?$/, title: 'Chat', load: async () => {
  // The build rewrites this local import to the immutable hashed home module.
  const { createHomeController, renderHomeView } = await import('./views/home/home-view.5667a2bd4250.mjs');
  const restoredDraft = sessionRestore.snapshot().drafts.home;
  const queryProjectId = new URLSearchParams((location.hash.split('?')[1] ?? '')).get('projectId');
  const querySkillId = new URLSearchParams((location.hash.split('?')[1] ?? '')).get('skill');
  const controller = createHomeController({ api, language: cachedPreferences.language }); await controller.load();
  const preferredProjectId = activeProjectId ?? queryProjectId ?? restoredDraft?.projectId ?? controller.snapshot().selectedProjectId;
  if (preferredProjectId) controller.setProject(preferredProjectId);
  activeProjectId = controller.snapshot().selectedProjectId || null;
  if (restoredDraft?.intent) controller.setIntent(restoredDraft.intent);
  if (restoredDraft?.modelChoice) controller.setModel(restoredDraft.modelChoice);
  if (restoredDraft?.planningEffort) controller.setEffort(restoredDraft.planningEffort);
  for (const skillId of [...(restoredDraft?.skillIds ?? []), querySkillId].filter(Boolean)) controller.addSkill(skillId);
  let root = null; let selectedMenuIndex = 0;
  const view = {
    experienceLevel: 'everyday',
    render: () => renderHomeView(controller.snapshot()),
    mount(node) {
      root = node;
      const restoredArea = root.querySelector('#objective');
      if (restoredArea && restoredDraft?.objective) {
        restoredArea.value = restoredDraft.objective;
        restoredArea.setSelectionRange?.(...(restoredDraft.selection ?? [restoredDraft.objective.length, restoredDraft.objective.length]));
      }
      const saveDraft = () => { const draft = composerDraft(root); if (draft) sessionRestore.scheduleDraft('home', draft); };
      const render = ({ textareaValue = null, focus = false, projectSearchValue = null, focusProjectSearch = false } = {}) => { const before = textareaValue ?? root.querySelector('#objective')?.value ?? ''; root.innerHTML = view.render(); const area=root.querySelector('#objective'); if(area){area.value=before;if(focus)area.focus({preventScroll:true});} const search=root.querySelector('[data-project-search]'); if(search && projectSearchValue !== null){search.value=projectSearchValue;if(focusProjectSearch)search.focus({preventScroll:true});} };
      const closeComposerPickers = (focusName = null) => { root.querySelectorAll('[data-composer-picker-menu]').forEach((menu) => { menu.hidden = true; menu.closest('[data-composer-picker]')?.querySelector('[data-composer-picker-toggle]')?.setAttribute('aria-expanded', 'false'); }); if (focusName) root.querySelector(`[data-composer-picker="${CSS.escape(focusName)}"] [data-composer-picker-toggle]`)?.focus({ preventScroll: true }); };
      const filterComposerPickerOptions = (search) => { const query = String(search?.value ?? '').trim().toLocaleLowerCase(); search?.closest('[data-composer-picker]')?.querySelectorAll('[data-composer-picker-option]').forEach((option) => { const candidate = `${option.dataset.pickerLabel ?? ''} ${option.dataset.pickerValue ?? ''}`.toLocaleLowerCase(); option.hidden = Boolean(query && !candidate.includes(query)); }); };
      const openComposerPicker = (picker) => { const menu = picker?.querySelector('[data-composer-picker-menu]'); const trigger = picker?.querySelector('[data-composer-picker-toggle]'); if (!menu || !trigger) return; const open = menu.hidden; closeComposerPickers(); if (!open) return; menu.hidden = false; trigger.setAttribute('aria-expanded', 'true'); const search = menu.querySelector('[data-composer-picker-search]'); if (search) { search.value = ''; filterComposerPickerOptions(search); } requestAnimationFrame(() => (search ?? menu.querySelector('[aria-selected="true"]'))?.focus({ preventScroll: true })); };
      const chooseComposerOption = (option) => { const picker = option?.closest('[data-composer-picker]'); if (!picker) return; const name = picker.dataset.composerPicker; const value = option.dataset.pickerValue ?? ''; const text = root.querySelector('#objective')?.value ?? ''; if (name === 'intent') controller.setIntent(value); if (name === 'modelChoice') controller.setModel(value); if (name === 'planningEffort') controller.setEffort(value); closeComposerPickers(); render({ textareaValue: text, focus: true }); saveDraft(); };
      const onExternalProjectSelected = (event) => { if(event.detail?.source === 'home') return; const id=String(event.detail?.projectId ?? ''); const value=root.querySelector('#objective')?.value??''; controller.setProject(id); render({textareaValue:value,focus:true}); saveDraft(); };
      window.addEventListener('nolane:project-selected', onExternalProjectSelected);
      const openMenu = (type, query = '') => { selectedMenuIndex=0; controller.setMenu({type,query}); render({focus:true}); };
      const closeMenu = () => { const value=root.querySelector('#objective')?.value??'';controller.setMenu(null);render({textareaValue:value,focus:true}); };
      const chooseMenuItem = (button) => { const area=root.querySelector('#objective'); if(!area)return; const kind=button.dataset.menuKind; const id=button.dataset.menuId; const value=area.value; const match=value.match(/(^|\s)([@/][^\s]*)$/); if(kind==='skill'){ const next=match?`${value.slice(0,match.index)}${match[1]}`:value; controller.addSkill(id); controller.setMenu(null); render({textareaValue:next,focus:true}); saveDraft(); return; } const token=kind==='command'?`/${id}`:`@${kind}:${id}`; area.value=match?`${value.slice(0,match.index)}${match[1]}${token} `:`${value}${value&& !value.endsWith(' ')?' ':''}${token} `; if(kind==='command'&&['ask','plan','build','verify'].includes(id))controller.setIntent(id); controller.setMenu(null); render({textareaValue:area.value,focus:true}); saveDraft(); };
      const click = async (event) => {
        const homeAction=event.target.closest('[data-home-action]')?.dataset.homeAction; if(homeAction==='retry'){const value=root.querySelector('#objective')?.value??'';await controller.load();render({textareaValue:value,focus:true});return;}
        const selectedSkillRemove=event.target.closest('[data-selected-skill-remove]'); if(selectedSkillRemove){const value=root.querySelector('#objective')?.value??'';controller.removeSkill(selectedSkillRemove.dataset.selectedSkillRemove);render({textareaValue:value,focus:true});saveDraft();return;}
        const pickerToggle=event.target.closest('[data-composer-picker-toggle]'); if(pickerToggle){event.stopPropagation();openComposerPicker(pickerToggle.closest('[data-composer-picker]'));return;}
        const pickerOption=event.target.closest('[data-composer-picker-option]'); if(pickerOption){event.stopPropagation();chooseComposerOption(pickerOption);return;}
        const projectPickerToggle=event.target.closest('[data-project-picker-toggle]'); if(projectPickerToggle){event.stopPropagation();const picker=projectPickerToggle.closest('[data-project-picker]');const menu=picker?.querySelector('[data-project-picker-menu]');if(menu){const open=menu.hidden;menu.hidden=!open;projectPickerToggle.setAttribute('aria-expanded',String(open));if(open)requestAnimationFrame(()=>menu.querySelector('[data-project-search]')?.focus({preventScroll:true}));}return;}
        const projectChoice=event.target.closest('[data-project-choice]'); if(projectChoice){event.stopPropagation();const id=projectChoice.dataset.projectId??'';const value=root.querySelector('#objective')?.value??'';controller.setProject(id);activeProjectId=id||null;render({textareaValue:value,focus:true});window.dispatchEvent(new CustomEvent('nolane:project-selected',{detail:{projectId:id,source:'home'}}));saveDraft();return;}
        const projectAction=event.target.closest('[data-project-action]'); if(projectAction){event.stopPropagation();if(projectAction.dataset.projectAction==='new'){window.dispatchEvent(new CustomEvent('nolane:project-create-requested'));}else{const value=root.querySelector('#objective')?.value??'';controller.setProject('');activeProjectId=null;render({textareaValue:value,focus:true});window.dispatchEvent(new CustomEvent('nolane:project-selected',{detail:{projectId:'',source:'home'}}));saveDraft();}return;}
        const quick=event.target.closest('[data-quick-intent]'); if(quick){controller.setIntent(quick.dataset.quickIntent);render({textareaValue:quick.dataset.quickText,focus:true});saveDraft();return;}
        const action=event.target.closest('[data-action]')?.dataset.action;
        if(action==='open-context'){openMenu('context');return;} if(action==='open-commands'){openMenu('command');return;}
        if(action==='attach'){const input=document.createElement('input');input.type='file';input.multiple=true;input.accept='text/*,.md,.json,.js,.mjs,.ts,.tsx,.py,.go,.rs,.java,.c,.cpp,.h,.css,.html,.yaml,.yml,.toml,.xml';input.addEventListener('change',async()=>{const area=root.querySelector('#objective');if(!area)return;for(const file of [...input.files].slice(0,8)){if(file.size>131072){area.value+=`\n@file:${file.name} [${Math.round(file.size/1024)} KB — content not inlined]`;continue;}const text=await file.text().catch(()=>null);area.value+=text==null?`\n@file:${file.name}`:`\n\n<attached-file name="${file.name}">\n${text}\n</attached-file>`;}area.focus();saveDraft();});input.click();return;}
        const item=event.target.closest('[data-menu-id]'); if(item){chooseMenuItem(item);return;}
      };
      const input = (event) => { if(event.target.matches?.('[data-composer-picker-search]')){filterComposerPickerOptions(event.target);return;} if(event.target.matches?.('[data-project-search]')){const value=event.target.value;controller.setProjectMenu(true);controller.setProjectQuery(value);render({textareaValue:root.querySelector('#objective')?.value??'',projectSearchValue:value,focusProjectSearch:true});return;} if(event.target.name==='projectId')controller.setProject(event.target.value); if(event.target.name==='modelChoice')controller.setModel(event.target.value); if(event.target.name==='planningEffort')controller.setEffort(event.target.value); if(event.target.name==='intent')controller.setIntent(event.target.value); if(event.target.id==='objective'){const match=event.target.value.match(/(^|\s)([@/])([^\s]*)$/);if(match){controller.setMenu({type:match[2]==='@'?'context':'command',query:match[3]});const value=event.target.value;render({textareaValue:value,focus:true});}else if(controller.snapshot().menu){controller.setMenu(null);const value=event.target.value;render({textareaValue:value,focus:true});}} saveDraft(); };
      const keydown=(event)=>{const picker=event.target.closest?.('[data-composer-picker]');if(picker){const menu=picker.querySelector('[data-composer-picker-menu]');const trigger=picker.querySelector('[data-composer-picker-toggle]');const search=picker.querySelector('[data-composer-picker-search]');const options=[...picker.querySelectorAll('[data-composer-picker-option]')].filter((option)=>!option.hidden&&!option.disabled);if(event.target===trigger&&(event.key==='ArrowDown'||event.key==='Enter'||event.key===' ')){event.preventDefault();openComposerPicker(picker);return;}if(menu&&!menu.hidden){if(event.key==='Escape'){event.preventDefault();closeComposerPickers(picker.dataset.composerPicker);return;}if(event.key==='Tab'){closeComposerPickers();return;}if(event.target===search&&event.key==='ArrowDown'&&options.length){event.preventDefault();options[0].focus({preventScroll:true});return;}if(event.target===search&&event.key==='ArrowUp'){event.preventDefault();trigger?.focus({preventScroll:true});return;}if(event.target.matches?.('[data-composer-picker-option]')&&event.key==='ArrowUp'&&options[0]===event.target&&search){event.preventDefault();search.focus({preventScroll:true});return;}const current=Math.max(0,options.indexOf(document.activeElement));if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)&&options.length){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?options.length-1:(current+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;options.forEach((item,index)=>item.setAttribute('aria-selected',String(index===next)));options[next].focus({preventScroll:true});return;}if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-composer-picker-option]')){event.preventDefault();chooseComposerOption(event.target);return;}}}
        const menu=root.querySelector('.composer-menu');if(!menu)return;if(event.key==='Escape'){event.preventDefault();closeMenu();return;}const items=[...menu.querySelectorAll('[data-menu-id]')];if(!items.length)return;if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();selectedMenuIndex=(selectedMenuIndex+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items.forEach((item,i)=>item.setAttribute('aria-selected',String(i===selectedMenuIndex)));items[selectedMenuIndex].scrollIntoView({block:'nearest'});}if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();chooseMenuItem(items[selectedMenuIndex]);}};
      const submit=async(event)=>{if(event.target.id!=='mission-composer')return;event.preventDefault();const data=new FormData(event.target);const objective=String(data.get('objective')??'');try{const mission=await controller.submit({objective,projectId:data.get('projectId'),intent:data.get('intent'),modelChoice:data.get('modelChoice'),planningEffort:data.get('planningEffort')});event.target.querySelector('#objective').value='';await sessionRestore.clearDraft('home');await refreshShellData({force:true});location.hash=`/missions?id=${encodeURIComponent(mission?.id??'current')}`;}catch{render({textareaValue:objective,focus:true});saveDraft();}};
      root.addEventListener('click',click);root.addEventListener('input',input);root.addEventListener('change',input);root.addEventListener('keydown',keydown);root.addEventListener('submit',submit);
      return()=>{saveDraft();window.removeEventListener('nolane:project-selected', onExternalProjectSelected);root.removeEventListener('click',click);root.removeEventListener('input',input);root.removeEventListener('change',input);root.removeEventListener('keydown',keydown);root.removeEventListener('submit',submit);root=null;};
    }, controller,
  }; return view;
} });

router.register({ id: 'missions', pattern: /^\/missions(?:\?.*)?$/, cache: 'path', title: 'Activity', load: async () => {
  const { createActivityController, renderActivityView } = await import('./views/activity/activity-view.c76249cbd3f2.mjs');
  const selectedMissionId=new URLSearchParams((location.hash.split('?')[1]??'')).get('id');const controller=createActivityController({api,language:cachedPreferences.language,selectedMissionId,experience:cachedPreferences.experience});await controller.load();let root=null;let timer=null;const view={experienceLevel:'workspace',render:()=>renderActivityView(controller.snapshot()),mount(node){root=node;const repaint=(preserve=null)=>rerenderView(root,view,{preserve});const click=async(e)=>{const f=e.target.closest('[data-activity-filter]');if(f){controller.setFilter(f.dataset.activityFilter);repaint(f);return;}const mission=e.target.closest('[data-activity-mission]');if(mission){await controller.selectMission(mission.dataset.activityMission);repaint(mission);return;}const tt=e.target.closest('[data-time-travel-action]');if(!tt)return;const action=tt.dataset.timeTravelAction;const checkpointId=tt.dataset.timeTravelCheckpoint;tt.disabled=true;try{if(action==='create')await controller.createCheckpoint();else if(action==='select')await controller.selectCheckpoint(checkpointId);else if(action==='compare')await controller.compareCheckpoint(checkpointId);else if(action==='branch')await controller.createBranch(checkpointId);else if(action==='replay')await controller.replayMission(checkpointId);else if(action==='restore'){const file=tt.dataset.timeTravelPath;const approved=confirm(cachedPreferences.language==='vi'?`Khôi phục ${file} từ checkpoint? Trạng thái hiện tại sẽ được backup và ghi receipt mới.`:`Restore ${file} from the checkpoint? The current state will be backed up and a new receipt recorded.`);if(approved)await controller.restoreFile(checkpointId,file,{confirmOverwrite:true});}repaint(tt);}catch(error){alert(String(error?.message??error));repaint(tt);}};const change=(e)=>{if(e.target.matches('[data-activity-follow]')){controller.setFollow(e.target.checked);repaint(e.target);}};timer=setInterval(async()=>{if(controller.snapshot().follow){const preserve=root?.contains(document.activeElement)?document.activeElement:null;await controller.refresh();repaint(preserve);}},5000);root.addEventListener('click',click);root.addEventListener('change',change);return()=>{clearInterval(timer);root.removeEventListener('click',click);root.removeEventListener('change',change);root=null;}}};return view;
} });

router.register({ id: 'projects', pattern: /^\/projects(?:\?.*)?$/, title: 'Projects', load: async () => {
  const { createProjectsController, renderProjectsView } = await import('./views/projects/project-view.cb6088e1331b.mjs');const controller=createProjectsController({api,language:cachedPreferences.language});await controller.load();let root=null;const focusSearch=()=>requestAnimationFrame(()=>root?.querySelector('[data-project-search]')?.focus({preventScroll:true}));const view={render:()=>renderProjectsView(controller.snapshot()),mount(node){root=node;const input=e=>{if(e.target.matches('[data-project-search]')){controller.setQuery(e.target.value);rerenderView(root,view,{preserve:e.target});}};const click=async e=>{const mode=e.target.closest('[data-project-view]');if(mode){controller.setView(mode.dataset.projectView);rerenderView(root,view,{preserve:mode});return;}const action=e.target.closest('[data-project-action]')?.dataset.projectAction;if(action==='add'){window.dispatchEvent(new CustomEvent('nolane:project-create-requested',{detail:{source:'projects-view'}}));return;}if(action==='clear-search'){controller.setQuery('');rerenderView(root,view);focusSearch();return;}if(action==='retry'){await controller.load();rerenderView(root,view);focusSearch();}};root.addEventListener('input',input);root.addEventListener('click',click);return()=>{root.removeEventListener('input',input);root.removeEventListener('click',click)}}};return view;
} });

router.register({ id: 'skills', pattern: /^\/skills(?:\?.*)?$/, title: 'Skills', load: async () => {
  const { createSkillsLibraryController, renderSkillsLibrary } = await import('./views/skills/skills-view.6ad3aac5d952.mjs');
  const controller = createSkillsLibraryController({ api, language: cachedPreferences.language });
  await controller.load();
  let root = null;
  const view = {
    experienceLevel: 'workspace',
    render: () => renderSkillsLibrary(controller.snapshot()),
    mount(node) {
      root = node;
      const repaint = () => { if (root) root.innerHTML = view.render(); };
      const input = (event) => {
        if (!event.target.matches('[data-skills-search]')) return;
        controller.setQuery(event.target.value);
        repaint();
        root?.querySelector('[data-skills-search]')?.focus({ preventScroll: true });
      };
      const change = (event) => {
        if (!event.target.matches('[data-skills-catalog]')) return;
        controller.setCatalog(event.target.value);
        repaint();
      };
      const click = async (event) => {
        const install = event.target.closest('[data-action="install-skill"]');
        if (install) {
          install.disabled = true;
          await controller.installSelectedSkill();
          repaint();
          return;
        }
        const showMore = event.target.closest('[data-skills-show-more]');
        if (showMore) {
          controller.showMore();
          repaint();
          root?.querySelector('[data-skills-show-more]')?.focus({ preventScroll: true });
          return;
        }
        const selected = event.target.closest('[data-skill-library-select]');
        if (!selected) return;
        selected.disabled = true;
        await controller.selectSkill(selected.dataset.skillLibrarySelect);
        repaint();
        root?.querySelector(`[data-skill-library-select="${CSS.escape(selected.dataset.skillLibrarySelect)}"]`)?.focus({ preventScroll: true });
      };
      root.addEventListener('input', input);
      root.addEventListener('change', change);
      root.addEventListener('click', click);
      return () => {
        root.removeEventListener('input', input);
        root.removeEventListener('change', change);
        root.removeEventListener('click', click);
        root = null;
      };
    },
  };
  return view;
} });

router.register({ id: 'review-mission', pattern: /^\/review\/.+$/, cache: 'path', title: 'Review & Ship', load: async () => {
  const { createReviewController, renderReviewView } = await import('./views/review/review-view.ae06a6ae8937.mjs');
  const missionId=routeFromHash().split('?')[0].split('/').at(-1)||'current';const controller=createReviewController({api,missionId,language:cachedPreferences.language});await controller.load();let root=null;const view={experienceLevel:'workspace',render:()=>renderReviewView(controller.snapshot(),{language:cachedPreferences.language}),mount(node){root=node;const repaint=(preserve=null)=>rerenderView(root,view,{preserve});const click=async(event)=>{const retry=event.target.closest('[data-review-action="retry"]');if(retry){retry.disabled=true;await controller.load();repaint();return;}const button=event.target.closest('[data-review-decision]');if(!button)return;const hunk=button.closest('[data-review-hunk]');const reason=hunk?.querySelector('[data-review-reason]');const value=String(reason?.value??'').trim();if(!value){reason?.setAttribute('aria-invalid','true');reason?.focus({preventScroll:true});return;}reason?.removeAttribute('aria-invalid');button.disabled=true;await controller.decide({taskId:button.dataset.taskId,hunkId:button.dataset.hunkId,decision:button.dataset.reviewDecision,reason:value});repaint();};root.addEventListener('click',click);return()=>{root.removeEventListener('click',click);root=null;}}};return view;
} });
router.register({ id: 'review', pattern: '/review', title: 'Review Queue', load: async () => { const { createReviewController, renderReviewQueue } = await import('./views/review-queue/review-queue.b19736a44924.mjs');const controller=createReviewController({api,language:cachedPreferences.language});await controller.load();return {experienceLevel:'workspace',render:()=>renderReviewQueue(controller.snapshot())}; } });

router.register({ id: 'workroom', pattern: /^\/workroom(?:\?.*)?$/, cache: 'path', title: 'Studio', load: async () => {
  const [{ createWorkroomModel, renderWorkroomView }, { createTerminalClient, decodeTerminalOutput }] = await Promise.all([import('./views/workroom/workroom-view.881554068463.mjs'), import('./views/workroom/terminal-client.62cb789c0d81.mjs')]);
  const projects = await api.get('/api/projects').catch(() => []); const list = Array.isArray(projects) ? projects : projects?.projects ?? [];
  const params = new URLSearchParams(location.hash.split('?')[1] ?? ''); const requestedProject = params.get('project') ?? params.get('projectId'); const requestedTerminal = String(params.get('terminal') ?? '').trim();
  const project = list.find((item) => String(item.id) === String(requestedProject)) ?? list[0] ?? null;
  const model = createWorkroomModel({ projectId: project?.id ?? 'unselected', missionId: params.get('mission'), returnPath: '/missions', language: cachedPreferences.language });
  const loadTree = async (directory = '.') => {
    if (!project) return model.snapshot(); model.setLoading(true); model.setError(null);
    try { const payload = await api.get(`/api/workroom/tree?projectId=${encodeURIComponent(project.id)}&directory=${encodeURIComponent(directory)}`); model.setTree(payload?.entries ?? []); }
    catch (error) { model.setError(error?.message ?? error); } finally { model.setLoading(false); } return model.snapshot();
  };
  const loadFile = async (file) => {
    model.setLoading(true); model.setError(null); model.openFile(file);
    try { model.setFile(await api.get(`/api/workroom/file?projectId=${encodeURIComponent(project.id)}&file=${encodeURIComponent(file)}`)); }
    catch (error) { model.setError(error?.message ?? error); } finally { model.setLoading(false); } return model.snapshot();
  };
  const loadGitStatus = async () => {
    if (!project) return model.snapshot();
    try { model.setGitStatus(await api.get(`/api/git/status?projectId=${encodeURIComponent(project.id)}`)); }
    catch { model.setGitStatus(null); }
    return model.snapshot();
  };
  await Promise.all([loadTree(), loadGitStatus()]);
  let root = null; let repaint = () => {}; let terminalClient = null;
  const applyTerminalEvent = (message) => {
    const terminal = model.snapshot().terminal;
    if (!message || (message.sessionId && String(message.sessionId) !== terminal.id)) return;
    if (message.type === 'output') model.appendTerminalOutput(decodeTerminalOutput(message.data));
    if (message.type === 'title') model.setTerminal({ title: message.title ?? terminal.title });
    if (message.type === 'exit') model.setTerminal({ status: 'exited', exited: true });
    if (message.type === 'session-error') model.appendTerminalOutput(`\r\n[terminal error: ${message.message ?? 'unknown'}]\r\n`);
    repaint();
  };
  const terminal = () => terminalClient ??= createTerminalClient({ onEvent: applyTerminalEvent, onStatus: (status) => { const current = model.snapshot().terminal; if (current.id) { model.setTerminal({ status }); repaint(); } } });
  const attachTerminal = async (sessionId) => {
    if (!project || !sessionId) return;
    model.clearTerminal(); model.setTerminal({ status: 'connecting' }); model.setError(null);
    try {
      const sessions = await terminal().request('list');
      const session = Array.isArray(sessions) ? sessions.find((item) => String(item?.id) === String(sessionId) && String(item?.projectId) === String(project.id)) : null;
      if (!session) throw new Error(cachedPreferences.language === 'vi' ? 'Terminal này không còn khả dụng trong phiên cục bộ hiện tại.' : 'This terminal is no longer available in the current local session.');
      const snapshot = await terminal().request('snapshot', { sessionId: session.id, afterCursor: 0 });
      const chunks = Array.isArray(snapshot?.chunks) ? snapshot.chunks : snapshot?.data == null ? [] : [{ data: snapshot.data }];
      const output = chunks.map((chunk) => { const value = String(chunk?.data ?? ''); return decodeTerminalOutput(value) || value; }).join('').slice(-100_000);
      model.setTerminal({ id: session.id, title: String(session.shell ?? 'Terminal').split(/[\\/]/).at(-1), status: session.state ?? 'connected', output, exited: session.state === 'exited' }); model.setAgentTab('terminal');
    } catch (error) { model.clearTerminal(); model.setError(error?.message ?? error); }
  };
  if (requestedTerminal) await attachTerminal(requestedTerminal);
  const openTerminal = async () => {
    if (!project) return;
    const current = model.snapshot().terminal;
    if (current.id && !current.exited) { model.setAgentTab('terminal'); repaint(); return; }
    model.clearTerminal(); model.setTerminal({ status: 'connecting' }); model.setError(null); repaint();
    try {
      const runtime = await api.get('/api/runtime'); const shell = runtime?.allowedShells?.[0];
      if (!runtime?.ptyHost?.configured || !shell) throw new Error(cachedPreferences.language === 'vi' ? 'Runtime chưa có shell terminal được phép.' : 'The runtime has no permitted terminal shell.');
      const session = await terminal().request('create', { projectId: project.id, shell, cwd: '.', cols: 100, rows: 30 });
      model.setTerminal({ id: session.id, title: String(session.shell ?? shell).split(/[\\/]/).at(-1), status: 'connected', output: '', exited: false }); model.setAgentTab('terminal');
    } catch (error) { model.clearTerminal(); model.setError(error?.message ?? error); }
    repaint(); requestAnimationFrame(() => root?.querySelector('[data-workroom-terminal-input]')?.focus({ preventScroll: true }));
  };
  const closeTerminal = async () => { const current = model.snapshot().terminal; if (!current.id) return; try { await terminal().request('terminate', { sessionId: current.id }); } catch (error) { model.setError(error?.message ?? error); } finally { model.clearTerminal(); repaint(); } };
  const view = {
    experienceLevel: 'studio',
    render: () => renderWorkroomView(model.snapshot(), { language: cachedPreferences.language }),
    mount(node) {
      root = node; repaint = () => { if (root) root.innerHTML = view.render(); };
      const click = async (event) => {
        const file = event.target.closest?.('[data-workroom-file]'); const directory = event.target.closest?.('[data-workroom-directory]'); const tab = event.target.closest?.('[data-workroom-tab]'); const pane = event.target.closest?.('[data-workroom-pane]'); const agentTab = event.target.closest?.('[data-workroom-agent-tab]'); const action = event.target.closest?.('[data-workroom-action]');
        if (file) { await loadFile(file.dataset.workroomFile); repaint(); return; }
        if (directory) { await loadTree(directory.dataset.workroomDirectory); repaint(); return; }
        if (tab) { model.setTab(tab.dataset.workroomTab); repaint(); return; }
        if (pane) { model.setCompactPane(pane.dataset.workroomPane); repaint(); return; }
        if (agentTab) { if (agentTab.dataset.workroomAgentTab === 'terminal') await openTerminal(); else { model.setAgentTab('agent'); repaint(); } return; }
        if (!action) return;
        if (action.dataset.workroomAction === 'command') { location.hash = '/search'; return; }
        if (action.dataset.workroomAction === 'layout') { const panels = model.snapshot().panels; const open = !(panels.files.open || panels.agent.open); model.setPanel('files', open); model.setPanel('agent', open); repaint(); return; }
        if (action.dataset.workroomAction === 'terminal') { await openTerminal(); return; }
        if (action.dataset.workroomAction === 'terminal-close') { await closeTerminal(); return; }
        if (action.dataset.workroomAction === 'steer') { const objective = String(root?.querySelector('[data-workroom-steer]')?.value ?? '').trim(); if (!objective) return; try { await sessionRestore.flush({ drafts: [{ scope: 'home', draft: { objective, selection: [objective.length, objective.length], projectId: project?.id ?? '', intent: 'ask', modelChoice: 'auto', skillIds: [] } }] }); location.hash = `/?projectId=${encodeURIComponent(project?.id ?? '')}`; } catch (error) { model.setError(error?.message ?? error); repaint(); } return; }
        if (action.dataset.workroomAction === 'diff') { const snapshot = model.snapshot(); if (!snapshot.file) return; model.setLoading(true); try { model.setDiff(await api.post('/api/workroom/diff', { projectId: project.id, file: snapshot.file.path, content: snapshot.draftContent })); model.setTab('changes'); } catch (error) { model.setError(error?.message ?? error); } finally { model.setLoading(false); } repaint(); return; }
        if (action.dataset.workroomAction === 'save') { const snapshot = model.snapshot(); if (!snapshot.file || !snapshot.dirty) return; model.setLoading(true); try { await api.put('/api/workroom/file', { projectId: project.id, file: snapshot.file.path, content: snapshot.draftContent, expectedSha256: snapshot.file.sha256 }); model.setFile(await api.get(`/api/workroom/file?projectId=${encodeURIComponent(project.id)}&file=${encodeURIComponent(snapshot.file.path)}`)); await loadGitStatus(); } catch (error) { model.setError(error?.message ?? error); } finally { model.setLoading(false); } repaint(); }
      };
      const input = (event) => { if (event.target.matches?.('[data-workroom-editor]')) { model.setDraftContent(event.target.value); const save = root.querySelector('[data-workroom-action="save"]'); if (save) save.disabled = !model.snapshot().dirty; } if (event.target.matches?.('[data-workroom-filter]')) { const query = event.target.value.toLowerCase(); root.querySelectorAll('[data-workroom-tree] [data-workroom-file], [data-workroom-tree] [data-workroom-directory]').forEach((entry) => { entry.hidden = query && !entry.textContent.toLowerCase().includes(query); }); } };
      const submit = async (event) => { if (!event.target.matches?.('[data-workroom-terminal-form]')) return; event.preventDefault(); const input = root?.querySelector('[data-workroom-terminal-input]'); const text = String(input?.value ?? ''); const current = model.snapshot().terminal; if (!text || !current.id || current.exited) return; try { await terminal().request('input', { sessionId: current.id, data: `${text}\r` }); input.value = ''; } catch (error) { model.setError(error?.message ?? error); repaint(); } };
      root.addEventListener('click', click); root.addEventListener('input', input); root.addEventListener('submit', submit); return () => { terminalClient?.close(); root.removeEventListener('click', click); root.removeEventListener('input', input); root.removeEventListener('submit', submit); root = null; repaint = () => {}; };
    },
  }; return view;
} });

router.register({ id: 'control-plane', pattern: /^\/(?:control-plane(?:\/.*)?|browser)$/, cache: 'path', title: 'Control Plane', load: async () => {
  const [{ createControlPlaneModel, normalizeControlPlanePath, renderControlPlaneShell }, { loadControlPlaneDomain, renderControlPlaneDomain }, { hasLiveDomainWorkspace, loadLiveDomainWorkspace, renderLiveDomainWorkspace }, browserView] = await Promise.all([import('./control-plane/control-plane-shell.54759fd0b43b.mjs'), import('./control-plane/route-registry.48d26a870906.mjs'), import('./control-plane/live-domain-workspace.4a269151a8f5.mjs'), import('./views/browser/browser-view.153d62a23478.mjs')]);
  const model=createControlPlaneModel({loader:loadControlPlaneDomain});let active=await model.navigate(normalizeControlPlanePath(routeFromHash()||'/control-plane/overview'));if(typeof active.module?.loadAgentKernelSnapshot==='function')await active.module.loadAgentKernelSnapshot({api});let capabilityModel=active.domain==='capabilities'?active.module.buildCapabilitiesViewModel():null;let root=null;
  const missionPayload=await api.get('/api/missions').catch(()=>[]);const missions=Array.isArray(missionPayload)?missionPayload:missionPayload?.missions??[];const projectId=browserView.resolveBrowserWorkspaceProjectId({selectedProjectId:activeProjectId});const project=projectId?shellProjects.find((item)=>String(item?.id??'')===projectId)??null:null;const projectName=project?.name??project?.workspaceRoot??null;const mission=projectId?missions.find((item)=>String(item?.projectId??'')===projectId)??null:null;const missionId=mission?.id??null;const goalId=mission?.metadata?.goalId??mission?.goalId??null;let skillQuery='';let skillCatalog='';let skillReloadTimer=null;const isBrowserWorkspace=active.domain==='runtime'&&active.subroute==='browser';let browserController=isBrowserWorkspace?browserView.createBrowserWorkspaceController({api,projectId,projectName,missionId,goalId,language:cachedPreferences.language}):null;if(browserController)await browserController.load();let liveWorkspace=!isBrowserWorkspace&&hasLiveDomainWorkspace(active.domain)?await loadLiveDomainWorkspace({api,domain:active.domain,projectId,missionId,language:cachedPreferences.language,skillQuery,skillCatalog}):null;
  const content=()=>browserController?browserView.renderBrowserWorkspace(browserController.snapshot()):active.domain==='capabilities'?active.module.renderCapabilitiesView({...capabilityModel,language:cachedPreferences.language}):liveWorkspace?renderLiveDomainWorkspace(liveWorkspace):renderControlPlaneDomain(active.domain,active.module,{language:cachedPreferences.language});
  const refreshLive=async(button)=>{if(browserController){button?.setAttribute('disabled','');button?.setAttribute('aria-busy','true');await browserController.refresh();if(root)root.innerHTML=view.render();return;}if(!liveWorkspace)return;button?.setAttribute('disabled','');button?.setAttribute('aria-busy','true');liveWorkspace=await loadLiveDomainWorkspace({api,domain:active.domain,projectId,missionId,language:cachedPreferences.language,skillQuery,skillCatalog});if(root)root.innerHTML=view.render();};
  const reloadSkills=async()=>{liveWorkspace=await loadLiveDomainWorkspace({api,domain:active.domain,projectId,missionId,language:cachedPreferences.language,skillQuery,skillCatalog});if(root)rerenderView(root,view);};
  const view={experienceLevel:'expert',render:()=>renderControlPlaneShell(model.snapshot(),{content:content(),language:cachedPreferences.language}),mount(node){root=node;const click=async e=>{const refresh=e.target.closest('[data-control-action="refresh"]');const browserAction=e.target.closest('[data-browser-action]');if(browserAction&&browserController){browserAction.disabled=true;try{const browserUrl=root?.querySelector('[data-browser-url]')?.value;if(browserAction.dataset.browserAction==='refresh')await refreshLive(browserAction);if(browserAction.dataset.browserAction==='install')await browserController.installRuntime();if(browserAction.dataset.browserAction==='open'){browserController.setUrl(browserUrl);await browserController.open();}if(browserAction.dataset.browserAction==='goto'){browserController.setUrl(browserUrl);await browserController.goto();}if(browserAction.dataset.browserAction==='screenshot')await browserController.captureScreenshot();if(browserAction.dataset.browserAction==='snapshot')await browserController.capturePageMap();if(browserAction.dataset.browserAction==='close')await browserController.close();}finally{browserAction.disabled=false;}if(root)root.innerHTML=view.render();return;}if(refresh&&liveWorkspace){await refreshLive(refresh);return;}const skill=e.target.closest('[data-skill-id]');if(skill&&active.domain==='extensions'){skill.setAttribute('aria-busy','true');try{const preview=await api.post(`/api/skills/catalog/${encodeURIComponent(skill.dataset.skillId)}/load`,{});liveWorkspace=Object.freeze({...liveWorkspace,skillPreview:preview});if(root)root.innerHTML=view.render();}catch(error){alert(String(error?.payload?.error??error?.message??error));}finally{skill.removeAttribute('aria-busy');}return;}if(active.domain!=='capabilities')return;const domain=e.target.closest('[data-atlas-domain]');const method=e.target.closest('[data-atlas-method]');if(domain)capabilityModel=active.module.buildCapabilitiesViewModel({...capabilityModel,domain:domain.dataset.atlasDomain||null});if(method)capabilityModel=active.module.buildCapabilitiesViewModel({...capabilityModel,method:method.dataset.atlasMethod});if(domain||method)root.innerHTML=view.render();};const input=e=>{if(active.domain==='extensions'&&e.target.matches('[data-skill-catalog-search]')){skillQuery=e.target.value;clearTimeout(skillReloadTimer);skillReloadTimer=setTimeout(()=>reloadSkills().catch(()=>{}),180);return;}if(active.domain==='capabilities'&&e.target.matches('[data-atlas-search]')){capabilityModel=active.module.buildCapabilitiesViewModel({...capabilityModel,query:e.target.value});rerenderView(root,view);}};const change=e=>{if(active.domain==='extensions'&&e.target.matches('[data-skill-catalog-filter]')){skillCatalog=e.target.value;reloadSkills().catch(()=>{});}};root.addEventListener('click',click);root.addEventListener('input',input);root.addEventListener('change',change);return()=>{clearTimeout(skillReloadTimer);root.removeEventListener('click',click);root.removeEventListener('input',input);root.removeEventListener('change',change)}}};return view;
} });

router.register({ id: 'search', pattern: /^\/search(?:\?.*)?$/, title: 'Search', load: async () => { const { createSearchController, renderSearchView } = await import('./views/search/search-view.4deb5bdcec3a.mjs');const controller=createSearchController({api,language:cachedPreferences.language,capabilities:BACKEND_ATLAS.entries});await controller.load();let root=null;const view={render:()=>renderSearchView(controller.snapshot()),mount(node){root=node;const input=e=>{if(e.target.matches('[data-global-search-input]')){controller.setQuery(e.target.value);rerenderView(root,view);}};const click=e=>{const filter=e.target.closest('[data-search-filter]');if(filter){controller.setFilter(filter.dataset.searchFilter);root.innerHTML=view.render();root.querySelector('[data-global-search-input]')?.focus();}};root.addEventListener('input',input);root.addEventListener('click',click);return()=>{root.removeEventListener('input',input);root.removeEventListener('click',click)}}};return view; } });

router.register({ id: 'onboarding', pattern: '/onboarding', title: 'Welcome', load: async () => {
  const [{ createOnboardingController }, { renderOnboardingView }] = await Promise.all([import('./views/onboarding/onboarding-controller.6a12d87cb4ce.mjs'), import('./views/onboarding/onboarding-view.34ac81174ff9.mjs')]);
  const controller=createOnboardingController({api});await controller.load();let mountedRoot=null;let persistTimer=null;
  const rerender=()=>{if(mountedRoot)mountedRoot.innerHTML=renderOnboardingView(controller.snapshot());};
  const currentValue=(path)=>String(path).split('.').reduce((value,key)=>value?.[key],controller.snapshot().answers);
  const queuePersist=()=>{clearTimeout(persistTimer);persistTimer=setTimeout(async()=>{await controller.persist();rerender();},220);};
  const finish=async()=>{onboardingRequired=false;await reconcileEffectivePreferences();router.invalidate();const level=controller.snapshot().profile?.preferences?.experience?.level??controller.snapshot().answers?.experience??cachedPreferences.experience;const destination=routeForExperience(level);if(routeFromHash()===destination){await render(destination);return;}location.hash=destination;};
  const click=async(event)=>{
    const choice=event.target.closest?.('[data-onboarding-path]');if(choice){const path=choice.dataset.onboardingPath;const value=choice.dataset.onboardingValue;controller.set(path,value);if(path==='language'){await languageSync.preview(value,currentRouteState?.path??'/onboarding');queuePersist();return;}rerender();queuePersist();return;}
    const toggle=event.target.closest?.('[data-onboarding-toggle]');if(toggle){const path=toggle.dataset.onboardingToggle;controller.set(path,!Boolean(currentValue(path)));rerender();queuePersist();return;}
    const action=event.target.closest?.('[data-onboarding-action]')?.dataset.onboardingAction;if(!action)return;
    if(action==='next')await controller.next();
    if(action==='back')await controller.back();
    if(action==='recommended')await controller.recommended();
    if(action==='skip')await controller.skip();
    if(action==='complete')await controller.complete();
    if(action==='continue'||controller.snapshot().completed){await finish();return;}
    rerender();
  };
  const change=(event)=>{const select=event.target.closest?.('[data-onboarding-select]');if(!select)return;controller.set(select.dataset.onboardingSelect,select.value);if(['theme','accent','density','motion'].includes(select.dataset.onboardingSelect)){cachedPreferences=applyPreferences({...cachedPreferenceDocument(),appearance:{...cachedPreferenceDocument().appearance,[select.dataset.onboardingSelect]:select.value}});}rerender();queuePersist();};
  return {experienceLevel:'everyday',render:()=>renderOnboardingView(controller.snapshot()),mount(root){mountedRoot=root;root.addEventListener('click',click);root.addEventListener('change',change);return()=>{clearTimeout(persistTimer);root.removeEventListener('click',click);root.removeEventListener('change',change);mountedRoot=null;}},controller};
} });

router.register({ id: 'settings', pattern: /^\/settings(?:\?.*)?$/, title: 'Settings', load: async ({ path }) => {
  const [{ createSettingsController }, { renderSettingsView }] = await Promise.all([import('./views/settings/settings-controller.2c72d083407e.mjs'), import('./views/settings/settings-view.a21336acbf82.mjs')]);
  const controller=createSettingsController({api});await controller.load();const requestedSection=settingsSectionFromRoute(path,{categories:controller.snapshot().catalog?.categories});if(requestedSection)controller.selectCategory(requestedSection);let mountedRoot=null;let inputTimer=null;let authPollTimer=null;let authPollAttempts=0;
  const applySettingsPreview=({forcePreferencePaths=[]}={})=>{const draft=structuredClone(controller.snapshot().draft??{});const forced=new Set(forcePreferencePaths);draft.general??={};draft.appearance??={};if(draft.general.language==='system'&&!forced.has('general.language'))draft.general.language=cachedPreferences.language;if(draft.appearance.theme==='system'&&!forced.has('appearance.theme'))draft.appearance.theme=cachedPreferences.theme;cachedPreferences=applyPreferences(draft);return cachedPreferences;};
  const rerender=({preserveFocus=null,forcePreferencePaths=[]}={})=>{if(!mountedRoot)return;const viewState=captureViewState(mountedRoot);const activeSearch=document.activeElement?.matches?.('[data-settings-search]')?document.activeElement:null;const settingsSearchState=activeSearch?{value:activeSearch.value,selection:activeSearch.selectionStart==null?null:[activeSearch.selectionStart,activeSearch.selectionEnd]}:null;const focusPath=preserveFocus??document.activeElement?.dataset?.settingPath??null;applySettingsPreview({forcePreferencePaths});mountedRoot.innerHTML=renderSettingsView(controller.snapshot());restoreViewState(mountedRoot,viewState);if(settingsSearchState){const next=mountedRoot.querySelector('[data-settings-search]');if(next){next.value=settingsSearchState.value;next.focus({preventScroll:true});if(settingsSearchState.selection)next.setSelectionRange?.(...settingsSearchState.selection);}}else if(focusPath)mountedRoot.querySelector(`[data-setting-path="${CSS.escape(focusPath)}"]`)?.focus({preventScroll:true});const pill=document.querySelector('[data-command="toggle-experience"]');if(pill)pill.querySelector('span:nth-child(2)').textContent=normalizeExperience(cachedPreferences.experience).replace(/^./,x=>x.toUpperCase());};
  const stopProviderAuthPolling=()=>{clearTimeout(authPollTimer);authPollTimer=null;authPollAttempts=0;};
  const startProviderAuthPolling=(providerId)=>{stopProviderAuthPolling();const tick=async()=>{authPollAttempts+=1;await controller.refreshProviders();rerender();const provider=controller.snapshot().providers.find((item)=>String(item.id)===String(providerId));if(provider?.authenticated===true||authPollAttempts>=60){stopProviderAuthPolling();return;}authPollTimer=setTimeout(()=>tick().catch(()=>{}),2000);};authPollTimer=setTimeout(()=>tick().catch(()=>{}),2000);};
  const parseControlValue=(control)=>{if(control.getAttribute('role')==='switch')return control.getAttribute('aria-checked')!=='true';if(control.type==='number')return control.value===''?null:Number(control.value);return control.value;};
  const activateCategory=(id)=>{controller.selectCategory(id);rerender();requestAnimationFrame(()=>document.querySelector(`#settings-${CSS.escape(id)}`)?.scrollIntoView({block:'start',behavior:cachedPreferences.motion==='reduced'?'auto':'smooth'}));};
  const click=async(event)=>{const category=event.target.closest?.('[data-settings-category-link]');if(category){event.preventDefault();activateCategory(category.dataset.settingsCategoryLink);return;}const experience=event.target.closest?.('[data-experience]');if(experience){controller.setExperience(experience.dataset.experience);rerender();return;}const choice=event.target.closest?.('[data-setting-choice]');if(choice){const path=choice.dataset.settingPath;const value=choice.dataset.settingValue;controller.set(path,value);if(path==='general.language'){await languageSync.preview(value,currentRouteState?.path??'/settings');return;}rerender({forcePreferencePaths:[path]});return;}const switchControl=event.target.closest?.('[data-setting-path][role="switch"]');if(switchControl){controller.set(switchControl.dataset.settingPath,parseControlValue(switchControl));rerender({preserveFocus:switchControl.dataset.settingPath});return;}const providerAuthAction=event.target.closest?.('[data-provider-auth-action]');if(providerAuthAction){providerAuthAction.disabled=true;const providerId=providerAuthAction.dataset.providerId;if(providerAuthAction.dataset.providerAuthAction==='login'){await controller.startProviderLogin(providerId,providerAuthAction.dataset.providerLoginMode);const login=controller.snapshot().providerLogin;if(login?.authUrl)window.open(login.authUrl,'_blank','noopener,noreferrer');if(!controller.snapshot().errors.length)startProviderAuthPolling(providerId);}if(providerAuthAction.dataset.providerAuthAction==='logout'){stopProviderAuthPolling();await controller.logoutProvider(providerId);}rerender();return;}const modelAction=event.target.closest?.('[data-model-action]');if(modelAction){const setupForm=modelAction.closest?.('[data-model-provider-setup]');const manualForm=modelAction.closest?.('[data-model-manual-form]');const setupDraft=setupForm?Object.fromEntries(new FormData(setupForm).entries()):null;const manualDraft=manualForm?Object.fromEntries(new FormData(manualForm).entries()):null;if(modelAction.dataset.modelAction==='configure')await controller.configureProvider({id:setupDraft?.id,kind:setupDraft?.kind,model:setupDraft?.model,baseUrl:setupDraft?.baseUrl,apiKey:setupDraft?.apiKey});if(modelAction.dataset.modelAction==='select')await controller.selectProviderModel(modelAction.dataset.providerId,modelAction.dataset.modelId);if(modelAction.dataset.modelAction==='set-routing-default')controller.setRoutingDefault(modelAction.dataset.modelKey);if(modelAction.dataset.modelAction==='verify-provider')await controller.verifyProvider(modelAction.dataset.providerId);if(modelAction.dataset.modelAction==='discover')await controller.discoverModels(modelAction.dataset.providerId);if(modelAction.dataset.modelAction==='add')await controller.addModel(modelAction.dataset.providerId,manualDraft?.modelId,manualDraft?.displayName);if(modelAction.dataset.modelAction==='probe')await controller.probeModel(modelAction.dataset.providerId,modelAction.dataset.modelId);if(modelAction.dataset.modelAction==='inspect')await controller.inspectModel(modelAction.dataset.modelId);if(modelAction.dataset.modelAction==='toggle-compare')controller.toggleModelComparison(modelAction.dataset.modelId);if(modelAction.dataset.modelAction==='compare')await controller.compareModels();if(modelAction.dataset.modelAction==='clear-compare')controller.clearModelComparison();rerender();if(setupDraft){const nextForm=mountedRoot?.querySelector?.('[data-model-provider-setup]');for(const name of ['id','kind','model','baseUrl']){const control=nextForm?.elements?.namedItem(name);if(control&&setupDraft[name]!=null)control.value=setupDraft[name];}const keyControl=nextForm?.elements?.namedItem('apiKey');if(keyControl)keyControl.value='';}return;}const action=event.target.closest?.('[data-settings-action]')?.dataset.settingsAction;if(!action)return;if(action==='save'){await controller.save();if(!controller.snapshot().errors?.length){await languageSync.commit(currentRouteState?.path??'/settings');return;}}if(action==='reset'){await controller.reset({paths:null});if(!controller.snapshot().errors?.length){await languageSync.commit(currentRouteState?.path??'/settings');return;}}if(action==='retry')await controller.load();if(action==='reset-layout'){layoutStore.reset();layoutStore.apply(document.documentElement);}if(action==='export'){const payload=JSON.stringify({exportedAt:new Date().toISOString(),settings:controller.snapshot().value},null,2);const url=URL.createObjectURL(new Blob([payload],{type:'application/json'}));const anchor=Object.assign(document.createElement('a'),{href:url,download:'nolane-settings.json'});anchor.click();URL.revokeObjectURL(url);}rerender();};
  const input=async(event)=>{if(event.target.matches?.('[data-settings-search]')){const value=event.target.value;clearTimeout(inputTimer);inputTimer=setTimeout(()=>{controller.search(value);rerender();},80);return;}const control=event.target.closest?.('[data-setting-path]');if(!control||control.getAttribute('role')==='switch')return;const path=control.dataset.settingPath;const value=parseControlValue(control);controller.set(path,value);if(path==='general.language'){await languageSync.preview(value,currentRouteState?.path??'/settings');return;}rerender({preserveFocus:path,forcePreferencePaths:[path]});};
  const change=(event)=>{if(event.target.matches?.('[data-settings-layer]')){try{controller.setLayer(event.target.value)}catch{}rerender();}};
  return {shellMode:'settings',experienceLevel:normalizeExperience(controller.snapshot().experience),render:()=>renderSettingsView(controller.snapshot()),mount(root){mountedRoot=root;root.addEventListener('click',click);root.addEventListener('input',input);root.addEventListener('change',change);applySettingsPreview();if(requestedSection)requestAnimationFrame(()=>root.querySelector(`#settings-${CSS.escape(requestedSection)}`)?.scrollIntoView({block:'start',behavior:cachedPreferences.motion==='reduced'?'auto':'smooth'}));return()=>{clearTimeout(inputTimer);stopProviderAuthPolling();root.removeEventListener('click',click);root.removeEventListener('input',input);root.removeEventListener('change',change);mountedRoot=null;}},controller};
} });
router.setNotFound({id:'not-found',title:'Not Found',load:simpleRoute('Not found','The requested Nolane Agent surface does not exist.')});

async function render(path) {
  if (currentRouteState) persistCurrentSession();
  activeViewCleanup?.(); activeViewCleanup=null; resizer?.destroy(); resizer=null;
  await refreshShellData();
  const state=await router.navigate(path,{replace:true});currentRouteState=state;document.title=`${localizeRouteTitle(state.path,state.title,cachedPreferences.language)} — Nolane Agent`;
  const routeMinimum=normalizeExperience(state.view.experienceLevel??'everyday');const preferred=normalizeExperience(cachedPreferences.experience??'everyday');const experience=['everyday','workspace','studio','expert'].indexOf(routeMinimum)>['everyday','workspace','studio','expert'].indexOf(preferred)?routeMinimum:preferred;
  currentExperience=experience;
  document.body.innerHTML=renderAppShell({activePath:state.path,routeTitle:state.title,content:state.view.render(),experienceLevel:experience,shellMode:state.view.shellMode??'default',language:cachedPreferences.language,sessionSnapshot:shellSnapshot,projects:shellProjects,selectedProjectId:activeProjectId,sidebarCollapsed:layoutStore.snapshot().sidebarCollapsed,runtimeState:'online',updateState:updateStateController.snapshot()});
  layoutStore.apply(document.documentElement);resizer=createResizableRegionController({root:document,layoutStore,step:Number(cachedPreferences.keyboardResizeStep??16)});const workspace=document.querySelector('#workspace');const cleanup=state.view.mount?.(workspace);if(typeof cleanup==='function')activeViewCleanup=cleanup;renderSummary();const restored=viewStateBridge.restore(document,{experience});if(!restored)document.querySelector('#workspace')?.focus({preventScroll:true});store.dispatch({type:'route/ready',patch:{route:state.path,ready:true}});bus.emit('route:ready',state);
  persistCurrentSession();
}

window.addEventListener('nolane:project-selected',(event)=>{activeProjectId=String(event.detail?.projectId ?? '')||null;syncProjectSelection(activeProjectId);if(summaryController.snapshot().open)void summaryController.refresh();});
window.addEventListener('nolane:project-create-requested',requestProjectCreation);
window.addEventListener('hashchange',()=>{const path=routeFromHash();if(onboardingRequired&&path!=='/onboarding'){location.hash='/onboarding';return;}render(path);});
document.addEventListener('click',async(event)=>{
  const pickerToggle=event.target.closest?.('[data-project-picker-toggle]'); if(pickerToggle){event.preventDefault();const picker=pickerToggle.closest('[data-project-picker]');const menu=picker?.querySelector('[data-project-picker-menu]');if(menu){const open=menu.hidden;menu.hidden=!open;pickerToggle.setAttribute('aria-expanded',String(open));if(open)requestAnimationFrame(()=>menu.querySelector('[data-project-search]')?.focus({preventScroll:true}));}return;}
  const projectChoice=event.target.closest?.('[data-project-choice]'); if(projectChoice){event.preventDefault();const id=String(projectChoice.dataset.projectId??'');window.dispatchEvent(new CustomEvent('nolane:project-selected',{detail:{projectId:id,source:'sidebar'}}));return;}
  const projectAction=event.target.closest?.('[data-project-action]'); if(projectAction && ['new','none'].includes(projectAction.dataset.projectAction)){event.preventDefault();if(projectAction.dataset.projectAction==='new'){await requestProjectCreation();}else{window.dispatchEvent(new CustomEvent('nolane:project-selected',{detail:{projectId:'',source:'sidebar'}}));}return;}
  if(!event.target.closest?.('[data-project-picker]'))document.querySelectorAll('[data-project-picker-menu]').forEach((menu)=>{menu.hidden=true;menu.closest('[data-project-picker]')?.querySelector('[data-project-picker-toggle]')?.setAttribute('aria-expanded','false');});
  const link=event.target.closest?.('[data-route]');if(link){event.preventDefault();location.hash=link.dataset.route;return;}
  if(event.target.closest?.('[data-command="new-mission"]')){location.hash='/';requestAnimationFrame(()=>document.querySelector('#objective')?.focus());return;}
  if(event.target.closest?.('[data-command="global-search"]')){location.hash='/search';return;}
  if(event.target.closest?.('[data-command="notifications"]')){location.hash='/settings?section=notifications';return;}
  if(event.target.closest?.('[data-command="help"]')){location.hash='/settings?section=shortcuts';return;}
  if(event.target.closest?.('[data-command="open-sidebar"]')){layoutStore.update({sidebarCollapsed:false});layoutStore.apply(document.documentElement);document.querySelector('.app-shell')?.setAttribute('data-sidebar-collapsed','false');document.querySelector('.session-sidebar')?.setAttribute('data-open','true');return;}
  if(event.target.closest?.('[data-command="collapse-sidebar"]')){layoutStore.update({sidebarCollapsed:true});layoutStore.apply(document.documentElement);document.querySelector('.app-shell')?.setAttribute('data-sidebar-collapsed','true');document.querySelector('.session-sidebar')?.removeAttribute('data-open');return;}
  const summaryAction=event.target.closest?.('[data-summary-action]')?.dataset.summaryAction;if(event.target.closest?.('[data-command="toggle-summary"]')){await summaryController.toggle();renderSummary();persistCurrentSession();return;}if(summaryAction==='close'){summaryController.close();renderSummary();persistCurrentSession();return;}if(summaryAction==='refresh'){await summaryController.refresh();renderSummary();return;}if(summaryAction==='manage-sources'){summaryController.close();location.hash='/control-plane/extensions/mcp';return;}const stop=event.target.closest?.('[data-stop-process]');if(stop){stop.disabled=true;await summaryController.stopProcess(stop.dataset.stopProcess).catch(()=>{});renderSummary();return;}const output=event.target.closest?.('[data-output-id]');if(summaryAction==='add-output'||output){summaryController.close();const projectId=String(summaryController.snapshot().value?.projectId??activeProjectId??'').trim();location.hash=projectId?`/workroom?project=${encodeURIComponent(projectId)}`:'/workroom';return;}const terminal=event.target.closest?.('[data-terminal-id]');if(terminal){summaryController.close();const projectId=String(summaryController.snapshot().value?.projectId??activeProjectId??'').trim();if(!projectId)return;location.hash=`/workroom?project=${encodeURIComponent(projectId)}&terminal=${encodeURIComponent(terminal.dataset.terminalId)}`;return;}
  const experienceOption=event.target.closest?.('[data-experience-option]');if(experienceOption){event.preventDefault();await selectExperience(experienceOption.dataset.experienceOption);return;}
  const updateAction=event.target.closest?.('[data-update-action]')?.dataset.updateAction;if(updateAction){event.preventDefault();if(updateAction==='check')await updateStateController.check();if(updateAction==='download')await updateStateController.download();if(updateAction==='defer')await updateStateController.defer();if(updateAction==='ignore')await updateStateController.ignore();if(updateAction==='install')await updateStateController.install();renderUpdateNoticeRoot();return;}
  if(event.target.closest?.('[data-command="toggle-experience"]')){event.preventDefault();const menu=document.querySelector('[data-experience-menu]');setExperienceMenu(Boolean(menu?.hidden),{focusSelected:true});return;}
  if(!event.target.closest?.('[data-experience-switcher]'))setExperienceMenu(false);
});
document.addEventListener('input',(event)=>{const search=event.target.closest?.('[data-project-search]');if(!search)return;const needle=String(search.value??'').trim().toLocaleLowerCase();search.closest('[data-project-picker]')?.querySelectorAll('[data-project-choice]').forEach((choice)=>{choice.hidden=Boolean(needle&&!String(choice.dataset.projectSearchText??'').toLocaleLowerCase().includes(needle));});});
window.addEventListener('keydown',(event)=>{
  const projectPicker=event.target.closest?.('[data-project-picker]');if(projectPicker){const menu=projectPicker.querySelector('[data-project-picker-menu]');const trigger=projectPicker.querySelector('[data-project-picker-toggle]');if(menu&&trigger){if(event.key==='Escape'&&!menu.hidden){event.preventDefault();menu.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.focus({preventScroll:true});return;}if(event.key==='ArrowDown'&&event.target===trigger){event.preventDefault();trigger.click();return;}if(event.key==='ArrowDown'&&event.target.matches?.('[data-project-search]')&&!menu.hidden){const first=[...projectPicker.querySelectorAll('[data-project-choice]')].find((choice)=>!choice.hidden);if(first){event.preventDefault();first.focus({preventScroll:true});return;}}if(event.key==='ArrowUp'&&event.target.matches?.('[data-project-choice]')&&!menu.hidden){event.preventDefault();projectPicker.querySelector('[data-project-search]')?.focus({preventScroll:true});return;}}}
  if((event.metaKey||event.ctrlKey)&&event.shiftKey&&event.key.toLowerCase()==='e'){event.preventDefault();setExperienceMenu(true,{focusSelected:true});return;}
  const menu=document.querySelector('[data-experience-menu]');if(menu&&!menu.hidden){const options=[...menu.querySelectorAll('[data-experience-option]')];const current=options.indexOf(document.activeElement);if(event.key==='Escape'){event.preventDefault();setExperienceMenu(false);document.querySelector('[data-command="toggle-experience"]')?.focus();return;}if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)&&options.length){event.preventDefault();let next=current;if(event.key==='Home')next=0;else if(event.key==='End')next=options.length-1;else next=(Math.max(0,current)+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;options.forEach((option,index)=>option.tabIndex=index===next?0:-1);options[next].focus();return;}}
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();location.hash='/search';}
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='n'){event.preventDefault();location.hash='/';requestAnimationFrame(()=>document.querySelector('#objective')?.focus());}
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persistCurrentSession({immediate:true});});
window.addEventListener('pagehide',()=>{persistCurrentSession({immediate:true});});
window.addEventListener('beforeunload',()=>{persistCurrentSession({immediate:true});activeViewCleanup?.();resizer?.destroy();summaryController.destroy();sessionRestore.destroy();updateStateController.destroy();});
applyPreferences(cachedPreferenceDocument());
(async()=>{
  try { await api.post('/api/local-session/bootstrap', {}); scrubBootstrapToken(); } catch {}
  await Promise.all([reconcileEffectivePreferences(),sessionRestore.load(),updateStateController.load()]);
  const explicitPath=routeFromHash();let path=explicitPath||sessionRestore.snapshot().restore?.activeRoute||'/';
  try { const status=await api.get('/api/onboarding/status');onboardingRequired=Boolean(status?.required);if(onboardingRequired)path='/onboarding';else if(path==='/onboarding')path=routeForExperience(); } catch { onboardingRequired=false; }
  await render(path);
})();
