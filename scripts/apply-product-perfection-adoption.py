from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if text.count(old) != 1:
        raise SystemExit(f"unexpected {label} authority shape: {text.count(old)} matches")
    return text.replace(old, new)


home = Path('ui-v3/views/home/home-view.mjs')
s = home.read_text()
anchor = "  const runtimeStatus = selectedModelReady ? providerStatus : (model.language === 'vi' ? 'Model đã chọn chưa sẵn sàng. Hãy chọn model khác hoặc đăng nhập provider đó.' : 'Selected model is not ready. Choose another model or sign in to its provider.');\n  const quick = ["
insert = "  const runtimeStatus = selectedModelReady ? providerStatus : (model.language === 'vi' ? 'Model đã chọn chưa sẵn sàng. Hãy chọn model khác hoặc đăng nhập provider đó.' : 'Selected model is not ready. Choose another model or sign in to its provider.');\n  const readiness = [];\n  if (!model.projects.length) readiness.push({ icon: 'folder', title: model.language === 'vi' ? 'Cần một dự án' : 'Project required', text: model.language === 'vi' ? 'Thêm thư mục hoặc kho mã để Nolane có không gian làm việc.' : 'Add a folder or repository so Nolane has a workspace.', href: '#/projects', action: model.language === 'vi' ? 'Thêm dự án' : 'Add project' });\n  if (!providersReady) readiness.push({ icon: 'model', title: model.language === 'vi' ? 'Cần provider' : 'Provider required', text: model.language === 'vi' ? 'Kết nối ít nhất một provider sẵn sàng trước khi chạy nhiệm vụ.' : 'Connect at least one ready provider before running a mission.', href: '#/settings?section=models', action: model.language === 'vi' ? 'Thiết lập provider' : 'Set up provider' });\n  else if (!selectedModelReady) readiness.push({ icon: 'warning', title: model.language === 'vi' ? 'Model chưa sẵn sàng' : 'Model not ready', text: runtimeStatus, href: '#/settings?section=models', action: model.language === 'vi' ? 'Kiểm tra model' : 'Review model' });\n  const readinessHtml = readiness.length ? `<div class=\"home-readiness\" role=\"region\" aria-label=\"${model.language === 'vi' ? 'Điều kiện để bắt đầu nhiệm vụ' : 'Mission prerequisites'}\">${readiness.map((item) => `<div class=\"home-readiness__item\"><span aria-hidden=\"true\">${icon(item.icon,{size:15})}</span><div><strong>${esc(item.title)}</strong><small>${esc(item.text)}</small></div><a href=\"${item.href}\" data-route=\"${item.href.slice(1)}\">${esc(item.action)} ${icon('arrow',{size:13})}</a></div>`).join('')}</div>` : '';\n  const quick = ["
s = replace_once(s, anchor, insert, 'Home runtime status')
old = "      </form>${model.error?`<div class=\"home-error\" role=\"alert\">${icon('warning',{size:16})}<span>${esc(model.error)}</span></div>`:''}\n    </div>"
new = "      </form>${readinessHtml}${model.error?`<div class=\"home-error\" role=\"alert\">${icon('warning',{size:16})}<span>${esc(model.error)}</span><button type=\"button\" data-home-action=\"retry\">${model.language==='vi'?'Thử lại':'Retry'}</button></div>`:''}\n    </div>"
s = replace_once(s, old, new, 'Home composer tail')
home.write_text(s)

projects = Path('ui-v3/views/projects/project-view.mjs')
s = projects.read_text()
marker = 'export function renderProjectsView(state={}) {'
if marker not in s:
    raise SystemExit('renderProjectsView marker missing')
prefix = s.split(marker, 1)[0]
render = r'''function projectTrustLabel(value, language = 'en') {
  const trust = String(value ?? '').toLowerCase();
  if (language === 'vi') return ({ trusted: 'Tin cậy', manual: 'Thủ công', local: 'Cục bộ', untrusted: 'Chưa tin cậy', unknown: 'Chưa rõ' })[trust] ?? value ?? 'Chưa rõ';
  return ({ trusted: 'Trusted', manual: 'Manual', local: 'Local', untrusted: 'Untrusted', unknown: 'Unknown' })[trust] ?? value ?? 'Unknown';
}

export function renderProjectsView(state={}) {
  const language=state.language??'en';const vi=language==='vi';
  if(state.status==='loading')return `<section class="page-loading" aria-busy="true"><span class="spinner"></span><p role="status" aria-live="polite">${vi?'Đang tải dự án…':'Loading projects…'}</p></section>`;
  if(state.status==='error')return `<section class="page-error projects-error"><p role="alert">${esc(state.error)}</p><button type="button" data-project-action="retry">${vi?'Thử lại':'Retry'}</button></section>`;
  const projects=state.projects??[];
  const query=String(state.query??'').trim();
  const empty=query
    ? `<div class="page-empty page-empty--search"><span>${icon('search',{size:20})}</span><h3>${vi?'Không có dự án phù hợp':'No matching projects'}</h3><p>${vi?`Không tìm thấy dự án nào cho “${esc(query)}”.`:`No projects match “${esc(query)}”.`}</p><button type="button" data-project-action="clear-search">${vi?'Xóa tìm kiếm':'Clear search'}</button></div>`
    : `<div class="page-empty"><span>${icon('folder',{size:20})}</span><h3>${vi?'Chưa có dự án':'No projects yet'}</h3><p>${vi?'Thêm thư mục cục bộ để Nolane có không gian làm việc.':'No projects yet. Add a local folder to give Nolane a workspace.'}</p><button type="button" data-project-action="add">${vi?'Thêm dự án':'Add project'}</button></div>`;
  const cards=projects.map(project=>{const status=project.status??project.lifecycle??'active';const last=formatTime(project.lastUsedAt??project.updatedAt,language);const trust=project.trust??(project.mode==='git'?'trusted':'manual');return `<a class="project-card" href="#/project?id=${encodeURIComponent(project.id)}" data-route="/project?id=${encodeURIComponent(project.id)}"><span class="project-card__icon">${icon('folder',{size:19})}</span><span class="project-card__copy"><strong>${esc(project.name??project.id)}</strong><small title="${esc(project.root??project.path??'')}">${esc(project.root??project.path??'')}</small></span><span class="project-card__meta"><small>${esc(last)}</small><em data-tone="${tone(status)}">${esc(projectTrustLabel(trust,language).toUpperCase())}</em></span><span class="project-card__options" aria-hidden="true">${icon('dots',{size:16})}</span></a>`}).join('');
  const activity=projects.flatMap(project=>(project.recentMissions??project.missions??[]).map(mission=>({...mission,projectName:project.name,projectId:project.id}))).slice(0,10);
  const activityHtml=activity.length?`<div class="project-activity-list">${activity.map(item=>`<article class="project-activity" data-tone="${tone(item.status)}"><span class="project-activity__mark">${icon(tone(item.status)==='success'?'check':tone(item.status)==='danger'?'warning':'activity',{size:15})}</span><div><strong>${esc(item.title??item.objective??item.id)}</strong><small>${esc(item.projectName??item.projectId??'')} · ${esc(item.status??'draft')}</small></div><a href="#/missions?id=${encodeURIComponent(item.id)}" aria-label="${vi?'Mở nhiệm vụ':'Open mission'}">${icon('arrow',{size:15})}</a></article>`).join('')}</div>`:empty;
  return `<section class="projects-page surface-page" data-project-view-mode="${esc(state.view??'cards')}"><header class="surface-page__header"><div><p class="eyebrow">${vi?'Danh mục không gian làm việc':'Workspace registry'}</p><h1>${vi?'Dự án':'Projects'}</h1><p>${vi?'Không gian tin cậy, lịch sử nhiệm vụ và thông tin kho mã ở cùng một nơi.':'Trusted workspaces, mission history, and repository intelligence in one place.'}</p></div><button class="primary-action" data-project-action="add">${icon('plus',{size:15})}${vi?'Thêm dự án':'Add project'}</button></header><div class="surface-toolbar"><label class="surface-search"><span class="sr-only">${vi?'Tìm dự án':'Search projects'}</span>${icon('search',{size:15})}<input type="search" value="${esc(state.query??'')}" placeholder="${vi?'Tìm dự án…':'Search projects…'}" data-project-search autocomplete="off"></label><div class="view-toggle" role="group" aria-label="${vi?'Chế độ xem dự án':'Project view'}"><button data-project-view="cards" aria-pressed="${state.view!=='activity'}" aria-label="${vi?'Xem dự án':'Project cards'}">${icon('folder',{size:14})}</button><button data-project-view="activity" aria-pressed="${state.view==='activity'}" aria-label="${vi?'Xem hoạt động':'Activity view'}">${icon('activity',{size:14})}</button></div><span class="sr-only" role="status" aria-live="polite">${projects.length} ${vi?'kết quả':'results'}</span></div><div class="projects-content">${state.view==='activity'?activityHtml:(cards||empty)}</div></section>`;
}
'''
projects.write_text(prefix + render)

app = Path('ui-v3/app.mjs')
s = app.read_text()
start = s.index("router.register({ id: 'projects'")
end = s.index("router.register({ id: 'skills'", start)
replacement = r'''router.register({ id: 'projects', pattern: /^\/projects(?:\?.*)?$/, title: 'Projects', load: async () => {
  const { createProjectsController, renderProjectsView } = await import('./views/projects/project-view.mjs');
  const controller=createProjectsController({api,language:cachedPreferences.language});
  await controller.load();
  let root=null;
  const view={
    render:()=>renderProjectsView(controller.snapshot()),
    mount(node){
      root=node;
      const restoreProjectsSearchFocus=(value,start,end)=>requestAnimationFrame(()=>{const search=root?.querySelector('[data-project-search]');if(!search)return;search.focus({preventScroll:true});if(Number.isInteger(start)&&Number.isInteger(end))search.setSelectionRange(start,end);else{const position=String(value??'').length;search.setSelectionRange(position,position);}});
      const repaint=({focusSearch=false,searchValue=null,selectionStart=null,selectionEnd=null,focusSelector=null}={})=>{if(!root)return;root.innerHTML=view.render();if(focusSearch)restoreProjectsSearchFocus(searchValue,selectionStart,selectionEnd);else if(focusSelector)requestAnimationFrame(()=>root?.querySelector(focusSelector)?.focus({preventScroll:true}));};
      const input=e=>{if(!e.target.matches('[data-project-search]'))return;const value=e.target.value;const selectionStart=e.target.selectionStart;const selectionEnd=e.target.selectionEnd;controller.setQuery(value);repaint({focusSearch:true,searchValue:value,selectionStart,selectionEnd});};
      const click=async e=>{
        const mode=e.target.closest('[data-project-view]');
        if(mode){const value=mode.dataset.projectView;controller.setView(value);repaint({focusSelector:`[data-project-view="${CSS.escape(value)}"]`});return;}
        const data=e.target.closest('[data-project-action]')?.dataset;
        if(!data)return;
        if(data.projectAction==='add'){window.dispatchEvent(new CustomEvent('nolane:project-create-requested',{detail:{source:'projects-view'}}));return;}
        if(data.projectAction==='clear-search'){controller.setQuery('');repaint({focusSearch:true,searchValue:''});return;}
        if(data.projectAction==='retry'){await controller.load();repaint({focusSearch:true,searchValue:controller.snapshot().query??''});}
      };
      root.addEventListener('input',input);root.addEventListener('click',click);
      return()=>{root.removeEventListener('input',input);root.removeEventListener('click',click)};
    }
  };
  return view;
} });

'''
app.write_text(s[:start] + replacement + s[end:])

s = app.read_text()
anchor = "      const click = async (event) => {\n        const selectedSkillRemove=event.target.closest('[data-selected-skill-remove]');"
replacement = "      const click = async (event) => {\n        const homeAction=event.target.closest('[data-home-action]')?.dataset.homeAction; if(homeAction==='retry'){const value=root.querySelector('#objective')?.value??'';await controller.load();render({textareaValue:value,focus:true});return;}\n        const selectedSkillRemove=event.target.closest('[data-selected-skill-remove]');"
s = replace_once(s, anchor, replacement, 'Home click authority')
app.write_text(s)

home_css = Path('ui-v3/styles/pages/home.css')
home_css.write_text(home_css.read_text() + r'''
.home-readiness{display:grid;gap:0;width:min(960px,100%);margin-top:12px;border-block:1px solid var(--instrument-rule)}
.home-readiness__item{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;min-height:var(--density-row-height);padding:9px 2px;color:var(--text-secondary)}
.home-readiness__item+.home-readiness__item{border-top:1px solid var(--border-faint)}
.home-readiness__item>span{display:grid;place-items:center;width:30px;height:30px;color:var(--instrument-trace)}
.home-readiness__item>div{display:grid;min-width:0;gap:2px}.home-readiness__item strong{color:var(--text-primary);font-size:11px}.home-readiness__item small{color:var(--text-secondary);font-size:10px;line-height:1.45}
.home-readiness__item>a{display:flex;align-items:center;gap:4px;color:var(--text-secondary);font-size:10px;text-decoration:none}.home-readiness__item>a:hover,.home-readiness__item>a:focus-visible{color:var(--text-primary)}
.home-error button{margin-left:auto;padding:5px 9px;border:1px solid color-mix(in srgb,var(--nolane-danger) 35%,var(--border-default));border-radius:8px;background:transparent;color:var(--text-primary)}
@media(max-width:680px){.home-readiness__item{grid-template-columns:auto minmax(0,1fr)}.home-readiness__item>a{grid-column:2;justify-self:start}}
''')

projects_css = Path('ui-v3/styles/pages/projects.css')
projects_css.write_text(projects_css.read_text() + r'''
.projects-error{gap:10px}.projects-error button,.page-empty--search button,.projects-content .page-empty button{justify-self:center;padding:6px 10px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--surface-raised);color:var(--text-secondary)}
.projects-error button:hover,.page-empty--search button:hover,.projects-content .page-empty button:hover{border-color:var(--border-default);color:var(--text-primary)}
.page-empty--search>span{color:var(--text-secondary)}
''')
