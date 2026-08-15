import { icon } from '../../core/icon.5ea9db6f3c96.mjs';
import { t } from '../../core/i18n.0f823aa4a7e8.mjs';
import { renderProjectPicker } from '../../shell/project-picker.8ccb0556ed1f.mjs';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[character]);
const arr = (payload, keys = []) => { if (Array.isArray(payload)) return payload; for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key]; return []; };
const selectedSkillIds = (values, skills = []) => {
  const known = new Set((skills ?? []).map((skill) => String(skill?.id ?? skill?.name ?? '').trim()).filter(Boolean));
  return Object.freeze([...new Set((Array.isArray(values) ? values : []).map((value) => String(value ?? '').trim()).filter((id) => known.has(id)))].slice(0, 8));
};
const statusTone = (status) => ['failed','error','blocked'].includes(status) ? 'danger' : ['running','planning','testing'].includes(status) ? 'active' : ['completed','verified','ready'].includes(status) ? 'success' : 'neutral';
function missionErrorMessage(error, language = 'en') {
  const code = String(error?.payload?.code ?? '');
  const vi = language === 'vi';
  const messages = {
    PROJECT_REQUIRED: vi ? 'Hãy chọn một dự án trước khi gửi nhiệm vụ.' : 'Choose a project before sending a mission.',
    PROJECT_NOT_FOUND: vi ? 'Dự án đã chọn không còn khả dụng. Hãy chọn lại dự án.' : 'The selected project is no longer available. Choose another project.',
    OBJECTIVE_REQUIRED: vi ? 'Hãy nhập mục tiêu nhiệm vụ trước khi gửi.' : 'Enter a mission objective before sending.',
    PLANNING_INPUT_REQUIRED: vi ? 'Mục tiêu cần rõ kết quả mong muốn, hành vi bị ảnh hưởng và điều kiện thành công.' : 'Add the desired outcome, affected behavior, and success condition before sending.',
    RUNTIME_ADMISSION_BLOCKED: vi ? 'Runtime đang giảm tải để bảo vệ bộ nhớ. Hãy chờ một lát rồi thử lại.' : 'The runtime is conserving memory. Wait a moment and try again.',
    PROVIDER_SETUP_REQUIRED: vi ? 'Hãy đăng nhập và kiểm tra ít nhất một provider trước khi gửi.' : 'Sign in to and verify at least one provider before sending.',
    SELECTED_MODEL_NOT_READY: vi ? 'Model đã chọn chưa sẵn sàng. Hãy đăng nhập hoặc kiểm tra provider trước khi gửi.' : 'The selected model is not ready. Sign in to or verify its provider before sending.',
    PROVIDER_WORKSPACE_TRUST_REQUIRED: vi ? 'Provider yêu cầu một workspace Git đáng tin cậy. Hãy chọn hoặc mở lại dự án.' : 'The provider requires a trusted Git workspace. Choose or reopen the project.',
    PROVIDER_EXECUTION_FAILED: vi ? 'Provider không hoàn tất yêu cầu. Hãy kiểm tra đăng nhập, model và thử lại.' : 'The provider could not complete the request. Check authentication and model readiness, then retry.',
  };
  return messages[code] ?? String(error?.message ?? error ?? (vi ? 'Không thể gửi nhiệm vụ.' : 'Unable to send the mission.'));
}

export function modelDeploymentKey(item = {}) {
  const explicit = String(item.deploymentKey ?? '').trim();
  if (explicit) return explicit;
  const providerId = String(item.providerId ?? item.provider ?? '').trim() || 'unknown';
  const rawKey = String(item.key ?? '').trim();
  const keyModel = rawKey.startsWith(`${providerId}/`) ? rawKey.slice(providerId.length + 1) : '';
  const modelId = String(item.modelId ?? item.model ?? keyModel ?? item.id ?? '').trim() || 'default';
  return `${providerId}/${modelId}`;
}

function modelIdFor(item = {}) {
  const key = modelDeploymentKey(item);
  const providerId = String(item.providerId ?? item.provider ?? '').trim();
  if (item.modelId ?? item.model) return String(item.modelId ?? item.model);
  if (providerId && key.startsWith(`${providerId}/`)) return key.slice(providerId.length + 1);
  return key.split('/').slice(1).join('/') || 'default';
}

function selectedDeployment(models, selection) {
  if (selection === 'auto') return null;
  const item = models.find((candidate) => modelDeploymentKey(candidate) === selection);
  if (item) return { providerId: String(item.providerId ?? item.provider ?? ''), modelId: modelIdFor(item), deploymentKey: selection };
  const [providerId, ...rest] = String(selection ?? '').split('/');
  return providerId ? { providerId, modelId: rest.join('/') || 'default', deploymentKey: selection } : null;
}

function selectedModelProfile(models, selection) {
  return (models ?? []).find((item) => modelDeploymentKey(item) === selection) ?? null;
}

function reasoningEfforts(profile) {
  if (String(profile?.providerId ?? profile?.provider ?? '') !== 'codex-app-server') return [];
  const values = Array.isArray(profile?.metadata?.supportedReasoningEfforts) ? profile.metadata.supportedReasoningEfforts : [];
  return [...new Set(values.map((item) => String(typeof item === 'object' ? item?.reasoningEffort : item).trim().toLowerCase()).filter(Boolean))];
}

function defaultReasoningEffort(profile, efforts) {
  const preferred = String(profile?.metadata?.defaultReasoningEffort ?? '').trim().toLowerCase();
  return efforts.includes(preferred) ? preferred : (efforts[0] ?? null);
}

function normalizedReasoningEffort(models, selectedModel, requestedEffort) {
  const efforts = reasoningEfforts(selectedModelProfile(models, selectedModel));
  const selected = String(requestedEffort ?? '').trim().toLowerCase();
  return efforts.includes(selected) ? selected : defaultReasoningEffort(selectedModelProfile(models, selectedModel), efforts);
}

function providerIsReady(provider) {
  if (!provider || provider.executionSafety === 'external-plan-config-required') return false;
  return (provider.available === true && provider.authenticated === true && provider.healthy === true)
    || ['ready', 'connected'].includes(provider.state ?? provider.status);
}

function readyModelProfiles(models, providers) {
  const byProvider = new Map((providers ?? []).map((provider) => [String(provider?.id ?? ''), provider]));
  if (byProvider.size === 0) return models;
  return models.filter((model) => providerIsReady(byProvider.get(String(model?.providerId ?? model?.provider ?? ''))));
}

export function buildHomeViewModel({ repositoryState = 'unknown', suggestions = [], project = null, projects = [], missions = [], providers = [], models = [], tools = [], commands = [], skills = [], plugins = [], language = 'en', loading = false, error = null, menu = null, intent = 'ask', selectedProjectId = null, selectedModel = 'auto', selectedEffort = null, selectedSkillIds: requestedSkillIds = [], submitting = false, projectMenuOpen = false, projectQuery = '' } = {}) {
  const evidenceBacked = repositoryState === 'ready'
    ? suggestions.filter((item) => Array.isArray(item.evidenceIds) && item.evidenceIds.length > 0).slice(0, 3).map((item) => Object.freeze({ ...item }))
    : [];
  const normalizedSkillIds = selectedSkillIds(requestedSkillIds, skills);
  const selectedSkills = Object.freeze(normalizedSkillIds.map((id) => {
    const skill = skills.find((item) => String(item?.id ?? item?.name ?? '') === id) ?? {};
    return Object.freeze({ id, title: String(skill?.title ?? skill?.name ?? id), source: String(skill?.source ?? skill?.catalog ?? '') });
  }));
  return Object.freeze({
    product: 'Nolane Agent', title: t('home.title',language), subtitle:t('home.subtitle',language), project,
    repositoryState, repositoryMessage: repositoryState === 'indexing' ? (language === 'vi' ? 'Nolane đang đọc dự án này…' : 'Nolane is reading this project…') : null,
    suggestions: Object.freeze(evidenceBacked), projects:Object.freeze(projects), missions:Object.freeze(missions), providers:Object.freeze(providers), models:Object.freeze(models), tools:Object.freeze(tools), commands:Object.freeze(commands), skills:Object.freeze(skills), selectedSkillIds: normalizedSkillIds, selectedSkills, plugins:Object.freeze(plugins), language, loading, error, menu, intent, selectedProjectId:selectedProjectId ?? projects[0]?.id ?? '', selectedModel, selectedEffort: normalizedReasoningEffort(models, selectedModel, selectedEffort), submitting, projectMenuOpen, projectQuery,
  });
}

function interleave(groups) {
  const count = Math.max(0, ...groups.map((items) => items.length));
  const items = [];
  for (let index = 0; index < count; index += 1) for (const group of groups) if (group[index]) items.push(group[index]);
  return items;
}
function contextItems(model) {
  const projectItems = model.projects.map((item) => ({ type:'project', id:item.id, label:item.name ?? item.path ?? item.id, detail:item.path ?? '', icon:'projects' }));
  const modelItems = model.models.map((item) => ({ type:'model', id:modelDeploymentKey(item), label:item.displayName ?? modelIdFor(item), detail:`${item.providerId ?? ''} · ${modelIdFor(item)}`, icon:'model' }));
  const providerItems = model.providers.map((item) => ({ type:'provider', id:item.id, label:item.label ?? item.id, detail:item.state ?? item.status ?? '', icon:'globe' }));
  const toolItems = model.tools.map((item) => ({ type:'tool', id:item.name ?? item.id, label:item.title ?? item.name ?? item.id, detail:item.server ?? item.description ?? '', icon:'tool' }));
  const skillItems = model.skills.map((item) => ({ type:'skill', id:item.id ?? item.name, label:item.name ?? item.title ?? item.id, detail:[item.source ?? 'ForgeOS', item.maturity ?? item.status].filter(Boolean).join(' · '), icon:'spark' }));
  const pluginItems = model.plugins.map((item) => ({ type:'plugin', id:item.id ?? item.name, label:item.name ?? item.title ?? item.id, detail:item.state ?? item.status ?? 'installed', icon:'control' }));
  return interleave([projectItems,modelItems,providerItems,toolItems,skillItems,pluginItems]);
}
function commandItems(model) {
  const vi = model.language === 'vi';
  const local = [
    {id:'ask',title:vi?'Hỏi mà không đổi tệp':'Ask without changing files',description:vi?'Chỉ đọc và giải thích':'Read and explain only'},
    {id:'plan',title:vi?'Tạo kế hoạch có thể kiểm chứng':'Create a verified plan',description:vi?'Lập kế hoạch trước mọi thay đổi':'Plan before any changes'},
    {id:'build',title:vi?'Xây dựng với ranh giới phê duyệt':'Build with approval boundaries',description:vi?'Sửa, chạy và kiểm chứng':'Edit, run, and verify'},
    {id:'verify',title:vi?'Kiểm tra công việc hiện tại':'Verify existing work',description:vi?'Chạy kiểm tra mà không mở rộng phạm vi':'Run checks without expanding scope'},
    {id:'clear',title:vi?'Xóa nội dung soạn thảo':'Clear composer',description:vi?'Xóa bản nháp hiện tại':'Remove the current draft'},
  ];
  const remote = model.commands.map((item) => ({ id:item.id ?? item.name, title:item.title ?? item.label ?? item.name ?? item.id, description:item.description ?? item.summary ?? '' }));
  const seen = new Set(); return [...local,...remote].filter((item) => item.id && !seen.has(item.id) && seen.add(item.id));
}
function renderMenu(model) {
  if (!model.menu) return '';
  const items = model.menu.type === 'context' ? contextItems(model) : commandItems(model).map((item)=>({...item,type:'command',label:item.title,detail:item.description,icon:'command'}));
  const query = String(model.menu.query ?? '').toLowerCase();
  const filtered = items.filter((item)=>!query || `${item.type} ${item.label} ${item.detail} ${item.id}`.toLowerCase().includes(query)).slice(0,14);
  const vi = model.language === 'vi';
  const contextMenu = model.menu.type === 'context';
  const menuLabel = contextMenu ? (vi ? 'Ngữ cảnh' : 'Context') : (vi ? 'Lệnh' : 'Commands');
  const menuTitle = contextMenu ? (vi ? 'Thêm ngữ cảnh' : 'Add context') : (vi ? 'Chạy một lệnh' : 'Run a command');
  const emptyLabel = vi ? 'Không có mục phù hợp' : 'No matching items';
  return `<div class="composer-menu" data-menu-type="${model.menu.type}" role="listbox" aria-label="${menuLabel}"><header><span>${contextMenu ? icon('paperclip',{size:15}) : icon('command',{size:15})}</span><strong>${menuTitle}</strong><kbd>Esc</kbd></header><div>${filtered.length ? filtered.map((item,index)=>`<button type="button" role="option" aria-selected="${index===0}" data-menu-index="${index}" data-menu-kind="${esc(item.type)}" data-menu-id="${esc(item.id)}" data-menu-label="${esc(item.label)}"><span class="composer-menu__icon">${icon(item.icon ?? 'spark',{size:16})}</span><span><strong>${esc(item.label)}</strong><small>${esc(item.detail || item.id)}</small></span><em>${esc(item.type)}</em></button>`).join('') : `<p class="composer-menu__empty">${emptyLabel}</p>`}</div></div>`;
}
function intentOptions(model) {
  const vi = model.language === 'vi';
  return [
    { value: 'ask', label: t('home.ask', model.language), detail: vi ? 'Đọc, giải thích, không sửa tệp' : 'Read and explain without editing' },
    { value: 'plan', label: t('home.plan', model.language), detail: vi ? 'Lập kế hoạch có thể duyệt' : 'Create a reviewable plan' },
    { value: 'build', label: t('home.build', model.language), detail: vi ? 'Thực hiện thay đổi và kiểm thử' : 'Make changes and run checks' },
    { value: 'verify', label: t('home.verify', model.language), detail: vi ? 'Kiểm tra hiện trạng, không mở rộng phạm vi' : 'Verify current work without expanding scope' },
  ];
}

function modelPickerOptions(model) {
  const vi = model.language === 'vi';
  const ready = readyModelProfiles(model.models, model.providers);
  const options = [
    { value: 'auto', label: t('home.model', model.language), detail: vi ? 'Định tuyến theo provider sẵn sàng' : 'Route through the best ready provider' },
    ...ready.map((item) => {
      const value = modelDeploymentKey(item);
      const providerId = String(item.providerId ?? item.provider ?? '').trim();
      const modelId = modelIdFor(item);
      return { value, label: String(item.displayName ?? modelId), detail: `${providerId || 'unknown'} · ${modelId}` };
    }),
  ];
  const selected = String(model.selectedModel ?? 'auto');
  if (selected === 'auto' || options.some((item) => item.value === selected)) return options;
  const unavailable = model.models.find((item) => modelDeploymentKey(item) === selected);
  const deployment = selectedDeployment(model.models, selected);
  const providerId = String(unavailable?.providerId ?? unavailable?.provider ?? deployment?.providerId ?? 'unknown').trim() || 'unknown';
  const modelId = unavailable ? modelIdFor(unavailable) : (deployment?.modelId || 'unknown');
  const notReady = vi ? 'Chưa sẵn sàng' : 'Not ready';
  return [...options, {
    value: selected,
    label: `${String(unavailable?.displayName ?? modelId)} — ${notReady}`,
    detail: `${providerId} · ${modelId} · ${notReady}`,
    disabled: true,
  }];
}

function reasoningEffortOptions(model) {
  const profile = selectedModelProfile(model.models, model.selectedModel);
  const values = reasoningEfforts(profile);
  const labels = {
    none: model.language === 'vi' ? 'Không suy luận' : 'No reasoning',
    minimal: model.language === 'vi' ? 'Tối thiểu' : 'Minimal',
    low: model.language === 'vi' ? 'Thấp' : 'Low',
    medium: model.language === 'vi' ? 'Trung bình' : 'Medium',
    high: model.language === 'vi' ? 'Cao' : 'High',
    xhigh: model.language === 'vi' ? 'Rất cao' : 'Extra high',
  };
  return values.map((value) => ({ value, label: labels[value] ?? value, detail: model.language === 'vi' ? 'Mức suy luận của Codex cho lượt này' : 'Codex reasoning effort for this turn' }));
}

function renderComposerPicker({ name, ariaLabel, iconName, selected, options, className = '', searchable = false, searchLabel = '' }) {
  const chosen = options.find((item) => item.value === selected) ?? options[0];
  const menuId = `composer-${name}-menu`;
  const search = searchable ? `<label class="composer-select__search"><span class="sr-only">${esc(searchLabel)}</span><input type="search" data-composer-picker-search placeholder="${esc(searchLabel)}" autocomplete="off" spellcheck="false"></label>` : '';
  return `<div class="composer-select ${esc(className)}" data-composer-picker="${esc(name)}">
    <input type="hidden" name="${esc(name)}" value="${esc(chosen?.value ?? '')}" data-picker-value>
    <button type="button" class="composer-select__trigger" data-composer-picker-toggle aria-label="${esc(ariaLabel)}" aria-haspopup="listbox" aria-expanded="false" aria-controls="${menuId}">
      <span class="composer-select__icon">${icon(iconName, { size: 14 })}</span><span class="composer-select__label" data-picker-label>${esc(chosen?.label ?? '')}</span><span class="composer-select__chevron">${icon('chevron', { size: 14 })}</span>
    </button>
    <div id="${menuId}" class="composer-select__menu" data-composer-picker-menu role="listbox" aria-label="${esc(ariaLabel)}" hidden>
      ${search}${options.map((item) => `<button type="button" role="option" class="composer-select__option" data-composer-picker-option data-picker-value="${esc(item.value)}" data-picker-label="${esc(item.label)}" aria-selected="${String(item.value === chosen?.value)}"${item.disabled ? ' disabled aria-disabled="true"' : ''}><span class="composer-select__option-copy"><strong>${esc(item.label)}</strong><small>${esc(item.detail ?? '')}</small></span>${item.value === chosen?.value ? icon('check', { size: 14, className: 'composer-select__check' }) : ''}</button>`).join('')}
    </div>
  </div>`;
}

function renderMissionCard(item, language) {
  const status = item.status ?? item.state ?? 'draft'; const title = item.objective ?? item.title ?? item.name ?? item.id;
  const time = item.updatedAt ?? item.createdAt; const when = time ? new Date(Number(time) > 1e12 ? Number(time) : time).toLocaleString(language==='vi'?'vi-VN':'en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
  return `<a class="recent-mission" href="#/missions?id=${encodeURIComponent(item.id)}" data-route="/missions?id=${encodeURIComponent(item.id)}"><span class="recent-mission__status" data-tone="${statusTone(status)}">${icon(statusTone(status)==='success'?'check':statusTone(status)==='danger'?'warning':'activity',{size:15})}</span><span class="recent-mission__copy"><strong>${esc(title)}</strong><small>${esc(item.projectName ?? item.projectId ?? '')}${when ? ` · ${esc(when)}`:''}</small></span><span class="recent-mission__badge" data-tone="${statusTone(status)}">${esc(status.replaceAll('_',' '))}</span>${icon('arrow',{size:15,className:'recent-mission__arrow'})}</a>`;
}
function renderSelectedSkills(model) {
  if (!model.selectedSkills.length) return '';
  const vi = model.language === 'vi';
  const title = vi ? 'Skill đã chọn' : 'Selected skills';
  const remove = vi ? 'Bỏ skill' : 'Remove skill';
  return `<div class="composer-selected-skills" role="list" aria-label="${title}">${model.selectedSkills.map((skill) => `<span class="composer-selected-skill" role="listitem" data-selected-skill-id="${esc(skill.id)}"><span class="composer-selected-skill__icon">${icon('spark',{size:13})}</span><span class="composer-selected-skill__copy"><strong>${esc(skill.title)}</strong>${skill.source ? `<small>${esc(skill.source)}</small>` : ''}</span><button type="button" data-selected-skill-remove="${esc(skill.id)}" aria-label="${esc(`${remove}: ${skill.title}`)}">×</button></span>`).join('')}</div>`;
}
export function renderHomeView(model = buildHomeViewModel()) {
  const recent = model.missions.slice(0,6);
  const providersReady = model.providers.filter(providerIsReady).length;
  const modelOptions = modelPickerOptions(model);
  const effortOptions = reasoningEffortOptions(model);
  const selectedModelReady = model.selectedModel === 'auto' || readyModelProfiles(model.models, model.providers).some((item) => modelDeploymentKey(item) === model.selectedModel);
  const providerStatus = providersReady ? (model.language === 'vi' ? `${providersReady} provider sẵn sàng` : `${providersReady} provider${providersReady===1?'':'s'} ready`) : t('home.providerRequired',model.language);
  const runtimeStatus = selectedModelReady ? providerStatus : (model.language === 'vi' ? 'Model đã chọn chưa sẵn sàng. Hãy chọn model khác hoặc đăng nhập provider đó.' : 'Selected model is not ready. Choose another model or sign in to its provider.');
  const quick = [
    {icon:'file',title:model.language==='vi'?'Tóm tắt kho mã':'Understand this codebase',text:model.language==='vi'?'Đọc cấu trúc và giải thích dự án':'Map architecture and explain the project',intent:'ask'},
    {icon:'warning',title:model.language==='vi'?'Sửa lỗi và kiểm thử':'Fix a bug and verify',text:model.language==='vi'?'Điều tra, sửa và chạy kiểm tra':'Investigate, patch, and run checks',intent:'build'},
    {icon:'branch',title:model.language==='vi'?'Lập kế hoạch tính năng':'Plan a feature',text:model.language==='vi'?'Tạo kế hoạch có thể duyệt':'Create a reviewable implementation plan',intent:'plan'},
    {icon:'evidence',title:model.language==='vi'?'Duyệt thay đổi':'Review current changes',text:model.language==='vi'?'Kiểm tra diff, rủi ro và bằng chứng':'Inspect diffs, risk, and evidence',intent:'verify'},
  ];
  return `<section class="home-view" data-status="${model.loading?'loading':'ready'}">
    <div class="home-intro"><div class="home-intro__copy"><p class="eyebrow">${esc(t('home.kicker',model.language))}</p><h1>${esc(model.title)}</h1><p class="home-subtitle">${esc(model.subtitle)}</p></div>
      <form id="mission-composer" class="mission-composer" autocomplete="off">
        <div class="composer-context-row"><div class="composer-project-control" aria-label="${t('home.project',model.language)}">${renderProjectPicker({ id:'home-project-picker', projects:model.projects, selectedProjectId:model.selectedProjectId, language:model.language, open:model.projectMenuOpen, query:model.projectQuery, mode:'composer', name:'projectId' })}</div><span class="composer-runtime" data-state="${providersReady&&selectedModelReady?'ready':'limited'}" role="status" aria-live="polite"><i data-state="${providersReady&&selectedModelReady?'ready':'limited'}"></i>${runtimeStatus}</span></div>${renderSelectedSkills(model)}
        <label class="composer-input"><span class="sr-only">${t('home.objective',model.language)}</span><textarea id="objective" name="objective" rows="3" placeholder="${esc(t('home.placeholder',model.language))}" required></textarea>${renderMenu(model)}</label>
        <div class="composer-footer"><div class="composer-tools"><button type="button" data-action="attach" aria-label="${t('home.attach',model.language)}">${icon('paperclip',{size:17})}<span>${t('home.attach',model.language)}</span></button><button type="button" data-action="open-context" aria-label="${model.language==='vi'?'Thêm ngữ cảnh':'Add context'}">@</button><button type="button" data-action="open-commands" aria-label="${model.language==='vi'?'Mở danh sách lệnh':'Open commands'}">/</button></div><div class="composer-send">${renderComposerPicker({ name:'intent', ariaLabel:t('home.intent',model.language), iconName:'spark', selected:model.intent, options:intentOptions(model) })}${renderComposerPicker({ name:'modelChoice', ariaLabel:t('common.model',model.language), iconName:'model', selected:model.selectedModel, options:modelOptions, className:'composer-select--model', searchable:modelOptions.length>12, searchLabel:model.language==='vi'?'Tìm model…':'Search models…' })}${effortOptions.length ? renderComposerPicker({ name:'planningEffort', ariaLabel:model.language==='vi'?'Mức suy luận':'Reasoning effort', iconName:'activity', selected:model.selectedEffort, options:effortOptions, className:'composer-select--effort' }) : ''}<button class="composer-submit" type="submit"${model.submitting||!model.projects.length||!providersReady||!selectedModelReady?' disabled':''}>${model.submitting?'<span class="spinner"></span>':icon('send',{size:17})}<span>${t('home.send',model.language)}</span></button></div></div>
      </form>${model.error?`<div class="home-error" role="alert">${icon('warning',{size:16})}<span>${esc(model.error)}</span></div>`:''}
    </div>
    <div class="home-content"><section class="home-section"><header><div><p class="eyebrow">${t('home.quick',model.language)}</p><h2>${model.language==='vi'?'Bạn muốn bắt đầu thế nào?':'Choose a starting point'}</h2></div><div class="home-section__actions"><a href="#/skills" data-route="/skills">${model.language==='vi'?'Kho skill':'Skill library'} ${icon('arrow',{size:14})}</a><a href="#/settings" data-route="/settings">${model.language==='vi'?'Tùy chỉnh':'Customize'} ${icon('arrow',{size:14})}</a></div></header><div class="capability-grid">${quick.map((item)=>`<button type="button" class="capability-card" data-quick-intent="${item.intent}" data-quick-text="${esc(item.title)}"><span>${icon(item.icon,{size:19})}</span><strong>${esc(item.title)}</strong><small>${esc(item.text)}</small>${icon('arrow',{size:15,className:'capability-card__arrow'})}</button>`).join('')}</div></section>
    <section class="home-section home-section--recent"><header><div><p class="eyebrow">${t('home.recent',model.language)}</p><h2>${model.language==='vi'?'Nhiệm vụ gần đây':'Recent work'}</h2></div><a href="#/missions" data-route="/missions">${model.language==='vi'?'Xem tất cả':'View all'} ${icon('arrow',{size:14})}</a></header><div class="recent-list">${recent.length?recent.map((item)=>renderMissionCard(item,model.language)).join(''):`<div class="empty-state"><span>${icon('spark',{size:20})}</span><strong>${model.language==='vi'?'Chưa có nhiệm vụ':'No missions yet'}</strong><p>${t('home.empty',model.language)}</p></div>`}</div></section></div>
  </section>`;
}

export function createHomeController({ api, language = 'en' } = {}) {
  if (!api) throw new TypeError('api is required');
  let state = buildHomeViewModel({ language, loading:true });
  let modelChosenInComposer = false;
  const snapshot = () => state;
  const patch = (value) => { state = buildHomeViewModel({ ...state, ...value }); return state; };
  return Object.freeze({
    snapshot,
    async load(){ patch({loading:true,error:null}); const results=await Promise.allSettled([api.get('/api/projects'),api.get('/api/missions'),api.get('/api/provider-connections'),api.get('/api/model-profiles'),api.get('/api/mcp/tools'),api.get('/api/commands'),api.get('/api/skills/catalog?limit=120'),api.get('/api/plugins'),api.get('/api/settings/effective')]);
      const [projects,missions,providers,models,tools,commands,skills,plugins,effectiveSettings]=results.map((r)=>r.status==='fulfilled'?r.value:null); const errors=results.filter((r)=>r.status==='rejected'); const routingDefault=String(effectiveSettings?.value?.agent?.model??'').trim()||'auto';
      return patch({loading:false,projects:arr(projects,['projects']),missions:arr(missions,['missions']),providers:arr(providers,['providers']),models:arr(models,['models']),tools:arr(tools,['tools']),commands:arr(commands,['commands']),skills:arr(skills,['skills']),plugins:arr(plugins,['plugins']),selectedModel:modelChosenInComposer?state.selectedModel:routingDefault,repositoryState:'ready',error:errors.length===results.length?'Nolane runtime could not be reached.':null}); },
    setMenu(menu){ return patch({menu}); }, setIntent(intent){ return patch({intent}); }, setProject(id){ return patch({selectedProjectId:String(id ?? ''),projectMenuOpen:false,projectQuery:''}); }, setProjectMenu(open){ return patch({projectMenuOpen:Boolean(open)}); }, setProjectQuery(query){ return patch({projectQuery:String(query ?? '')}); }, setModel(id){ modelChosenInComposer=true; return patch({selectedModel:id,selectedEffort:null}); }, setEffort(effort){ return patch({selectedEffort:effort}); }, addSkill(id){ return patch({selectedSkillIds:selectedSkillIds([...state.selectedSkillIds,id],state.skills)}); }, removeSkill(id){ return patch({selectedSkillIds:selectedSkillIds(state.selectedSkillIds.filter((item) => item !== String(id ?? '')),state.skills)}); }, setLanguage(next){ language=next; return patch({language:next}); },
    async refreshProjects(){ const payload=await api.get('/api/projects'); const next=arr(payload,['projects']); const selected=state.selectedProjectId && next.some((item)=>String(item.id)===String(state.selectedProjectId))?state.selectedProjectId:(next[0]?.id??''); return patch({projects:next,selectedProjectId:selected}); },
    async createProject(input={}){ const project=await api.post('/api/projects',input); await this.refreshProjects(); patch({selectedProjectId:project?.id??state.selectedProjectId,projectMenuOpen:false,projectQuery:''}); return project; },
    async submit({objective,projectId,intent='ask',modelChoice='auto',planningEffort=state.selectedEffort,mcpAllowedTools=[],skillIds: requestedSkillIds=state.selectedSkillIds}={}){ const text=String(objective??'').trim(); if(!text) throw new Error(language==='vi'?'Hãy nhập mục tiêu nhiệm vụ trước khi gửi.':'Mission objective is required'); if(!projectId) throw new Error(language==='vi'?'Hãy chọn một dự án trước khi gửi nhiệm vụ.':'Choose a project first'); const reject = (code) => { const error=Object.assign(new Error(missionErrorMessage({payload:{code}},language)),{payload:{code}}); patch({submitting:false,error:error.message}); throw error; }; const deployment=selectedDeployment(state.models,modelChoice); const skillIds=selectedSkillIds(requestedSkillIds,state.skills); const effort=normalizedReasoningEffort(state.models,modelChoice,planningEffort); if(modelChoice!=='auto'){ const selected=state.models.find((model)=>modelDeploymentKey(model)===modelChoice); const provider=selected&&state.providers.find((item)=>String(item?.id??'')===String(selected.providerId??selected.provider??'')); if(!selected||!providerIsReady(provider)) return reject('SELECTED_MODEL_NOT_READY'); } if(!state.providers.some(providerIsReady)) return reject('PROVIDER_SETUP_REQUIRED'); patch({submitting:true,error:null,menu:null,intent,selectedProjectId:projectId,selectedModel:modelChoice,selectedEffort:effort,selectedSkillIds:skillIds}); try{ const result=await api.post('/api/missions/plan',{projectId,objective:text,planningProviderId:deployment?.providerId??'auto',...(deployment?.modelId?{planningModelId:deployment.modelId}:{}) ,...(deployment?{deploymentKey:deployment.deploymentKey}:{}) ,...(effort?{planningEffort:effort}:{}) ,mcpAllowedTools,...(skillIds.length?{skillIds}:{})}); const mission=result?.mission??result; const next=[mission,...state.missions.filter((item)=>item.id!==mission?.id)]; patch({submitting:false,missions:next}); return mission; }catch(error){ patch({submitting:false,error:missionErrorMessage(error,language)}); throw error; } },
  });
}
