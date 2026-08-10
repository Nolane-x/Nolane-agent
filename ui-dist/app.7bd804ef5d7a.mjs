import { createRouter } from './core/router.c5446cce45f3.mjs';
import { createUiStore } from './core/ui-store.127154bb112d.mjs';
import { createUiBus } from './core/ui-bus.7ee7a25dbffb.mjs';
import { createApiClient } from './core/api-client.0378b7e03be4.mjs';
import { createLayoutStore } from './core/layout-store.9a10af02fd79.mjs';
import { createResizableRegionController } from './core/resizable-region.4a489f6e0298.mjs';
import { applyPreferences, readCachedPreferences } from './core/preference-runtime.17907a68c42f.mjs';
import { createLanguageSyncController } from './core/language-sync-controller.5ea1794c12c1.mjs';
import { normalizeExperience } from './core/experience-policy.b168311668ad.mjs';
import { createExperienceTransitionController } from './core/experience-transition-controller.184cc11adcf9.mjs';
import { createViewStateBridge } from './core/view-state-bridge.93704acfe607.mjs';
import { captureViewState, restoreViewState } from './core/view-state-preserver.b422d62484c1.mjs';
import { createSessionRestoreController } from './core/session-restore-controller.8af9b6d82641.mjs';
import { createUpdateStateController } from './core/update-state-controller.c9cc1171e7c8.mjs';
import { localizeRouteTitle, renderAppShell } from './shell/app-shell.272f66e69db9.mjs';
import { renderUpdateNotice } from './components/update-notice/update-notice.9883c8a40b75.mjs';
import { createSessionSidebarModel } from './shell/session-sidebar.e8dee1f03f8f.mjs';
import { projectNameFromPath } from './shell/project-picker.32231f7f97a0.mjs';
import { createOutputSummaryController, renderOutputSummary } from './views/summary/output-summary.d9fbecbccad5.mjs';
import { BACKEND_ATLAS } from './generated/backend-atlas.77d753e1223f.mjs';

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
    attachmentRefs: []
  };
}

function persistCurrentSession({ immediate = false } = {}) {
  const patch = {
    activeRoute: currentRouteState?.path ?? (location.hash.slice(1) || '/'),
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
const summaryController = createOutputSummaryController({ api, onChange: renderSummary });
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
  setExperienceMenu(false);
  if (target === current) return;
  const button = document.querySelector('[data-command="toggle-experience"]');
  if (button) button.disabled = true;
  const result = await experienceTransition.transition({ fromExperience: current, toExperience: target, currentPath: currentRouteState?.path ?? '/' });
  if (!result.ok) {
    if (button) button.disabled = false;
    announceExperience(cachedPreferences.language === 'vi' ? `Không thể lưu tầng giao diện: ${result.error}` : `Could not save experience level: ${result.error}`, 'error');
    return;
  }
  cachedPreferences = applyPreferences(result.preferences ?? cachedPreferenceDocument(target));
  await render(result.path);
  viewStateBridge.restore(document, { experience: target });
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
  if (typeof selectDirectory !== 'function') {
    announceExperience(cachedPreferences.language === 'vi' ? 'Tạo dự án mới cần chạy trong Electron desktop.' : 'Creating a project requires the Electron desktop launcher.', 'error');
    return null;
  }
  try {
    const workspaceRoot = await selectDirectory();
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
    if (next && value !== undefined) next.value = value;
    if (next && selection) { next.focus({ preventScroll: true }); next.setSelectionRange?.(...selection); }
  }
}

router.register({ id: 'home', pattern: /^\/(?:\?.*)?$/, title: 'Chat', load: async () => {
  // The build rewrites this local import to the immutable hashed home module.
  const { createHomeController, renderHomeView } = await import('./views/home/home-view.b5d8b62b1ec2.mjs');
  const restoredDraft = sessionRestore.snapshot().drafts.home;
  const queryProjectId = new URLSearchParams((location.hash.split('?')[1] ?? '')).get('projectId');
  const controller = createHomeController({ api, language: cachedPreferences.language }); await controller.load();
  const preferredProjectId = activeProjectId ?? queryProjectId ?? restoredDraft?.projectId ?? controller.snapshot().selectedProjectId;
  if (preferredProjectId) controller.setProject(preferredProjectId);
  activeProjectId = controller.snapshot().selectedProjectId || null;
  if (restoredDraft?.intent) controller.setIntent(restoredDraft.intent);
  if (restoredDraft?.modelChoice) controller.setModel(restoredDraft.modelChoice);
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
      const openComposerPicker = (picker) => { const menu = picker?.querySelector('[data-composer-picker-menu]'); const trigger = picker?.querySelector('[data-composer-picker-toggle]'); if (!menu || !trigger) return; const open = menu.hidden; closeComposerPickers(); if (!open) return; menu.hidden = false; trigger.setAttribute('aria-expanded', 'true'); requestAnimationFrame(() => menu.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true })); };
      const chooseComposerOption = (option) => { const picker = option?.closest('[data-composer-picker]'); if (!picker) return; const name = picker.dataset.composerPicker; const value = option.dataset.pickerValue ?? ''; const text = root.querySelector('#objective')?.value ?? ''; if (name === 'intent') controller.setIntent(value); if (name === 'modelChoice') controller.setModel(value); closeComposerPickers(); render({ textareaValue: text, focus: true }); saveDraft(); };
      const onExternalProjectSelected = (event) => { if(event.detail?.source === 'home') return; const id=String(event.detail?.projectId ?? ''); const value=root.querySelector('#objective')?.value??''; controller.setProject(id); render({textareaValue:value,focus:true}); saveDraft(); };
      window.addEventListener('nolane:project-selected', onExternalProjectSelected);
      const openMenu = (type, query = '') => { selectedMenuIndex=0; controller.setMenu({type,query}); render({focus:true}); };
      const closeMenu = () => { const value=root.querySelector('#objective')?.value??'';controller.setMenu(null);render({textareaValue:value,focus:true}); };
      const chooseMenuItem = (button) => { const area=root.querySelector('#objective'); if(!area)return; const kind=button.dataset.menuKind; const id=button.dataset.menuId; const label=button.dataset.menuLabel; const value=area.value; const token=kind==='command'?`/${id}`:`@${kind}:${id}`; const match=value.match(/(^|\s)([@/][^\s]*)$/); area.value=match?`${value.slice(0,match.index)}${match[1]}${token} `:`${value}${value&& !value.endsWith(' ')?' ':''}${token} `; if(kind==='command'&&['ask','plan','build','verify'].includes(id))controller.setIntent(id); controller.setMenu(null); render({textareaValue:area.value,focus:true}); saveDraft(); };
      const click = async (event) => {
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
      const input = (event) => { if(event.target.matches?.('[data-project-search]')){const value=event.target.value;controller.setProjectMenu(true);controller.setProjectQuery(value);render({textareaValue:root.querySelector('#objective')?.value??'',projectSearchValue:value,focusProjectSearch:true});return;} if(event.target.name==='projectId')controller.setProject(event.target.value); if(event.target.name==='modelChoice')controller.setModel(event.target.value); if(event.target.name==='intent')controller.setIntent(event.target.value); if(event.target.id==='objective'){const match=event.target.value.match(/(^|\s)([@/])([^\s]*)$/);if(match){controller.setMenu({type:match[2]==='@'?'context':'command',query:match[3]});const value=event.target.value;render({textareaValue:value,focus:true});}else if(controller.snapshot().menu){controller.setMenu(null);const value=event.target.value;render({textareaValue:value,focus:true});}} saveDraft(); };
      const keydown=(event)=>{const picker=event.target.closest?.('[data-composer-picker]');if(picker){const menu=picker.querySelector('[data-composer-picker-menu]');const trigger=picker.querySelector('[data-composer-picker-toggle]');const options=[...picker.querySelectorAll('[data-composer-picker-option]')];if(event.target===trigger&&(event.key==='ArrowDown'||event.key==='Enter'||event.key===' ')){event.preventDefault();openComposerPicker(picker);return;}if(menu&&!menu.hidden){if(event.key==='Escape'){event.preventDefault();closeComposerPickers(picker.dataset.composerPicker);return;}if(event.key==='Tab'){closeComposerPickers();return;}const current=Math.max(0,options.indexOf(document.activeElement));if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)&&options.length){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?options.length-1:(current+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;options.forEach((item,index)=>item.setAttribute('aria-selected',String(index===next)));options[next].focus({preventScroll:true});return;}if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-composer-picker-option]')){event.preventDefault();chooseComposerOption(event.target);return;}}}
        const menu=root.querySelector('.composer-menu');if(!menu)return;if(event.key==='Escape'){event.preventDefault();closeMenu();return;}const items=[...menu.querySelectorAll('[data-menu-id]')];if(!items.length)return;if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();selectedMenuIndex=(selectedMenuIndex+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items.forEach((item,i)=>item.setAttribute('aria-selected',String(i===selectedMenuIndex)));items[selectedMenuIndex].scrollIntoView({block:'nearest'});}if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();chooseMenuItem(items[selectedMenuIndex]);}};
      const submit=async(event)=>{if(event.target.id!=='mission-composer')return;event.preventDefault();const data=new FormData(event.target);const objective=String(data.get('objective')??'');try{const mission=await controller.submit({objective,projectId:data.get('projectId'),intent:data.get('intent'),modelChoice:data.get('modelChoice')});event.target.querySelector('#objective').value='';await sessionRestore.clearDraft('home');await refreshShellData({force:true});location.hash=`/missions?id=${encodeURIComponent(mission?.id??'current')}`;}catch{render({textareaValue:objective,focus:true});saveDraft();}};
      root.addEventListener('click',click);root.addEventListener('input',input);root.addEventListener('change',input);root.addEventListener('keydown',keydown);root.addEventListener('submit',submit);
      return()=>{saveDraft();window.removeEventListener('nolane:project-selected', onExternalProjectSelected);root.removeEventListener('click',click);root.removeEventListener('input',input);root.removeEventListener('change',input);root.removeEventListener('keydown',keydown);root.removeEventListener('submit',submit);root=null;};
    }, controller,
  }; return view;
} });

router.register({ id: 'missions', pattern: /^\/missions(?:\?.*)?$/, cache: 'path', title: 'Activity', load: async () => {
  const { createActivityController, renderActivityView } = await import('./views/activity/activity-view.67ee40d6a9ef.mjs');
  const selectedMissionId=new URLSearchParams((location.hash.split('?')[1]??'')).get('id');const controller=createActivityController({api,language:cachedPreferences.language,selectedMissionId,experience:cachedPreferences.experience});await controller.load();let root=null;let timer=null;const view={experienceLevel:'workspace',render:()=>renderActivityView(controller.snapshot()),mount(node){root=node;const repaint=()=>{if(root)root.innerHTML=view.render();};const click=async(e)=>{const f=e.target.closest('[data-activity-filter]');if(f){controller.setFilter(f.dataset.activityFilter);repaint();return;}const mission=e.target.closest('[data-activity-mission]');if(mission){await controller.selectMission(mission.dataset.activityMission);repaint();return;}const tt=e.target.closest('[data-time-travel-action]');if(!tt)return;const action=tt.dataset.timeTravelAction;const checkpointId=tt.dataset.timeTravelCheckpoint;tt.disabled=true;try{if(action==='create')await controller.createCheckpoint();else if(action==='select')await controller.selectCheckpoint(checkpointId);else if(action==='compare')await controller.compareCheckpoint(checkpointId);else if(action==='branch')await controller.createBranch(checkpointId);else if(action==='replay')await controller.replayMission(checkpointId);else if(action==='restore'){const file=tt.dataset.timeTravelPath;const approved=confirm(cachedPreferences.language==='vi'?`Khôi phục ${file} từ checkpoint? Trạng thái hiện tại sẽ được backup và ghi receipt mới.`:`Restore ${file} from the checkpoint? The current state will be backed up and a new receipt recorded.`);if(approved)await controller.restoreFile(checkpointId,file,{confirmOverwrite:true});}repaint();}catch(error){alert(String(error?.message??error));repaint();}};const change=(e)=>{if(e.target.matches('[data-activity-follow]')){controller.setFollow(e.target.checked);repaint();}};timer=setInterval(async()=>{if(controller.snapshot().follow){await controller.refresh();repaint();}},5000);root.addEventListener('click',click);root.addEventListener('change',change);return()=>{clearInterval(timer);root.removeEventListener('click',click);root.removeEventListener('change',change);root=null;}}};return view;
} });

router.register({ id: 'projects', pattern: /^\/projects(?:\?.*)?$/, title: 'Projects', load: async () => {
  const { createProjectsController, renderProjectsView } = await import('./views/projects/project-view.5a4fb83f6bb8.mjs');const controller=createProjectsController({api,language:cachedPreferences.language});await controller.load();let root=null;const view={render:()=>renderProjectsView(controller.snapshot()),mount(node){root=node;const input=e=>{if(e.target.matches('[data-project-search]')){controller.setQuery(e.target.value);rerenderView(root,view);}};const click=e=>{if(e.target.closest('[data-project-action="add"]')){window.dispatchEvent(new CustomEvent('nolane:project-create-requested',{detail:{source:'projects-view'}}));}};root.addEventListener('input',input);root.addEventListener('click',click);return()=>{root.removeEventListener('input',input);root.removeEventListener('click',click)}}};return view;
} });

router.register({ id: 'review-mission', pattern: /^\/review\/.+$/, cache: 'path', title: 'Review & Ship', load: async () => { const { createReviewModel, renderReviewView } = await import('./views/review/review-view.99eba3959724.mjs'); const model = createReviewModel({ missionId: location.hash.slice(1).split('/').at(-1) || 'current' }); return { experienceLevel:'workspace',render: () => renderReviewView(model.snapshot(), { language: cachedPreferences.language }) }; } });
router.register({ id: 'review', pattern: '/review', title: 'Review Queue', load: async () => { const { createReviewController, renderReviewQueue } = await import('./views/review-queue/review-queue.32168592cc45.mjs');const controller=createReviewController({api,language:cachedPreferences.language});await controller.load();return {experienceLevel:'workspace',render:()=>renderReviewQueue(controller.snapshot())}; } });

router.register({ id: 'workroom', pattern: /^\/workroom(?:\?.*)?$/, title: 'Studio', load: async () => {
  const { createWorkroomModel, renderWorkroomView } = await import('./views/workroom/workroom-view.c227379a2d30.mjs');
  const projects = await api.get('/api/projects').catch(() => []); const list = Array.isArray(projects) ? projects : projects?.projects ?? [];
  const params = new URLSearchParams(location.hash.split('?')[1] ?? ''); const requestedProject = params.get('project') ?? params.get('projectId');
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
  await loadTree();
  let root = null;
  const view = {
    experienceLevel: 'studio',
    render: () => renderWorkroomView(model.snapshot(), { language: cachedPreferences.language }),
    mount(node) {
      root = node; const repaint = () => { if (root) root.innerHTML = view.render(); };
      const click = async (event) => {
        const file = event.target.closest?.('[data-workroom-file]'); const directory = event.target.closest?.('[data-workroom-directory]'); const tab = event.target.closest?.('[data-workroom-tab]'); const action = event.target.closest?.('[data-workroom-action]');
        if (file) { await loadFile(file.dataset.workroomFile); repaint(); return; }
        if (directory) { await loadTree(directory.dataset.workroomDirectory); repaint(); return; }
        if (tab) { model.setTab(tab.dataset.workroomTab); repaint(); return; }
        if (!action) return;
        if (action.dataset.workroomAction === 'diff') { const snapshot = model.snapshot(); if (!snapshot.file) return; model.setLoading(true); try { model.setDiff(await api.post('/api/workroom/diff', { projectId: project.id, file: snapshot.file.path, content: snapshot.draftContent })); model.setTab('changes'); } catch (error) { model.setError(error?.message ?? error); } finally { model.setLoading(false); } repaint(); return; }
        if (action.dataset.workroomAction === 'save') { const snapshot = model.snapshot(); if (!snapshot.file || !snapshot.dirty) return; model.setLoading(true); try { await api.put('/api/workroom/file', { projectId: project.id, file: snapshot.file.path, content: snapshot.draftContent, expectedSha256: snapshot.file.sha256 }); model.setFile(await api.get(`/api/workroom/file?projectId=${encodeURIComponent(project.id)}&file=${encodeURIComponent(snapshot.file.path)}`)); } catch (error) { model.setError(error?.message ?? error); } finally { model.setLoading(false); } repaint(); }
      };
      const input = (event) => { if (event.target.matches?.('[data-workroom-editor]')) { model.setDraftContent(event.target.value); const save = root.querySelector('[data-workroom-action="save"]'); if (save) save.disabled = !model.snapshot().dirty; } if (event.target.matches?.('[data-workroom-filter]')) { const query = event.target.value.toLowerCase(); root.querySelectorAll('[data-workroom-tree] [data-workroom-file], [data-workroom-tree] [data-workroom-directory]').forEach((entry) => { entry.hidden = query && !entry.textContent.toLowerCase().includes(query); }); } };
      root.addEventListener('click', click); root.addEventListener('input', input); return () => { root.removeEventListener('click', click); root.removeEventListener('input', input); root = null; };
    },
  }; return view;
} });

router.register({ id: 'control-plane', pattern: /^\/control-plane(?:\/.*)?$/, cache: 'path', title: 'Control Plane', load: async () => {
  const [{ createControlPlaneModel, renderControlPlaneShell }, { loadControlPlaneDomain, renderControlPlaneDomain }, { hasLiveDomainWorkspace, loadLiveDomainWorkspace, renderLiveDomainWorkspace }, browserView] = await Promise.all([import('./control-plane/control-plane-shell.16b2445756a3.mjs'), import('./control-plane/route-registry.9618b9125830.mjs'), import('./control-plane/live-domain-workspace.73e57324bd84.mjs'), import('./views/browser/browser-view.19d4193e41cd.mjs')]);
  const model=createControlPlaneModel({loader:loadControlPlaneDomain});let active=await model.navigate(location.hash.slice(1)||'/control-plane/overview');if(typeof active.module?.loadAgentKernelSnapshot==='function')await active.module.loadAgentKernelSnapshot({api});let capabilityModel=active.domain==='capabilities'?active.module.buildCapabilitiesViewModel():null;let root=null;
  const [projectPayload,missionPayload]=await Promise.all([api.get('/api/projects').catch(()=>[]),api.get('/api/missions').catch(()=>[])]);const projects=Array.isArray(projectPayload)?projectPayload:projectPayload?.projects??[];const missions=Array.isArray(missionPayload)?missionPayload:missionPayload?.missions??[];const mission=missions[0]??null;const projectId=activeProjectId??mission?.projectId??projects[0]?.id??null;const missionId=mission?.id??null;const goalId=mission?.metadata?.goalId??mission?.goalId??null;let skillQuery='';let skillCatalog='';let skillReloadTimer=null;const isBrowserWorkspace=active.domain==='runtime'&&active.subroute==='browser';let browserController=isBrowserWorkspace?browserView.createBrowserWorkspaceController({api,projectId,missionId,goalId,language:cachedPreferences.language}):null;if(browserController)await browserController.load();let liveWorkspace=!isBrowserWorkspace&&hasLiveDomainWorkspace(active.domain)?await loadLiveDomainWorkspace({api,domain:active.domain,projectId,missionId,language:cachedPreferences.language,skillQuery,skillCatalog}):null;
  const content=()=>browserController?browserView.renderBrowserWorkspace(browserController.snapshot()):active.domain==='capabilities'?active.module.renderCapabilitiesView({...capabilityModel,language:cachedPreferences.language}):liveWorkspace?renderLiveDomainWorkspace(liveWorkspace):renderControlPlaneDomain(active.domain,active.module,{language:cachedPreferences.language});
  const refreshLive=async(button)=>{if(browserController){button?.setAttribute('disabled','');button?.setAttribute('aria-busy','true');await browserController.refresh();if(root)root.innerHTML=view.render();return;}if(!liveWorkspace)return;button?.setAttribute('disabled','');button?.setAttribute('aria-busy','true');liveWorkspace=await loadLiveDomainWorkspace({api,domain:active.domain,projectId,missionId,language:cachedPreferences.language,skillQuery,skillCatalog});if(root)root.innerHTML=view.render();};
  const reloadSkills=async()=>{liveWorkspace=await loadLiveDomainWorkspace({api,domain:active.domain,projectId,missionId,language:cachedPreferences.language,skillQuery,skillCatalog});if(root)rerenderView(root,view);};
  const view={experienceLevel:'expert',render:()=>renderControlPlaneShell(model.snapshot(),{content:content(),language:cachedPreferences.language}),mount(node){root=node;const click=async e=>{const refresh=e.target.closest('[data-control-action="refresh"]');const browserAction=e.target.closest('[data-browser-action]');if(browserAction&&browserController){browserAction.disabled=true;try{if(browserAction.dataset.browserAction==='refresh')await refreshLive(browserAction);if(browserAction.dataset.browserAction==='screenshot')await browserController.captureScreenshot();if(browserAction.dataset.browserAction==='close')await browserController.close();}finally{browserAction.disabled=false;}if(root)root.innerHTML=view.render();return;}if(refresh&&liveWorkspace){await refreshLive(refresh);return;}const skill=e.target.closest('[data-skill-id]');if(skill&&active.domain==='extensions'){skill.setAttribute('aria-busy','true');try{const preview=await api.post(`/api/skills/catalog/${encodeURIComponent(skill.dataset.skillId)}/load`,{});liveWorkspace=Object.freeze({...liveWorkspace,skillPreview:preview});if(root)root.innerHTML=view.render();}catch(error){alert(String(error?.payload?.error??error?.message??error));}finally{skill.removeAttribute('aria-busy');}return;}if(active.domain!=='capabilities')return;const domain=e.target.closest('[data-atlas-domain]');const method=e.target.closest('[data-atlas-method]');if(domain)capabilityModel=active.module.buildCapabilitiesViewModel({...capabilityModel,domain:domain.dataset.atlasDomain||null});if(method)capabilityModel=active.module.buildCapabilitiesViewModel({...capabilityModel,method:method.dataset.atlasMethod});if(domain||method)root.innerHTML=view.render();};const input=e=>{if(active.domain==='extensions'&&e.target.matches('[data-skill-catalog-search]')){skillQuery=e.target.value;clearTimeout(skillReloadTimer);skillReloadTimer=setTimeout(()=>reloadSkills().catch(()=>{}),180);return;}if(active.domain==='capabilities'&&e.target.matches('[data-atlas-search]')){capabilityModel=active.module.buildCapabilitiesViewModel({...capabilityModel,query:e.target.value});rerenderView(root,view);}};const change=e=>{if(active.domain==='extensions'&&e.target.matches('[data-skill-catalog-filter]')){skillCatalog=e.target.value;reloadSkills().catch(()=>{});}};root.addEventListener('click',click);root.addEventListener('input',input);root.addEventListener('change',change);return()=>{clearTimeout(skillReloadTimer);root.removeEventListener('click',click);root.removeEventListener('input',input);root.removeEventListener('change',change)}}};return view;
} });

router.register({ id: 'search', pattern: /^\/search(?:\?.*)?$/, title: 'Search', load: async () => { const { createSearchController, renderSearchView } = await import('./views/search/search-view.ee171128c331.mjs');const controller=createSearchController({api,language:cachedPreferences.language,capabilities:BACKEND_ATLAS.entries});await controller.load();let root=null;const view={render:()=>renderSearchView(controller.snapshot()),mount(node){root=node;const input=e=>{if(e.target.matches('[data-global-search-input]')){controller.setQuery(e.target.value);rerenderView(root,view);}};const click=e=>{const filter=e.target.closest('[data-search-filter]');if(filter){controller.setFilter(filter.dataset.searchFilter);root.innerHTML=view.render();root.querySelector('[data-global-search-input]')?.focus();}};root.addEventListener('input',input);root.addEventListener('click',click);return()=>{root.removeEventListener('input',input);root.removeEventListener('click',click)}}};return view; } });

router.register({ id: 'onboarding', pattern: '/onboarding', title: 'Welcome', load: async () => {
  const [{ createOnboardingController }, { renderOnboardingView }] = await Promise.all([import('./views/onboarding/onboarding-controller.8b0b3760245c.mjs'), import('./views/onboarding/onboarding-view.e0947ac6d1cb.mjs')]);
  const controller=createOnboardingController({api});await controller.load();let mountedRoot=null;let persistTimer=null;
  const rerender=()=>{if(mountedRoot)mountedRoot.innerHTML=renderOnboardingView(controller.snapshot());};
  const currentValue=(path)=>String(path).split('.').reduce((value,key)=>value?.[key],controller.snapshot().answers);
  const queuePersist=()=>{clearTimeout(persistTimer);persistTimer=setTimeout(async()=>{await controller.persist();rerender();},220);};
  const finish=async()=>{onboardingRequired=false;await reconcileEffectivePreferences();router.invalidate();const level=controller.snapshot().profile?.preferences?.experience?.level??controller.snapshot().answers?.experience??cachedPreferences.experience;location.hash=routeForExperience(level);};
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

router.register({ id: 'settings', pattern: '/settings', title: 'Settings', load: async () => {
  const [{ createSettingsController }, { renderSettingsView }] = await Promise.all([import('./views/settings/settings-controller.a1d1a3ca8897.mjs'), import('./views/settings/settings-view.3ebf56ca41e1.mjs')]);
  const controller=createSettingsController({api});await controller.load();let mountedRoot=null;let inputTimer=null;let authPollTimer=null;let authPollAttempts=0;
  const applySettingsPreview=({forcePreferencePaths=[]}={})=>{const draft=structuredClone(controller.snapshot().draft??{});const forced=new Set(forcePreferencePaths);draft.general??={};draft.appearance??={};if(draft.general.language==='system'&&!forced.has('general.language'))draft.general.language=cachedPreferences.language;if(draft.appearance.theme==='system'&&!forced.has('appearance.theme'))draft.appearance.theme=cachedPreferences.theme;cachedPreferences=applyPreferences(draft);return cachedPreferences;};
  const rerender=({preserveFocus=null,forcePreferencePaths=[]}={})=>{if(!mountedRoot)return;const viewState=captureViewState(mountedRoot);const focusPath=preserveFocus??document.activeElement?.dataset?.settingPath??null;applySettingsPreview({forcePreferencePaths});mountedRoot.innerHTML=renderSettingsView(controller.snapshot());restoreViewState(mountedRoot,viewState);if(focusPath)mountedRoot.querySelector(`[data-setting-path="${CSS.escape(focusPath)}"]`)?.focus({preventScroll:true});const pill=document.querySelector('[data-command="toggle-experience"]');if(pill)pill.querySelector('span:nth-child(2)').textContent=normalizeExperience(cachedPreferences.experience).replace(/^./,x=>x.toUpperCase());};
  const stopProviderAuthPolling=()=>{clearTimeout(authPollTimer);authPollTimer=null;authPollAttempts=0;};
  const startProviderAuthPolling=(providerId)=>{stopProviderAuthPolling();const tick=async()=>{authPollAttempts+=1;await controller.refreshProviders();rerender();const provider=controller.snapshot().providers.find((item)=>String(item.id)===String(providerId));if(provider?.authenticated===true||authPollAttempts>=60){stopProviderAuthPolling();return;}authPollTimer=setTimeout(()=>tick().catch(()=>{}),2000);};authPollTimer=setTimeout(()=>tick().catch(()=>{}),2000);};
  const parseControlValue=(control)=>{if(control.getAttribute('role')==='switch')return control.getAttribute('aria-checked')!=='true';if(control.type==='number')return control.value===''?null:Number(control.value);return control.value;};
  const activateCategory=(id)=>{controller.selectCategory(id);rerender();requestAnimationFrame(()=>document.querySelector(`#settings-${CSS.escape(id)}`)?.scrollIntoView({block:'start',behavior:cachedPreferences.motion==='reduced'?'auto':'smooth'}));};
  const click=async(event)=>{const category=event.target.closest?.('[data-settings-category-link]');if(category){event.preventDefault();activateCategory(category.dataset.settingsCategoryLink);return;}const experience=event.target.closest?.('[data-experience]');if(experience){controller.setExperience(experience.dataset.experience);rerender();return;}const choice=event.target.closest?.('[data-setting-choice]');if(choice){const path=choice.dataset.settingPath;const value=choice.dataset.settingValue;controller.set(path,value);if(path==='general.language'){await languageSync.preview(value,currentRouteState?.path??'/settings');return;}rerender({forcePreferencePaths:[path]});return;}const switchControl=event.target.closest?.('[data-setting-path][role="switch"]');if(switchControl){controller.set(switchControl.dataset.settingPath,parseControlValue(switchControl));rerender({preserveFocus:switchControl.dataset.settingPath});return;}const providerAuthAction=event.target.closest?.('[data-provider-auth-action]');if(providerAuthAction){providerAuthAction.disabled=true;const providerId=providerAuthAction.dataset.providerId;if(providerAuthAction.dataset.providerAuthAction==='login'){await controller.startProviderLogin(providerId,providerAuthAction.dataset.providerLoginMode);const login=controller.snapshot().providerLogin;if(login?.authUrl)window.open(login.authUrl,'_blank','noopener,noreferrer');if(!controller.snapshot().errors.length)startProviderAuthPolling(providerId);}if(providerAuthAction.dataset.providerAuthAction==='logout'){stopProviderAuthPolling();await controller.logoutProvider(providerId);}rerender();return;}const modelAction=event.target.closest?.('[data-model-action]');if(modelAction){const setupForm=modelAction.closest?.('[data-model-provider-setup]');const manualForm=modelAction.closest?.('[data-model-manual-form]');const setupDraft=setupForm?Object.fromEntries(new FormData(setupForm).entries()):null;const manualDraft=manualForm?Object.fromEntries(new FormData(manualForm).entries()):null;if(modelAction.dataset.modelAction==='configure')await controller.configureProvider({id:setupDraft?.id,kind:setupDraft?.kind,model:setupDraft?.model,baseUrl:setupDraft?.baseUrl,apiKey:setupDraft?.apiKey});if(modelAction.dataset.modelAction==='discover')await controller.discoverModels(modelAction.dataset.providerId);if(modelAction.dataset.modelAction==='add')await controller.addModel(modelAction.dataset.providerId,manualDraft?.modelId,manualDraft?.displayName);if(modelAction.dataset.modelAction==='probe')await controller.probeModel(modelAction.dataset.providerId,modelAction.dataset.modelId);if(modelAction.dataset.modelAction==='inspect')await controller.inspectModel(modelAction.dataset.modelId);if(modelAction.dataset.modelAction==='toggle-compare')controller.toggleModelComparison(modelAction.dataset.modelId);if(modelAction.dataset.modelAction==='compare')await controller.compareModels();if(modelAction.dataset.modelAction==='clear-compare')controller.clearModelComparison();rerender();if(setupDraft){const nextForm=mountedRoot?.querySelector?.('[data-model-provider-setup]');for(const name of ['id','kind','model','baseUrl']){const control=nextForm?.elements?.namedItem(name);if(control&&setupDraft[name]!=null)control.value=setupDraft[name];}const keyControl=nextForm?.elements?.namedItem('apiKey');if(keyControl)keyControl.value='';}return;}const action=event.target.closest?.('[data-settings-action]')?.dataset.settingsAction;if(!action)return;if(action==='save'){await controller.save();if(!controller.snapshot().errors?.length){await languageSync.commit(currentRouteState?.path??'/settings');return;}}if(action==='reset'){await controller.reset({paths:null});if(!controller.snapshot().errors?.length){await languageSync.commit(currentRouteState?.path??'/settings');return;}}if(action==='retry')await controller.load();if(action==='reset-layout'){layoutStore.reset();layoutStore.apply(document.documentElement);}if(action==='export'){const payload=JSON.stringify({exportedAt:new Date().toISOString(),settings:controller.snapshot().value},null,2);const url=URL.createObjectURL(new Blob([payload],{type:'application/json'}));const anchor=Object.assign(document.createElement('a'),{href:url,download:'nolane-settings.json'});anchor.click();URL.revokeObjectURL(url);}rerender();};
  const input=async(event)=>{if(event.target.matches?.('[data-settings-search]')){clearTimeout(inputTimer);inputTimer=setTimeout(()=>{controller.search(event.target.value);rerender();},80);return;}const control=event.target.closest?.('[data-setting-path]');if(!control||control.getAttribute('role')==='switch')return;const path=control.dataset.settingPath;const value=parseControlValue(control);controller.set(path,value);if(path==='general.language'){await languageSync.preview(value,currentRouteState?.path??'/settings');return;}rerender({preserveFocus:path,forcePreferencePaths:[path]});};
  const change=(event)=>{if(event.target.matches?.('[data-settings-layer]')){try{controller.setLayer(event.target.value)}catch{}rerender();}};
  return {shellMode:'settings',experienceLevel:normalizeExperience(controller.snapshot().experience),render:()=>renderSettingsView(controller.snapshot()),mount(root){mountedRoot=root;root.addEventListener('click',click);root.addEventListener('input',input);root.addEventListener('change',change);applySettingsPreview();return()=>{clearTimeout(inputTimer);stopProviderAuthPolling();root.removeEventListener('click',click);root.removeEventListener('input',input);root.removeEventListener('change',change);mountedRoot=null;}},controller};
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

window.addEventListener('nolane:project-selected',(event)=>{activeProjectId=String(event.detail?.projectId ?? '')||null;syncProjectSelection(activeProjectId);});
window.addEventListener('nolane:project-create-requested',requestProjectCreation);
window.addEventListener('hashchange',()=>{const path=location.hash.slice(1)||'/';if(onboardingRequired&&path!=='/onboarding'){location.hash='/onboarding';return;}render(path);});
document.addEventListener('click',async(event)=>{
  const pickerToggle=event.target.closest?.('[data-project-picker-toggle]'); if(pickerToggle){event.preventDefault();const picker=pickerToggle.closest('[data-project-picker]');const menu=picker?.querySelector('[data-project-picker-menu]');if(menu){const open=menu.hidden;menu.hidden=!open;pickerToggle.setAttribute('aria-expanded',String(open));if(open)requestAnimationFrame(()=>menu.querySelector('[data-project-search]')?.focus({preventScroll:true}));}return;}
  const projectChoice=event.target.closest?.('[data-project-choice]'); if(projectChoice){event.preventDefault();const id=String(projectChoice.dataset.projectId??'');window.dispatchEvent(new CustomEvent('nolane:project-selected',{detail:{projectId:id,source:'sidebar'}}));return;}
  const projectAction=event.target.closest?.('[data-project-action]'); if(projectAction && ['new','none'].includes(projectAction.dataset.projectAction)){event.preventDefault();if(projectAction.dataset.projectAction==='new'){await requestProjectCreation();}else{window.dispatchEvent(new CustomEvent('nolane:project-selected',{detail:{projectId:'',source:'sidebar'}}));}return;}
  if(!event.target.closest?.('[data-project-picker]'))document.querySelectorAll('[data-project-picker-menu]').forEach((menu)=>{menu.hidden=true;menu.closest('[data-project-picker]')?.querySelector('[data-project-picker-toggle]')?.setAttribute('aria-expanded','false');});
  const link=event.target.closest?.('[data-route]');if(link){event.preventDefault();location.hash=link.dataset.route;return;}
  if(event.target.closest?.('[data-command="new-mission"]')){location.hash='/';requestAnimationFrame(()=>document.querySelector('#objective')?.focus());return;}
  if(event.target.closest?.('[data-command="global-search"]')){location.hash='/search';return;}
  if(event.target.closest?.('[data-command="open-sidebar"]')){layoutStore.update({sidebarCollapsed:false});layoutStore.apply(document.documentElement);document.querySelector('.app-shell')?.setAttribute('data-sidebar-collapsed','false');document.querySelector('.session-sidebar')?.setAttribute('data-open','true');return;}
  if(event.target.closest?.('[data-command="collapse-sidebar"]')){layoutStore.update({sidebarCollapsed:true});layoutStore.apply(document.documentElement);document.querySelector('.app-shell')?.setAttribute('data-sidebar-collapsed','true');document.querySelector('.session-sidebar')?.removeAttribute('data-open');return;}
  const summaryAction=event.target.closest?.('[data-summary-action]')?.dataset.summaryAction;if(event.target.closest?.('[data-command="toggle-summary"]')){await summaryController.toggle();renderSummary();persistCurrentSession();return;}if(summaryAction==='close'){summaryController.close();renderSummary();persistCurrentSession();return;}if(summaryAction==='refresh'){await summaryController.refresh();renderSummary();return;}if(summaryAction==='manage-sources'){summaryController.close();location.hash='/control-plane/extensions/mcp';return;}const stop=event.target.closest?.('[data-stop-process]');if(stop){stop.disabled=true;await summaryController.stopProcess(stop.dataset.stopProcess).catch(()=>{});renderSummary();return;}
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
  await Promise.all([reconcileEffectivePreferences(),sessionRestore.load(),updateStateController.load()]);
  const explicitPath=location.hash.slice(1);let path=explicitPath||sessionRestore.snapshot().restore?.activeRoute||'/';
  try { const status=await api.get('/api/onboarding/status');onboardingRequired=Boolean(status?.required);if(onboardingRequired)path='/onboarding';else if(path==='/onboarding')path=routeForExperience(); } catch { onboardingRequired=false; }
  await render(path);
})();
