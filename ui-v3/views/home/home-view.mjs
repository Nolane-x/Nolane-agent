import { icon } from '../../core/icon.mjs';
import { t } from '../../core/i18n.mjs';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[character]);
const arr = (payload, keys = []) => { if (Array.isArray(payload)) return payload; for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key]; return []; };
const statusTone = (status) => ['failed','error','blocked'].includes(status) ? 'danger' : ['running','planning','testing'].includes(status) ? 'active' : ['completed','verified','ready'].includes(status) ? 'success' : 'neutral';

export function buildHomeViewModel({ repositoryState = 'unknown', suggestions = [], project = null, projects = [], missions = [], providers = [], models = [], tools = [], commands = [], language = 'en', loading = false, error = null, menu = null, intent = 'ask', selectedProjectId = null, selectedModel = 'auto', submitting = false } = {}) {
  const evidenceBacked = repositoryState === 'ready'
    ? suggestions.filter((item) => Array.isArray(item.evidenceIds) && item.evidenceIds.length > 0).slice(0, 3).map((item) => Object.freeze({ ...item }))
    : [];
  return Object.freeze({
    product: 'Nolane Agent', title: t('home.title',language), subtitle:t('home.subtitle',language), project,
    repositoryState, repositoryMessage: repositoryState === 'indexing' ? (language === 'vi' ? 'Nolane đang đọc dự án này…' : 'Nolane is reading this project…') : null,
    suggestions: Object.freeze(evidenceBacked), projects:Object.freeze(projects), missions:Object.freeze(missions), providers:Object.freeze(providers), models:Object.freeze(models), tools:Object.freeze(tools), commands:Object.freeze(commands), language, loading, error, menu, intent, selectedProjectId:selectedProjectId ?? projects[0]?.id ?? '', selectedModel, submitting,
  });
}

function contextItems(model) {
  const projectItems = model.projects.slice(0,8).map((item) => ({ type:'project', id:item.id, label:item.name ?? item.path ?? item.id, detail:item.path ?? '', icon:'projects' }));
  const modelItems = model.models.slice(0,8).map((item) => ({ type:'model', id:item.key ?? item.modelId ?? item.id, label:item.displayName ?? item.modelId ?? item.id, detail:item.providerId ?? '', icon:'model' }));
  const providerItems = model.providers.slice(0,6).map((item) => ({ type:'provider', id:item.id, label:item.label ?? item.id, detail:item.state ?? item.status ?? '', icon:'globe' }));
  const toolItems = model.tools.slice(0,8).map((item) => ({ type:'tool', id:item.name ?? item.id, label:item.title ?? item.name ?? item.id, detail:item.server ?? item.description ?? '', icon:'tool' }));
  return [...projectItems,...modelItems,...providerItems,...toolItems];
}
function commandItems(model) {
  const local = [
    {id:'ask',title:'Ask without changing files',description:'Read and explain only'},
    {id:'plan',title:'Create a verified plan',description:'Plan before any changes'},
    {id:'build',title:'Build with approval boundaries',description:'Edit, run, and verify'},
    {id:'verify',title:'Verify existing work',description:'Run checks without expanding scope'},
    {id:'clear',title:'Clear composer',description:'Remove the current draft'},
  ];
  const remote = model.commands.slice(0,20).map((item) => ({ id:item.id ?? item.name, title:item.title ?? item.label ?? item.name ?? item.id, description:item.description ?? item.summary ?? '' }));
  const seen = new Set(); return [...local,...remote].filter((item) => item.id && !seen.has(item.id) && seen.add(item.id));
}
function renderMenu(model) {
  if (!model.menu) return '';
  const items = model.menu.type === 'context' ? contextItems(model) : commandItems(model).map((item)=>({...item,type:'command',label:item.title,detail:item.description,icon:'command'}));
  const query = String(model.menu.query ?? '').toLowerCase();
  const filtered = items.filter((item)=>!query || `${item.label} ${item.detail} ${item.id}`.toLowerCase().includes(query)).slice(0,14);
  return `<div class="composer-menu" data-menu-type="${model.menu.type}" role="listbox" aria-label="${model.menu.type === 'context' ? 'Context' : 'Commands'}"><header><span>${model.menu.type === 'context' ? icon('paperclip',{size:15}) : icon('command',{size:15})}</span><strong>${model.menu.type === 'context' ? 'Add context' : 'Run a command'}</strong><kbd>Esc</kbd></header><div>${filtered.length ? filtered.map((item,index)=>`<button type="button" role="option" aria-selected="${index===0}" data-menu-index="${index}" data-menu-kind="${esc(item.type)}" data-menu-id="${esc(item.id)}" data-menu-label="${esc(item.label)}"><span class="composer-menu__icon">${icon(item.icon ?? 'spark',{size:16})}</span><span><strong>${esc(item.label)}</strong><small>${esc(item.detail || item.id)}</small></span><em>${esc(item.type)}</em></button>`).join('') : '<p class="composer-menu__empty">No matching items</p>'}</div></div>`;
}
function projectOptions(model) { return model.projects.length ? model.projects.map((item)=>`<option value="${esc(item.id)}"${String(item.id)===String(model.selectedProjectId)?' selected':''}>${esc(item.name ?? item.path ?? item.id)}</option>`).join('') : '<option value="">No project available</option>'; }
function modelOptions(model) { return `<option value="auto"${model.selectedModel==='auto'?' selected':''}>${t('home.model',model.language)}</option>${model.models.slice(0,50).map((item)=>{const id=item.key??item.modelId??item.id;return `<option value="${esc(id)}"${id===model.selectedModel?' selected':''}>${esc(item.displayName??item.modelId??item.id)} · ${esc(item.providerId??'')}</option>`}).join('')}`; }
function renderMissionCard(item, language) {
  const status = item.status ?? item.state ?? 'draft'; const title = item.objective ?? item.title ?? item.name ?? item.id;
  const time = item.updatedAt ?? item.createdAt; const when = time ? new Date(Number(time) > 1e12 ? Number(time) : time).toLocaleString(language==='vi'?'vi-VN':'en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
  return `<a class="recent-mission" href="#/missions?id=${encodeURIComponent(item.id)}" data-route="/missions?id=${encodeURIComponent(item.id)}"><span class="recent-mission__status" data-tone="${statusTone(status)}">${icon(statusTone(status)==='success'?'check':statusTone(status)==='danger'?'warning':'activity',{size:15})}</span><span class="recent-mission__copy"><strong>${esc(title)}</strong><small>${esc(item.projectName ?? item.projectId ?? '')}${when ? ` · ${esc(when)}`:''}</small></span><span class="recent-mission__badge" data-tone="${statusTone(status)}">${esc(status.replaceAll('_',' '))}</span>${icon('arrow',{size:15,className:'recent-mission__arrow'})}</a>`;
}
export function renderHomeView(model = buildHomeViewModel()) {
  const recent = model.missions.slice(0,6);
  const providersReady = model.providers.filter((item)=>['ready','configured','connected','available'].includes(item.state ?? item.status)).length;
  const quick = [
    {icon:'file',title:model.language==='vi'?'Tóm tắt kho mã':'Understand this codebase',text:model.language==='vi'?'Đọc cấu trúc và giải thích dự án':'Map architecture and explain the project',intent:'ask'},
    {icon:'warning',title:model.language==='vi'?'Sửa lỗi và kiểm thử':'Fix a bug and verify',text:model.language==='vi'?'Điều tra, sửa và chạy kiểm tra':'Investigate, patch, and run checks',intent:'build'},
    {icon:'branch',title:model.language==='vi'?'Lập kế hoạch tính năng':'Plan a feature',text:model.language==='vi'?'Tạo kế hoạch có thể duyệt':'Create a reviewable implementation plan',intent:'plan'},
    {icon:'evidence',title:model.language==='vi'?'Duyệt thay đổi':'Review current changes',text:model.language==='vi'?'Kiểm tra diff, rủi ro và bằng chứng':'Inspect diffs, risk, and evidence',intent:'verify'},
  ];
  return `<section class="home-view" data-status="${model.loading?'loading':'ready'}">
    <div class="home-ambient" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="home-hero"><p class="eyebrow">${esc(t('home.kicker',model.language))}</p><h1>${esc(model.title)}</h1><p class="home-subtitle">${esc(model.subtitle)}</p>
      <form id="mission-composer" class="mission-composer" autocomplete="off">
        <div class="composer-context-row"><label><span>${icon('projects',{size:14})}</span><select name="projectId" aria-label="Project">${projectOptions(model)}</select></label><span class="composer-runtime"><i data-state="${providersReady?'ready':'limited'}"></i>${providersReady ? `${providersReady} provider${providersReady===1?'':'s'} ready` : 'Provider setup required'}</span></div>
        <label class="composer-input"><span class="sr-only">Mission objective</span><textarea id="objective" name="objective" rows="3" placeholder="${esc(t('home.placeholder',model.language))}" required></textarea>${renderMenu(model)}</label>
        <div class="composer-footer"><div class="composer-tools"><button type="button" data-action="attach" aria-label="${t('home.attach',model.language)}">${icon('paperclip',{size:17})}<span>${t('home.attach',model.language)}</span></button><button type="button" data-action="open-context">@</button><button type="button" data-action="open-commands">/</button></div><div class="composer-send"><label class="composer-select">${icon('spark',{size:14})}<select name="intent" aria-label="Intent"><option value="ask"${model.intent==='ask'?' selected':''}>Ask</option><option value="plan"${model.intent==='plan'?' selected':''}>Plan</option><option value="build"${model.intent==='build'?' selected':''}>Build</option><option value="verify"${model.intent==='verify'?' selected':''}>Verify</option></select></label><label class="composer-select composer-select--model">${icon('model',{size:14})}<select name="modelChoice" aria-label="Model">${modelOptions(model)}</select></label><button class="composer-submit" type="submit"${model.submitting||!model.projects.length?' disabled':''}>${model.submitting?'<span class="spinner"></span>':icon('send',{size:17})}<span>${t('home.send',model.language)}</span></button></div></div>
      </form>${model.error?`<div class="home-error" role="alert">${icon('warning',{size:16})}<span>${esc(model.error)}</span></div>`:''}
    </div>
    <div class="home-content"><section class="home-section"><header><div><p class="eyebrow">${t('home.quick',model.language)}</p><h2>${model.language==='vi'?'Bạn muốn bắt đầu thế nào?':'Choose a starting point'}</h2></div><a href="#/settings" data-route="/settings">${model.language==='vi'?'Tùy chỉnh':'Customize'} ${icon('arrow',{size:14})}</a></header><div class="capability-grid">${quick.map((item)=>`<button type="button" class="capability-card" data-quick-intent="${item.intent}" data-quick-text="${esc(item.title)}"><span>${icon(item.icon,{size:19})}</span><strong>${esc(item.title)}</strong><small>${esc(item.text)}</small>${icon('arrow',{size:15,className:'capability-card__arrow'})}</button>`).join('')}</div></section>
    <section class="home-section home-section--recent"><header><div><p class="eyebrow">${t('home.recent',model.language)}</p><h2>${model.language==='vi'?'Nhiệm vụ gần đây':'Recent work'}</h2></div><a href="#/missions" data-route="/missions">${model.language==='vi'?'Xem tất cả':'View all'} ${icon('arrow',{size:14})}</a></header><div class="recent-list">${recent.length?recent.map((item)=>renderMissionCard(item,model.language)).join(''):`<div class="empty-state"><span>${icon('spark',{size:20})}</span><strong>${model.language==='vi'?'Chưa có nhiệm vụ':'No missions yet'}</strong><p>${t('home.empty',model.language)}</p></div>`}</div></section></div>
  </section>`;
}

export function createHomeController({ api, language = 'en' } = {}) {
  if (!api) throw new TypeError('api is required');
  let state = buildHomeViewModel({ language, loading:true });
  const snapshot = () => state;
  const patch = (value) => { state = buildHomeViewModel({ ...state, ...value }); return state; };
  return Object.freeze({
    snapshot,
    async load(){ patch({loading:true,error:null}); const results=await Promise.allSettled([api.get('/api/projects'),api.get('/api/missions'),api.get('/api/provider-connections'),api.get('/api/model-profiles'),api.get('/api/mcp/tools'),api.get('/api/commands')]);
      const [projects,missions,providers,models,tools,commands]=results.map((r)=>r.status==='fulfilled'?r.value:null); const errors=results.filter((r)=>r.status==='rejected');
      return patch({loading:false,projects:arr(projects,['projects']),missions:arr(missions,['missions']),providers:arr(providers,['providers']),models:arr(models,['models']),tools:arr(tools,['tools']),commands:arr(commands,['commands']),repositoryState:'ready',error:errors.length===results.length?'Nolane runtime could not be reached.':null}); },
    setMenu(menu){ return patch({menu}); }, setIntent(intent){ return patch({intent}); }, setProject(id){ return patch({selectedProjectId:id}); }, setModel(id){ return patch({selectedModel:id}); }, setLanguage(next){ language=next; return patch({language:next}); },
    async submit({objective,projectId,intent='ask',modelChoice='auto',mcpAllowedTools=[]}={}){ const text=String(objective??'').trim(); if(!text) throw new Error('Mission objective is required'); if(!projectId) throw new Error('Choose a project first'); patch({submitting:true,error:null,menu:null,intent,selectedProjectId:projectId,selectedModel:modelChoice}); try{ const result=await api.post('/api/missions/plan',{projectId,objective:text,planningProviderId:modelChoice==='auto'?'auto':modelChoice,mcpAllowedTools}); const mission=result?.mission??result; const next=[mission,...state.missions.filter((item)=>item.id!==mission?.id)]; patch({submitting:false,missions:next}); return mission; }catch(error){ patch({submitting:false,error:String(error?.message??error)}); throw error; } },
  });
}
