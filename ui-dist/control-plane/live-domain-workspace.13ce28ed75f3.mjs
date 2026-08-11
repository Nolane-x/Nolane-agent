import { BACKEND_ATLAS } from '../generated/backend-atlas.c28ec554080f.mjs';

const DOMAIN_META = Object.freeze({
  overview: { title: 'System Overview', kicker: 'Operational command center', description: 'A live, bounded view of mission flow, provider readiness, architecture stages, and certification posture.', endpoints: [
    ['missions','Mission portfolio',ctx=>'/api/missions'],
    ['provider-readiness','Provider readiness',ctx=>'/api/provider-connections/readiness'],
    ['architecture','Architecture readiness',ctx=>'/api/runtime-readiness/architecture'],
    ['security','Security certification',ctx=>'/api/security-certification/snapshot'],
  ]},
  operations: { title: 'Operations', kicker: 'Mission and agent execution', description: 'Observe active missions, task queues, agent modes, recoveries, and the operational control surface without exposing private runtime payloads.', endpoints: [
    ['missions','Missions',ctx=>'/api/missions'],
    ['tasks','Task queue',ctx=>`/api/tasks?missionId=${encodeURIComponent(ctx.missionId ?? '')}`],
    ['center','Agent Operations Center',ctx=>`/api/operations-center?projectId=${encodeURIComponent(ctx.projectId ?? '')}`],
    ['modes','Agent modes',ctx=>'/api/agent-modes'],
  ]},
  runtime: { title: 'Runtime', kicker: 'Local execution fabric', description: 'Runtime readiness, resource isolation, browser automation availability, and native orchestration health from the local control plane.', endpoints: [
    ['architecture','Architecture stages',ctx=>'/api/runtime-readiness/architecture'],
    ['sandbox-capabilities','Sandbox capabilities',ctx=>'/api/local-resource-sandboxes/capabilities'],
    ['sandboxes','Active sandboxes',ctx=>`/api/local-resource-sandboxes?projectId=${encodeURIComponent(ctx.projectId ?? '')}`],
    ['browser','Browser runtime',ctx=>'/api/browser/runtime'],
    ['orchestration','Native orchestration',ctx=>'/api/nolane/orchestration/status'],
  ]},
  'context-memory': { title: 'Context & Memory', kicker: 'Bounded working intelligence', description: 'Inspect context selection, durable memory, provenance, freshness, and the evidence graph used to ground agent decisions.', endpoints: [
    ['context','Context center',ctx=>`/api/context-memory-center?projectId=${encodeURIComponent(ctx.projectId ?? '')}`],
    ['memory','Project memories',ctx=>`/api/memory?projectId=${encodeURIComponent(ctx.projectId ?? '')}&limit=20`],
    ['evidence-graph','Evidence graph',ctx=>`/api/evidence-runtime/graph?projectId=${encodeURIComponent(ctx.projectId ?? '')}`],
  ]},
  evidence: { title: 'Evidence', kicker: 'Receipts, traces, and gaps', description: 'Follow trace events, verification gaps, export posture, and security evidence without loading unbounded raw logs into the interface.', endpoints: [
    ['snapshot','Trace snapshot',ctx=>`/api/trace-evidence?projectId=${encodeURIComponent(ctx.projectId ?? '')}&missionId=${encodeURIComponent(ctx.missionId ?? '')}`],
    ['events','Recent trace events',ctx=>`/api/trace-evidence/events?projectId=${encodeURIComponent(ctx.projectId ?? '')}&missionId=${encodeURIComponent(ctx.missionId ?? '')}&limit=100`],
    ['security','Certification evidence',ctx=>'/api/security-certification/snapshot'],
  ]},
  intelligence: { title: 'Intelligence', kicker: 'Repository truth plane', description: 'Repository discovery, code knowledge, dependency evidence, language capabilities, and bounded program relationships.', endpoints: [
    ['discovery','Repository discovery',ctx=>`/api/repository-discovery?projectId=${encodeURIComponent(ctx.projectId ?? '')}`],
    ['knowledge','Codebase knowledge',ctx=>`/api/codebase-knowledge?projectId=${encodeURIComponent(ctx.projectId ?? '')}`],
    ['inheritance','Inheritance graph',ctx=>`/api/code-relationships/inheritance?projectId=${encodeURIComponent(ctx.projectId ?? '')}`],
    ['dependencies','Semantic dependencies',ctx=>`/api/semantic-dependency/graph?projectId=${encodeURIComponent(ctx.projectId ?? '')}`],
    ['parsers','Parser capabilities',ctx=>'/api/tree-sitter/capabilities'],
  ]},
  'trust-security': { title: 'Trust & Security', kicker: 'Least privilege and supply-chain posture', description: 'Workspace trust, secret configuration state, capability boundaries, and security certification are visible without revealing credential values.', endpoints: [
    ['workspace','Workspace trust',ctx=>`/api/workspace-trust/${encodeURIComponent(ctx.projectId ?? '')}`],
    ['audit','Trust audit',ctx=>`/api/workspace-trust/${encodeURIComponent(ctx.projectId ?? '')}/audit?limit=100`],
    ['credentials','Credential configuration',ctx=>'/api/credentials'],
    ['security','Security certification',ctx=>'/api/security-certification/snapshot'],
  ]},
  governance: { title: 'Governance', kicker: 'Instructions, policy, and progress', description: 'Resolve instruction precedence, inspect discovered rules, mission progress, approvals, and the guardrails that constrain irreversible actions.', endpoints: [
    ['policy','Instruction policy',ctx=>`/api/instruction-policy?projectId=${encodeURIComponent(ctx.projectId ?? '')}`],
    ['instructions','Discovered instructions',ctx=>`/api/instructions?projectId=${encodeURIComponent(ctx.projectId ?? '')}`],
    ['progress','Mission progress',ctx=>`/api/mission-state-progress?projectId=${encodeURIComponent(ctx.projectId ?? '')}&missionId=${encodeURIComponent(ctx.missionId ?? '')}`],
    ['trust','Workspace trust',ctx=>`/api/workspace-trust/${encodeURIComponent(ctx.projectId ?? '')}`],
  ]},
  extensions: { title: 'Extensions', kicker: 'Models, tools, skills, and providers', description: 'Connected providers, model profiles, MCP tools, plugins, and native skills with conservative readiness and trust states.', endpoints: [
    ['providers','Provider connections',ctx=>'/api/provider-connections'],
    ['readiness','Provider readiness',ctx=>'/api/provider-connections/readiness'],
    ['models','Model profiles',ctx=>'/api/model-profiles'],
    ['mcp','MCP tools',ctx=>'/api/mcp/tools'],
    ['plugins','Plugins',ctx=>'/api/plugins'],
    ['skills','Native + ForgeOS skills',ctx=>`/api/skills/catalog${ctx.skillQuery||ctx.skillCatalog?`?${[ctx.skillQuery?`q=${encodeURIComponent(ctx.skillQuery)}`:'',ctx.skillCatalog?`catalog=${encodeURIComponent(ctx.skillCatalog)}`:''].filter(Boolean).join('&')}`:''}`],
  ]},
  autonomy: { title: 'Autonomy', kicker: 'Human-supervised agency', description: 'Agent modes, effective policy, mission progress, and kernel health make the current autonomy boundary explicit and reviewable.', endpoints: [
    ['modes','Agent modes',ctx=>'/api/agent-modes'],
    ['settings','Effective settings',ctx=>'/api/settings/effective'],
    ['progress','Mission progress',ctx=>`/api/mission-state-progress?projectId=${encodeURIComponent(ctx.projectId ?? '')}&missionId=${encodeURIComponent(ctx.missionId ?? '')}`],
    ['kernel','Kernel health',ctx=>'/api/sovereign-kernel/health'],
  ]},
  labs: { title: 'Labs & Benchmarks', kicker: 'Measured experimental systems', description: 'Experimental runtime lanes, sandbox posture, parser capability, and certification evidence. Experimental status is shown explicitly and never promoted silently.', endpoints: [
    ['forge-status','Labs runtime status',ctx=>'/api/forgeos/status'],
    ['upstream','ForgeOS upstream provenance',ctx=>'/api/forgeos/upstream'],
    ['lanes','Experimental lanes',ctx=>'/api/forgeos/lanes'],
    ['sandbox','Labs sandbox',ctx=>'/api/forgeos/sandbox'],
    ['parsers','Parser capabilities',ctx=>'/api/tree-sitter/capabilities'],
    ['security','Security certification',ctx=>'/api/security-certification/snapshot'],
  ]},
  release: { title: 'Release & Recovery', kicker: 'Fail-closed release posture', description: 'Source identity, UI asset readiness, clean runtime health, recovery access, and certification state. Update actions remain explicit and signed.', endpoints: [
    ['architecture','Release identity',ctx=>'/api/runtime-readiness/architecture'],
    ['ui-assets','UI asset runtime',ctx=>'/api/ui-assets'],
    ['kernel','Kernel health',ctx=>'/api/sovereign-kernel/health'],
    ['security','Security certification',ctx=>'/api/security-certification/snapshot'],
  ]},
});

const VI_META = Object.freeze({
  overview: ['Tổng quan hệ thống', 'Trung tâm điều hành', 'Góc nhìn trực tiếp và có giới hạn về luồng nhiệm vụ, trạng thái nhà cung cấp, các tầng kiến trúc và mức độ chứng nhận.'],
  operations: ['Vận hành', 'Nhiệm vụ và thực thi agent', 'Theo dõi nhiệm vụ, hàng đợi công việc, chế độ agent, phục hồi và bề mặt điều hành mà không làm lộ dữ liệu runtime riêng tư.'],
  runtime: ['Runtime', 'Hạ tầng thực thi cục bộ', 'Theo dõi mức sẵn sàng của runtime, cô lập tài nguyên, khả năng tự động hóa trình duyệt và sức khỏe điều phối native.'],
  'context-memory': ['Ngữ cảnh và bộ nhớ', 'Trí tuệ làm việc có giới hạn', 'Kiểm tra lựa chọn ngữ cảnh, bộ nhớ bền vững, nguồn gốc, độ mới và đồ thị bằng chứng dùng để neo quyết định của agent.'],
  evidence: ['Bằng chứng', 'Receipt, trace và khoảng trống', 'Theo dõi sự kiện trace, khoảng trống kiểm chứng, khả năng xuất và bằng chứng bảo mật mà không tải log thô không giới hạn vào giao diện.'],
  intelligence: ['Trí tuệ mã nguồn', 'Mặt phẳng sự thật repository', 'Hiển thị khám phá repository, tri thức mã nguồn, bằng chứng phụ thuộc, năng lực ngôn ngữ và quan hệ chương trình có giới hạn.'],
  'trust-security': ['Tin cậy và bảo mật', 'Đặc quyền tối thiểu và chuỗi cung ứng', 'Hiển thị độ tin cậy workspace, trạng thái cấu hình bí mật, ranh giới capability và chứng nhận bảo mật mà không làm lộ giá trị credential.'],
  governance: ['Quản trị', 'Chỉ dẫn, chính sách và tiến độ', 'Làm rõ thứ tự ưu tiên chỉ dẫn, các quy tắc đã phát hiện, tiến độ nhiệm vụ, phê duyệt và guardrail hạn chế hành động không thể đảo ngược.'],
  extensions: ['Mở rộng', 'Model, công cụ, skill và nhà cung cấp', 'Theo dõi provider đã kết nối, hồ sơ model, MCP tool, plugin và native skill với trạng thái sẵn sàng và tin cậy thận trọng.'],
  autonomy: ['Tự chủ', 'Agency có con người giám sát', 'Hiển thị chế độ agent, chính sách hiệu lực, tiến độ nhiệm vụ và sức khỏe kernel để ranh giới tự chủ luôn rõ ràng và có thể kiểm tra.'],
  labs: ['Phòng thí nghiệm và benchmark', 'Hệ thống thử nghiệm có đo lường', 'Theo dõi Nolane Labs, sandbox, khả năng parser và bằng chứng chứng nhận; trạng thái thử nghiệm luôn được ghi rõ và không tự động nâng cấp.'],
  release: ['Phát hành và phục hồi', 'Tư thế phát hành fail-closed', 'Hiển thị danh tính source, trạng thái tài nguyên UI, sức khỏe runtime, quyền truy cập phục hồi và chứng nhận; mọi hành động cập nhật vẫn tường minh và có chữ ký.'],
});

const TEXT = Object.freeze({
  en: Object.freeze({ refresh:'Refresh live data', adaptersOnline:'Adapters online', readsCompleted:'All required reads completed', dataUnavailable:'Some data is unavailable', boundedRecords:'Bounded records', boundedHint:'Previewed without unbounded payloads', backendRoutes:'Backend routes', read:'read', write:'write', refreshLatency:'Refresh latency', liveAdapters:'Live adapters', backendReporting:'What the backend is reporting now', redactionHint:'Private values are redacted; payloads are bounded.', records:'bounded records', adapterClosed:'Adapter remains fail-closed.', noRecords:'No list records are currently available.', backendContract:'Backend contract', routesExposed:'Routes exposed by this domain', mapped:'mapped', method:'Method', path:'Path', domain:'Domain', kind:'Kind', noRoutes:'No statically mapped routes for these adapters.', selectScope:'Select a project or mission to activate this adapter.', openBrowserWorkspace:'Open browser workspace', yes:'Yes', no:'No', items:'items' }),
  vi: Object.freeze({ refresh:'Làm mới dữ liệu thật', adaptersOnline:'Adapter đang hoạt động', readsCompleted:'Tất cả lượt đọc bắt buộc đã hoàn tất', dataUnavailable:'Một phần dữ liệu chưa sẵn sàng', boundedRecords:'Bản ghi có giới hạn', boundedHint:'Xem trước an toàn, không tải payload vô hạn', backendRoutes:'Route backend', read:'đọc', write:'ghi', refreshLatency:'Độ trễ làm mới', liveAdapters:'Adapter trực tiếp', backendReporting:'Backend đang báo cáo gì lúc này', redactionHint:'Giá trị riêng tư được che; payload luôn bị giới hạn.', records:'bản ghi có giới hạn', adapterClosed:'Adapter vẫn đóng an toàn.', noRecords:'Hiện chưa có bản ghi dạng danh sách.', backendContract:'Hợp đồng backend', routesExposed:'Các route được miền này phơi bày', mapped:'đã ánh xạ', method:'Phương thức', path:'Đường dẫn', domain:'Miền', kind:'Loại', noRoutes:'Không có route tĩnh được ánh xạ cho các adapter này.', selectScope:'Chọn project hoặc mission để kích hoạt adapter này.', openBrowserWorkspace:'Mở không gian trình duyệt', yes:'Có', no:'Không', items:'mục' }),
});
function languageKey(value){ return String(value??'en').toLowerCase().startsWith('vi')?'vi':'en'; }
function localizedMeta(domain,language){ const base=DOMAIN_META[domain]; if(languageKey(language)!=='vi'||!VI_META[domain])return base; const [title,kicker,description]=VI_META[domain]; return Object.freeze({...base,title,kicker,description}); }
function copy(language){ return TEXT[languageKey(language)]; }

const SECRET_KEY = /(token|secret|password|credential|api[-_]?key|private[-_]?key|authorization)/i;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
function safePrimitive(key,value,language='en'){ if(SECRET_KEY.test(String(key))) return '[redacted]'; if(value==null)return '—'; if(typeof value==='boolean')return value?copy(language).yes:copy(language).no; if(typeof value==='number')return Number.isFinite(value)?value.toLocaleString():'—'; const text=String(value); return text.length>96?`${text.slice(0,93)}…`:text; }
function arrayCandidate(payload){ if(Array.isArray(payload))return payload; if(!payload||typeof payload!=='object')return []; const entries=Object.entries(payload).filter(([,value])=>Array.isArray(value)).sort((a,b)=>b[1].length-a[1].length); return entries[0]?.[1]??[]; }
function recordCount(payload){ if(Array.isArray(payload))return payload.length; if(!payload||typeof payload!=='object')return payload==null?0:1; const arrays=Object.values(payload).filter(Array.isArray); if(arrays.length)return Math.max(...arrays.map(value=>value.length)); const numeric=Object.entries(payload).find(([key,value])=>/(count|total|size)$/i.test(key)&&Number.isFinite(value)); return numeric?Number(numeric[1]):Object.keys(payload).length; }
function statusValue(payload){ if(Array.isArray(payload))return payload.length?'ready':'empty'; if(!payload||typeof payload!=='object')return payload==null?'unavailable':'ready'; if(payload.ready===false)return 'unavailable'; if(payload.ready===true)return 'ready'; const value=payload.status??payload.state??payload.health??payload.lifecycle?.status; return value==null?'ready':String(value).toLowerCase(); }
function metrics(payload,language='en'){ if(!payload||typeof payload!=='object'||Array.isArray(payload))return []; const out=[]; const walk=(node,prefix='',depth=0)=>{ if(!node||typeof node!=='object'||Array.isArray(node)||depth>1)return; for(const [key,value] of Object.entries(node)){ if(out.length>=8)break; if(SECRET_KEY.test(key))continue; const label=prefix?`${prefix} · ${key}`:key; if(value==null||['string','number','boolean'].includes(typeof value))out.push([label,safePrimitive(key,value,language)]); else if(Array.isArray(value))out.push([label,`${value.length} ${copy(language).items}`]); else if(depth<1)walk(value,key,depth+1); }}; walk(payload); return out; }
function rowTitle(item,index,language='en'){ if(item==null)return `Record ${index+1}`; if(typeof item!=='object')return safePrimitive('',item,language); return safePrimitive('title',item.label??item.title??item.name??item.id??item.path??item.type??`Record ${index+1}`,language); }
function rowDetail(item,language='en'){ if(!item||typeof item!=='object')return ''; if(item.source==='forge-os'){ const forgeOsLabel=languageKey(language)==='vi'?'ForgeOS':'ForgeOS'; return [forgeOsLabel,item.releaseVersion&&`v${item.releaseVersion}`,item.catalogTitle??item.catalog,item.maturity??item.status,item.provenanceStatus,item.sourceDirty===true?(languageKey(language)==='vi'?'snapshot bẩn':'dirty snapshot'):null,item.kernelLevel].filter(Boolean).map(value=>safePrimitive('',value,language)).join(' · '); } const entries=Object.entries(item).filter(([key,value])=>!SECRET_KEY.test(key)&&value!=null&&['string','number','boolean'].includes(typeof value)).slice(0,3); return entries.map(([key,value])=>`${key}: ${safePrimitive(key,value,language)}`).join(' · '); }
function atlasFor(paths){ const normalized=paths.map(value=>String(value).split('?')[0]); return BACKEND_ATLAS.entries.filter(entry=>normalized.some(path=>entry.path===path||entry.path.startsWith(`${path}/`)||path.startsWith(`${entry.path}/`))); }
function endpointPath(definition,context){ const path=definition[2](context); if(path.includes('=')&&/(projectId=|missionId=)(?:&|$)/.test(path))return null; if(/\/workspace-trust\/$/.test(path))return null; return path; }
export async function loadLiveDomainWorkspace({api,domain,projectId=null,missionId=null,language='en',skillQuery='',skillCatalog=''}={}){
  const meta=localizedMeta(domain,language); if(!meta)throw new Error(`No live Control Plane workspace for ${domain}`);
  const context={projectId,missionId,skillQuery,skillCatalog}; const started=Date.now();
  const records=await Promise.all(meta.endpoints.map(async definition=>{
    const [id,label]=definition; const path=endpointPath(definition,context);
    if(!path)return Object.freeze({id,label,path:'scope unavailable',status:'unavailable',error:copy(language).selectScope,count:0,metrics:[],rows:[]});
    try{ const payload=await api.get(path); const rows=arrayCandidate(payload).slice(0,5); return Object.freeze({id,label,path,status:statusValue(payload),error:null,count:recordCount(payload),metrics:metrics(payload,language),query:id==='skills'?skillQuery:null,catalog:id==='skills'?skillCatalog:null,rows:Object.freeze(rows.map((item,index)=>Object.freeze({id:item?.id??null,title:rowTitle(item,index,language),detail:rowDetail(item,language)})))}); }
    catch(error){ return Object.freeze({id,label,path,status:'error',error:String(error?.payload?.error??error?.message??error),count:0,metrics:[],query:id==='skills'?skillQuery:null,catalog:id==='skills'?skillCatalog:null,rows:[]}); }
  }));
  const paths=records.filter(item=>item.path.startsWith('/')).map(item=>item.path); const routes=atlasFor(paths); const failures=records.filter(item=>item.status==='error');
  return Object.freeze({domain,...meta,language:languageKey(language),projectId,missionId,status:failures.length?'degraded':'ready',generatedAt:new Date().toISOString(),latencyMs:Date.now()-started,records:Object.freeze(records),routes:Object.freeze(routes),routeStats:Object.freeze({total:routes.length,read:routes.filter(item=>item.method==='GET').length,write:routes.filter(item=>item.method!=='GET').length})});
}
function statusClass(value){ const normalized=String(value??'unknown').toLowerCase(); return ['ready','active','pass','trusted','healthy','connected'].some(item=>normalized.includes(item))?'ready':['error','failed','blocked','denied'].some(item=>normalized.includes(item))?'error':['unavailable','unknown','empty','suspended'].some(item=>normalized.includes(item))?'muted':'warning'; }
function metricCards(workspace){ const t=copy(workspace.language); const ready=workspace.records.filter(item=>item.status!=='error'&&item.status!=='unavailable').length; const records=workspace.records.reduce((sum,item)=>sum+item.count,0); return `<div class="cp-kpi-grid"><article><span>${escapeHtml(t.adaptersOnline)}</span><strong>${ready}/${workspace.records.length}</strong><small>${escapeHtml(workspace.status==='ready'?t.readsCompleted:t.dataUnavailable)}</small></article><article><span>${escapeHtml(t.boundedRecords)}</span><strong>${records.toLocaleString()}</strong><small>${escapeHtml(t.boundedHint)}</small></article><article><span>${escapeHtml(t.backendRoutes)}</span><strong>${workspace.routeStats.total}</strong><small>${workspace.routeStats.read} ${escapeHtml(t.read)} · ${workspace.routeStats.write} ${escapeHtml(t.write)}</small></article><article><span>${escapeHtml(t.refreshLatency)}</span><strong>${workspace.latencyMs} ms</strong><small>${escapeHtml(workspace.generatedAt)}</small></article></div>`; }
function endpointCard(record,language,workspace){ const t=copy(language); const metricHtml=record.metrics.slice(0,6).map(([label,value])=>`<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join(''); const rows=record.rows.map(item=>`<li>${record.id==='skills'&&item.id?`<button type="button" class="cp-skill-open" data-skill-id="${escapeHtml(item.id)}">${escapeHtml(item.title)}</button>`:`<span>${escapeHtml(item.title)}</span>`}${item.detail?`<small>${escapeHtml(item.detail)}</small>`:''}</li>`).join(''); const skillsControls=record.id==='skills'&&!record.error?`<div class="cp-skill-controls"><input type="search" data-skill-catalog-search value="${escapeHtml(record.query??'')}" placeholder="${languageKey(language)==='vi'?'Tìm trong kho skill…':'Search the skill catalog…'}"><select data-skill-catalog-filter aria-label="${languageKey(language)==='vi'?'Catalog skill':'Skill catalog'}"><option value="" ${!record.catalog?'selected':''}>${languageKey(language)==='vi'?'Tất cả catalog':'All catalogs'}</option><option value="v2" ${record.catalog==='v2'?'selected':''}>ForgeOS v2</option><option value="legacy" ${record.catalog==='legacy'?'selected':''}>ForgeOS legacy</option></select></div>`:''; const preview=workspace?.skillPreview&&record.id==='skills'?`<section class="cp-skill-preview"><header><strong>${escapeHtml(workspace.skillPreview.title??workspace.skillPreview.id)}</strong><span>${escapeHtml(workspace.skillPreview.catalog??'ForgeOS')}</span></header><pre>${escapeHtml(String(workspace.skillPreview.content??'').slice(0,6000))}</pre></section>`:''; const browserLink=workspace?.domain==='runtime'&&record.id==='browser'?`<a class="cp-adapter-open" href="#/control-plane/runtime/browser" data-route="/control-plane/runtime/browser">${escapeHtml(t.openBrowserWorkspace)} ↗</a>`:''; return `<article class="cp-adapter-card" data-adapter-status="${escapeHtml(statusClass(record.status))}"><header><div><p>${escapeHtml(record.label)}</p><code>${escapeHtml(record.path)}</code></div><span class="cp-status" data-tone="${escapeHtml(statusClass(record.status))}">${escapeHtml(record.status)}</span></header>${browserLink}${record.error?`<div class="cp-adapter-error" role="status">${escapeHtml(record.error)}</div>`:`<div class="cp-adapter-count"><strong>${record.count.toLocaleString()}</strong><span>${escapeHtml(t.records)}</span></div>`}${skillsControls}${metricHtml?`<dl class="cp-adapter-metrics">${metricHtml}</dl>`:''}${rows?`<ul class="cp-adapter-rows">${rows}</ul>`:`<p class="cp-empty">${escapeHtml(record.error?t.adapterClosed:t.noRecords)}</p>`}${preview}</article>`; }
function routeTable(routes,language){ const t=copy(language); const rows=routes.slice(0,18).map(route=>`<tr><td><span class="cp-method" data-method="${escapeHtml(route.method)}">${escapeHtml(route.method)}</span></td><td><code>${escapeHtml(route.path)}</code></td><td>${escapeHtml(route.domain)}</td><td>${escapeHtml(route.kind)}</td></tr>`).join(''); return `<section class="cp-route-panel"><header><div><p class="cp-eyebrow">${escapeHtml(t.backendContract)}</p><h2>${escapeHtml(t.routesExposed)}</h2></div><span>${routes.length} ${escapeHtml(t.mapped)}</span></header><div class="cp-route-table-wrap"><table><thead><tr><th>${escapeHtml(t.method)}</th><th>${escapeHtml(t.path)}</th><th>${escapeHtml(t.domain)}</th><th>${escapeHtml(t.kind)}</th></tr></thead><tbody>${rows||`<tr><td colspan="4">${escapeHtml(t.noRoutes)}</td></tr>`}</tbody></table></div></section>`; }
export function renderLiveDomainWorkspace(workspace){ const t=copy(workspace.language); return `<section class="cp-workspace" data-domain-status="${escapeHtml(workspace.status)}"><header class="cp-workspace-hero"><div><p class="cp-eyebrow">${escapeHtml(workspace.kicker)}</p><h1>${escapeHtml(workspace.title)}</h1><p>${escapeHtml(workspace.description)}</p></div><div class="cp-hero-actions"><span class="cp-status" data-tone="${escapeHtml(statusClass(workspace.status))}">${escapeHtml(workspace.status)}</span><button type="button" data-control-action="refresh">${escapeHtml(t.refresh)}</button></div></header>${metricCards(workspace)}<section class="cp-adapter-section"><header><div><p class="cp-eyebrow">${escapeHtml(t.liveAdapters)}</p><h2>${escapeHtml(t.backendReporting)}</h2></div><small>${escapeHtml(t.redactionHint)}</small></header><div class="cp-adapter-grid">${workspace.records.map(record=>endpointCard(record,workspace.language,workspace)).join('')}</div></section>${routeTable(workspace.routes,workspace.language)}</section>`; }
export function hasLiveDomainWorkspace(domain){ return Object.hasOwn(DOMAIN_META,domain); }
