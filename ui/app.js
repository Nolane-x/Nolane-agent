import { createRefreshCoalescer } from './refresh-coalescer.mjs';
import { deriveRunView, formatTokens, relativeTime } from './ui-state.mjs';
import { applyRuntimePerformancePolicy } from './runtime-performance-policy.js';
import { initMissionResourceHud } from './mission-resource-fabric.js';
const SHELL_ROUTES=Object.freeze({mission:'home',work:'task',evidence:'evidenceRuntime'});
const RUN_ACTION_PATHS = Object.freeze({ pause: '/pause', resume: '/resume', stop: '/stop', retry: '/retry' });
const query = new URLSearchParams(location.search);
const token = query.get('token') || sessionStorage.getItem('forgeStudioToken') || '';
if (token) sessionStorage.setItem('forgeStudioToken', token);
const state = {
projects: [],
projectId: localStorage.getItem('forgeProjectId') || null,
currentRun: null,
recentRuns: [],
autonomyProfile: 'workspace-autopilot',
workroom: null,
workroomLoaded: false,
refreshing: false,
refreshAgain: false,
activityExpanded: true,
inspectorTab: 'preview',
review: null,
providerReadiness: { ready: false, readyProviders: [] },
providerUi: null,
runtime: null,
performancePolicy: null,
goalOs: null,
goalOsLoaded: false,
currentGoal: null,
resourceHud: null,
collaborationExperience: null,
};
const $ = (id) => document.getElementById(id);
const all = (selector) => [...document.querySelectorAll(selector)];
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
async function api(url, options = {}) {
const { raw = false, ...requestOptions } = options;
const response = await fetch(url, {
...requestOptions,
headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(requestOptions.headers ?? {}) },
});
if (raw) { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response; }
const payload = await response.json().catch(() => ({}));
if (!response.ok) {
const error = new Error(payload.detail || payload.error || `HTTP ${response.status}`);
error.status = response.status;
error.payload = payload;
throw error;
}
return payload;
}
let toastTimer = null;
function toast(message, error = false) {
clearTimeout(toastTimer);
$('toast').textContent = String(message);
$('toast').className = `toast show${error ? ' error' : ''}`;
toastTimer = setTimeout(() => { $('toast').className = 'toast'; }, 3200);
}
function showDialog(id) {
const dialog = $(id);
if (!dialog.open) dialog.showModal();
}
function closeDialog(id) { if ($(id)?.open) $(id).close(); }
function renderProviderSummary() {
const ready = Boolean(state.providerReadiness?.ready);
const label = ready ? 'AI đã sẵn sàng' : 'Chưa kết nối AI';
$('provider-summary-dot').className = `provider-summary-dot ${ready ? 'ready' : 'error'}`;
$('composer-provider-dot').className = `provider-mini-dot ${ready ? 'ready' : 'error'}`;
$('provider-summary-label').textContent = label;
$('composer-provider-label').textContent = ready ? 'AI đã sẵn sàng' : 'Kết nối AI';
$('composer-provider').classList.toggle('connected', ready);
}
async function loadRuntimePerformance() {
state.runtime = await api('/api/runtime');
state.performancePolicy = applyRuntimePerformancePolicy(state.runtime);
return state.runtime;
}
async function loadProviderReadiness() {
state.providerReadiness = await api('/api/provider-connections/readiness');
renderProviderSummary();
return state.providerReadiness;
}
async function ensureGoalOs() {
if (!state.goalOs) {
const { initGoalOs } = await import('./goal-os.js');
state.goalOs = initGoalOs({ api, state, toast, showDialog });
state.goalOsLoaded = true;
}
return state.goalOs;
}
async function executeSlashCommand(command) {
const goalOs = await ensureGoalOs();
return goalOs.executeCommand(command, { projectId: state.projectId, missionId: state.currentRun?.mission?.id ?? null });
}
async function openProviderCenter(options = {}) {
if (!state.providerUi) {
const { initProviderConnections } = await import('./provider-connections.js');
state.providerUi = initProviderConnections({
api, state, toast, showDialog,
onReadinessChange(readiness) { state.providerReadiness = readiness; renderProviderSummary(); },
});
}
return state.providerUi.open(options);
}
const centers={};
const CENTER_SPECS={integratedBrowser:['/integrated-browser-center.js','initIntegratedBrowserCenter','integrated-browser-center','integrated-browser-button',()=>({api,state,toast,setView})],secrets:['/secrets-manager.js','initSecretsManager','secrets-manager','secrets-manager-button',()=>({api,toast,setView})],runtime:['./runtime-control-center.js','initRuntimeControlCenter','runtime-control-center','runtime-center-button',()=>({api,toast,setView})],sandbox:['/sandbox-manager.js','initSandboxManager','sandbox-manager','sandbox-manager-button',()=>({api,state,toast,setView})],trust:['./workspace-trust-center.js','initWorkspaceTrustCenter','workspace-trust-center','workspace-trust-button',()=>({api,state,toast,setView})],operations:['/agent-operations-center.js','initAgentOperationsCenter','agent-operations-center','agent-operations-button',()=>({api,state,toast,setView})],contextMemory:['/context-memory-center.js','initContextMemoryCenter','context-memory-center','context-memory-button',()=>({api,state,toast,setView})],traceEvidence:['/trace-evidence-center.js','initTraceEvidenceCenter','trace-evidence-center','trace-evidence-button',()=>({api,state,toast,setView})],repositoryIntelligence:['/repository-intelligence-center.js','initRepositoryIntelligenceCenter','repository-intelligence-center','repository-intelligence-button',()=>({api,state,toast,setView})],codebaseKnowledge:['/codebase-knowledge-center.js','initCodebaseKnowledgeCenter','codebase-knowledge-center','codebase-knowledge-button',()=>({api,state,toast,setView})],localOperations:['/local-operations-center.js','initLocalOperationsCenter','local-operations-center','local-operations-button',()=>({api,state,toast,setView})],evidenceRuntime:['/evidence-runtime-center.js','initEvidenceRuntimeCenter','evidence-runtime-center','evidence-runtime-button',()=>({api,state,toast,setView})],gitGovernance:['/git-governance-center.js','initGitGovernanceCenter','git-governance-center','git-governance-button',()=>({api,state,toast,setView})],instructionGovernance:['/instruction-governance-center.js','initInstructionGovernanceCenter','instruction-governance-center','instruction-governance-button',()=>({api,state,toast,setView})],agentModes:['/agent-modes-center.js','initAgentModesCenter','agent-modes-center','agent-modes-button',()=>({api,state,toast,setView,openRun})],missionState:['/mission-state-center.js','initMissionStateCenter','mission-state-center','mission-state-button',()=>({api,state,toast,setView})],collaborationExperience:['/collaboration-experience-center.js','initCollaborationExperienceCenter','collaboration-experience-center','collaboration-experience-button',()=>({api,state,toast,setView})]};
async function openCenter(name){const spec=CENTER_SPECS[name];if(!centers[name]){const module=await import(spec[0]);centers[name]=module[spec[1]](spec[4]())}return centers[name].open()}
async function openShell(name){const route=SHELL_ROUTES[name];if(route==='home')return newTask();if(route==='task'){if(state.currentRun)return setView('task');return openCenter('missionState')}if(route==='evidenceRuntime')return openCenter('evidenceRuntime')}
let diffReviewCenter=null;
async function ensureDiffReviewCenter(){if(!diffReviewCenter){const{createDiffReviewCenter}=await import('./diff-review-center.js');diffReviewCenter=createDiffReviewCenter({root:$('diff-review-center'),api,toast})}return diffReviewCenter}
async function loadDiffReview(missionId,options={}){return (await ensureDiffReviewCenter()).load(missionId,options)}
function missionStatus(snapshot) {
const status = snapshot?.mission?.status ?? 'planning';
if (snapshot?.running) return 'running';
return status;
}
function statusLabel(snapshot) {
const status = missionStatus(snapshot);
return ({ planning: 'Đang chuẩn bị', running: 'Đang chạy', paused: 'Tạm dừng', stopped: 'Đã dừng', completed: 'Hoàn thành', failed: 'Có lỗi', 'rolled-back': 'Đã hoàn tác' })[status] ?? status;
}
function setView(name) {
$('home-view').hidden = name !== 'home';
$('task-view').hidden = name !== 'task';
for (const [id, spec] of Object.entries(CENTER_SPECS)) { const root = $(spec[2]); if (root) root.hidden = name !== id; $(spec[3]).classList.toggle('active', name === id); }
all('.primary-shell-button').forEach((button)=>button.classList.toggle('active',SHELL_ROUTES[button.dataset.shell]===name||(button.dataset.shell==='work'&&name==='missionState')));
if (name === 'home') state.currentRun = null;
}
function currentProject() { return state.projects.find((project) => project.id === state.projectId) ?? null; }
function renderProjectMenu() {
const current = currentProject();
$('current-project-name').textContent = current?.name ?? 'Chưa chọn dự án';
$('project-menu').replaceChildren(...state.projects.map((project) => {
const button = document.createElement('button');
button.type = 'button';
button.role = 'option';
button.className = project.id === state.projectId ? 'selected' : '';
button.textContent = project.name;
button.onclick = async () => { $('project-menu').hidden = true; await selectProject(project.id); };
return button;
}), (() => {
const button = document.createElement('button');
button.type = 'button';
button.textContent = '+ Mở dự án khác';
button.onclick = () => { $('project-menu').hidden = true; showDialog('project-dialog'); };
return button;
})());
}
async function loadProjects() {
state.projects = await api('/api/projects');
if (state.projectId && !state.projects.some((project) => project.id === state.projectId)) state.projectId = null;
if (!state.projectId && state.projects[0]) state.projectId = state.projects[0].id;
if (state.projectId) localStorage.setItem('forgeProjectId', state.projectId);
renderProjectMenu();
if (!state.projects.length) showDialog('project-dialog');
}
async function loadAutonomy() {
if (!state.projectId) return;
const grant = await api(`/api/projects/${encodeURIComponent(state.projectId)}/autonomy`);
state.autonomyProfile = grant?.profile ?? 'workspace-autopilot';
$('autonomy-select').value = state.autonomyProfile;
const labels = { guided: 'Hỏi trước khi thay đổi', 'workspace-autopilot': 'Tự động trong workspace', 'sandbox-autopilot': 'Tự động trong sandbox' };
all('#autopilot-summary small, #composer-autopilot span:nth-child(2)').forEach((node) => { node.textContent = labels[state.autonomyProfile] ?? 'Tự động'; });
}
async function selectProject(projectId) {
state.projectId = projectId;
localStorage.setItem('forgeProjectId', projectId);
renderProjectMenu();
await Promise.all([loadAutonomy(), loadRuns()]);
if (state.workroomLoaded) await state.workroom?.setProject(projectId);
if (state.goalOsLoaded) await state.goalOs?.setProject(projectId);
for (const center of Object.values(centers)) await center.setProject?.(projectId);
}
function recentItem(snapshot) {
const button = document.createElement('button');
button.type = 'button';
button.className = `run-item${state.currentRun?.mission?.id === snapshot.mission.id ? ' active' : ''}`;
const status = missionStatus(snapshot);
const dot = document.createElement('span'); dot.className = `run-status-dot ${status}`;
const copy = document.createElement('span'); copy.className = 'run-item-copy';
const title = document.createElement('strong'); title.textContent = snapshot.mission.objective;
const meta = document.createElement('small'); meta.textContent = `${statusLabel(snapshot)} · ${relativeTime(snapshot.mission.updatedAt || snapshot.mission.createdAt)}`;
copy.append(title, meta); button.append(dot, copy);
button.onclick = () => openRun(snapshot.mission.id).catch((error) => toast(error.message, true));
return button;
}
function renderRecentRuns() {
const list = $('recent-runs');
if (!state.recentRuns.length) {
const empty = document.createElement('div'); empty.className = 'empty-history'; empty.textContent = 'Chưa có nhiệm vụ nào trong dự án này.'; list.replaceChildren(empty); return;
}
list.replaceChildren(...state.recentRuns.map(recentItem));
}
async function loadRuns() {
if (!state.projectId) { state.recentRuns = []; renderRecentRuns(); return; }
state.recentRuns = await api(`/api/agent/runs?projectId=${encodeURIComponent(state.projectId)}&limit=50`);
renderRecentRuns();
}
function renderMessages(snapshot) {
const fragment = document.createDocumentFragment();
for (const message of snapshot.messages ?? []) {
const article = document.createElement('article'); article.className = `message ${message.role}${message.status === 'error' ? ' error' : ''}`;
const meta = document.createElement('div'); meta.className = 'message-meta';
if (message.role === 'assistant') {
const avatar = document.createElement('span'); avatar.className = 'message-avatar'; avatar.innerHTML = icon('spark'); meta.append(avatar);
}
const author = document.createElement('span'); author.textContent = message.role === 'user' ? 'Bạn' : 'Nolane Agent';
const time = document.createElement('span'); time.textContent = relativeTime(message.createdAt);
meta.append(author, time);
const bubble = document.createElement('div'); bubble.className = 'message-bubble'; bubble.textContent = message.content;
article.append(meta, bubble); fragment.append(article);
}
$('message-list').replaceChildren(fragment);
}
function renderFailure(snapshot) {
const card = $('failure-card');
const failure = snapshot?.failure;
card.hidden = !failure;
if (!failure) return;
const labels = { verification: 'Kiểm chứng thất bại', model: 'Kết nối AI bị gián đoạn', permission: 'Cần quyền bổ sung', planning: 'Lập kế hoạch thất bại', execution: 'Bước thực hiện bị lỗi' };
$('failure-stage').textContent = labels[failure.stage] ?? labels.execution;
$('failure-reason').textContent = failure.reason || 'Nolane Agent gặp lỗi chưa xác định.';
$('failure-help').textContent = failure.recoverable
? 'Gửi thêm hướng dẫn hoặc nhấn Thử lại. Nolane Agent sẽ tự tiếp tục từ checkpoint gần nhất, không làm lại từ đầu.'
: 'Mở Chi tiết kỹ thuật để xem thêm thông tin.';
}
function latestActiveActivity(snapshot) {
const items = snapshot.activities?.activities ?? [];
return [...items].reverse().find((item) => item.status === 'active') ?? items.at(-1) ?? null;
}
function renderLiveOperation(snapshot) {
const item = latestActiveActivity(snapshot);
$('live-provider').textContent = item?.providerId || snapshot.mission.metadata?.providerId || 'Nolane Agent tự chọn';
$('live-target').textContent = item?.target || item?.details?.command || 'Đang làm việc trong worktree';
$('live-action').textContent = item?.title || 'Đang chuẩn bị';
$('live-progress-time').textContent = relativeTime(item?.time || snapshot.activities?.lastHeartbeatAt);
}
function renderActivities(snapshot) {
const items = snapshot.activities?.activities ?? [];
$('activity-count').textContent = `${items.length} hoạt động`;
const fragment = document.createDocumentFragment();
for (const item of items.slice(-40)) {
const row = document.createElement('article'); row.className = `activity-item ${item.status}`;
const copy = document.createElement('div'); copy.className = 'activity-copy';
const title = document.createElement('strong'); title.textContent = item.title;
const explanation = document.createElement('p'); explanation.textContent = item.explanation;
copy.append(title, explanation);
const metaItems = [];
if (item.providerId) metaItems.push(item.providerId);
if (item.target) metaItems.push(item.target);
if (item.tokenUsage?.totalTokens) metaItems.push(formatTokens(item.tokenUsage.totalTokens, item.tokenUsage.estimated === true));
if (item.details?.durationMs) metaItems.push(`${item.details.durationMs} ms`);
if (item.details?.exitCode !== null && item.details?.exitCode !== undefined) metaItems.push(`exit ${item.details.exitCode}`);
if (item.details?.bytes) metaItems.push(`${item.details.bytes.toLocaleString('vi-VN')} byte`);
if (metaItems.length) { const meta = document.createElement('div'); meta.className = 'activity-meta'; meta.append(...metaItems.map((value) => { const chip = document.createElement('span'); chip.textContent = value; return chip; })); copy.append(meta); }
const time = document.createElement('span'); time.className = 'activity-time'; time.textContent = relativeTime(item.time);
row.append(copy, time); fragment.append(row);
}
$('activity-stream').replaceChildren(fragment);
$('activity-stream').hidden = !state.activityExpanded;
}
function taskStatusVietnamese(status) {
return ({ ready: 'Sẵn sàng', claimed: 'Đã nhận', running: 'Đang làm', review: 'Đang kiểm tra', done: 'Hoàn thành', failed: 'Có lỗi', blocked: 'Bị chặn', cancelled: 'Đã hủy' })[status] ?? status;
}
function renderReview(review) {
if (!review) return;
const changes = Array.isArray(review.changes) ? review.changes : [];
$('changes-summary').replaceChildren(...changes.map((change) => {
const card = document.createElement('article'); card.className = 'summary-card';
const title = document.createElement('strong'); title.textContent = change.title;
const text = document.createElement('p'); text.textContent = change.summary || 'Thay đổi đã được Nolane Agent kiểm chứng.';
card.append(title, text);
if (change.files?.length) {
const files = document.createElement('div'); files.className = 'summary-files';
files.append(...change.files.slice(0, 20).map((file) => { const chip = document.createElement('span'); chip.className = 'summary-file'; chip.textContent = file; return chip; }));
card.append(files);
}
return card;
}));
if (!changes.length) $('changes-summary').innerHTML = '<div class="summary-empty">Nhiệm vụ không tạo thay đổi tệp cần hiển thị.</div>';
const verification = review.verification ?? { status: 'pending', checks: [] };
const card = document.createElement('article'); card.className = 'summary-card';
const title = document.createElement('strong');
title.className = verification.status === 'pass' ? 'verification-pass' : verification.status === 'fail' ? 'verification-fail' : '';
title.textContent = verification.status === 'pass' ? `Đã vượt ${verification.passed}/${verification.total} kiểm tra` : verification.status === 'fail' ? 'Có kiểm tra chưa vượt qua' : 'Chưa có kết quả kiểm chứng';
card.append(title);
for (const check of verification.checks ?? []) { const row = document.createElement('p'); row.textContent = check; card.append(row); }
$('tests-summary').replaceChildren(card);
$('rollback-run').hidden = review.canRollback !== true;
void loadDiffReview(review.missionId).catch((error) => { if (error.status !== 404) console.warn('Diff Review Center:', error); });
}
function renderInspector(snapshot) {
const tasks = snapshot.activities?.tasks ?? [];
$('plan-list').replaceChildren(...tasks.map((task, index) => {
const row = document.createElement('article'); row.className = `plan-item ${task.status}`;
const number = document.createElement('span'); number.className = 'plan-number'; number.innerHTML = task.status === 'done' ? icon('check') : String(index + 1);
const copy = document.createElement('div');
const title = document.createElement('strong'); title.textContent = task.title;
const meta = document.createElement('small'); meta.textContent = task.role === 'scout' ? 'Tìm hiểu dự án' : task.role === 'reviewer' ? 'Kiểm tra độc lập' : task.role === 'integrator' ? 'Tích hợp kết quả' : 'Xây dựng';
copy.append(title, meta);
const status = document.createElement('span'); status.className = 'plan-status'; status.textContent = taskStatusVietnamese(task.status);
row.append(number, copy, status); return row;
}));
if (!tasks.length) $('plan-list').innerHTML = '<div class="summary-empty">Nolane Agent đang tạo kế hoạch thực hiện.</div>';
const builders = tasks.filter((task) => task.role === 'builder' || task.role === 'integrator');
$('changes-summary').replaceChildren(...(builders.length ? builders : tasks.slice(0, 3)).map((task) => {
const card = document.createElement('article'); card.className = 'summary-card';
const title = document.createElement('strong'); title.textContent = task.title;
const text = document.createElement('p'); text.textContent = task.status === 'done' ? 'Thay đổi của bước này đã được kiểm chứng.' : `Trạng thái: ${taskStatusVietnamese(task.status)}.`;
card.append(title, text); return card;
}));
if (!tasks.length) $('changes-summary').innerHTML = '<div class="summary-empty">Chưa có thay đổi nào.</div>';
const phase = snapshot.activities?.currentPhase;
const testCard = document.createElement('article'); testCard.className = 'summary-card';
const testTitle = document.createElement('strong');
const testText = document.createElement('p');
if (snapshot.mission.status === 'completed') { testTitle.textContent = 'Cổng kiểm chứng đã vượt qua'; testText.textContent = 'Các task chỉ được hoàn thành sau khi evidence và test hợp lệ.'; }
else if (snapshot.mission.status === 'failed') { testTitle.textContent = 'Kiểm chứng chưa vượt qua'; testText.textContent = 'Nolane Agent đã dừng an toàn và giữ checkpoint để thử lại.'; }
else if (phase === 'testing' || phase === 'reviewing') { testTitle.textContent = 'Đang chạy kiểm chứng'; testText.textContent = 'Nolane Agent đang kiểm tra diff, test và bằng chứng độc lập.'; }
else { testTitle.textContent = 'Chưa đến bước kiểm thử'; testText.textContent = 'Kết quả sẽ xuất hiện tự động khi Nolane Agent hoàn tất thay đổi.'; }
testCard.append(testTitle, testText); $('tests-summary').replaceChildren(testCard);
const previewUrl = snapshot.mission.metadata?.previewUrl;
$('preview-empty').hidden = Boolean(previewUrl);
$('live-preview').hidden = !previewUrl;
if (previewUrl && $('live-preview').src !== previewUrl) $('live-preview').src = previewUrl;
if (state.review?.missionId === snapshot.mission.id) renderReview(state.review);
else $('rollback-run').hidden = true;
}
function updateRunHeader(snapshot) {
const view = deriveRunView(snapshot);
$('task-title').textContent = view.title;
$('run-status-pill').className = `status-pill ${view.statusTone === 'green' ? 'green' : view.statusTone === 'red' ? 'red' : ''}`;
$('run-status-pill').querySelector('strong').textContent = view.statusLabel;
$('active-title').textContent = view.activeTitle;
$('active-explanation').textContent = view.activeExplanation;
$('task-progress').textContent = `${view.progress.done} / ${view.progress.total || '…'} bước`;
$('elapsed-time').textContent = view.elapsed;
$('token-usage').textContent = view.tokens;
$('heartbeat-status').textContent = view.stale ? 'Chưa có tiến triển mới' : `Hoạt động ${relativeTime(snapshot.activities?.lastHeartbeatAt)}`;
const percent = view.progress.total ? Math.max(4, Math.round((view.progress.done / view.progress.total) * 100)) : 8;
$('progress-bar').style.width = `${view.terminal ? 100 : percent}%`;
const paused = snapshot.mission.status === 'paused';
const terminal = view.terminal;
$('pause-run').hidden = paused || terminal;
$('resume-run').hidden = !paused;
$('retry-run').hidden = snapshot.mission.status !== 'failed';
$('stop-run').hidden = terminal;
$('follow-up-composer').hidden = snapshot.mission.status === 'completed' || snapshot.mission.status === 'stopped';
$('follow-up-input').placeholder = snapshot.mission.status === 'failed'
? 'Nói Nolane Agent cách xử lý; gửi tin nhắn để Tự tiếp tục từ checkpoint...'
: 'Nhắn thêm hoặc đổi hướng trong lúc Nolane Agent đang làm...';
}
function renderRun(snapshot, { preserveScroll = true } = {}) {
const scroll = $('conversation-scroll');
const nearBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 100;
state.currentRun = snapshot;
setView('task');
renderMessages(snapshot);
renderFailure(snapshot);
renderActivities(snapshot);
renderLiveOperation(snapshot);
renderInspector(snapshot);
ensureGoalOs().then((goalOs) => goalOs.loadForSnapshot(snapshot)).catch((error) => console.warn('Goal OS view:', error));
updateRunHeader(snapshot);
renderRecentRuns();
if (!preserveScroll || nearBottom) requestAnimationFrame(() => { scroll.scrollTop = scroll.scrollHeight; });
}
async function loadReview(missionId) {
const review = await api(`/api/agent/runs/${encodeURIComponent(missionId)}/review`);
state.review = review;
if (state.currentRun?.mission?.id === missionId) renderReview(review);
return review;
}
function reviewReady(snapshot) {
return ['completed', 'failed', 'stopped', 'rolled-back'].includes(snapshot?.mission?.status);
}
async function openRun(missionId) {
const snapshot = await api(`/api/agent/runs/${encodeURIComponent(missionId)}`);
state.review = null;
if (diffReviewCenter) diffReviewCenter.clear();
renderRun(snapshot, { preserveScroll: false });
if (reviewReady(snapshot)) await loadReview(missionId).catch(() => null);
}
async function startRun(objective) {
if (!state.projectId) { showDialog('project-dialog'); throw new Error('Hãy mở một dự án trước'); }
if (!state.providerReadiness?.ready) {
await openProviderCenter({ message: 'Nolane Agent cần một kết nối AI trước khi nhận nhiệm vụ. Yêu cầu của bạn vẫn được giữ nguyên.' });
return null;
}
let snapshot;
try {
const created = await api('/api/goals', {
method: 'POST',
body: JSON.stringify({
projectId: state.projectId,
title: objective.slice(0, 120),
objective,
start: true,
autonomyProfile: state.autonomyProfile,
providerId: 'auto',
goalAutoApplyPlanPatches: true,
browserAllowedActions: ['open', 'goto', 'snapshot', 'find', 'tabs', 'screenshot', 'close', 'status'],
}),
});
state.currentGoal = created.goal;
snapshot = created.run;
} catch (error) {
if (error.payload?.code === 'provider_setup_required') {
state.providerReadiness = error.payload.readiness ?? { ready: false, readyProviders: [] };
renderProviderSummary();
await openProviderCenter({ message: 'Kết nối AI đã hết hạn hoặc chưa hoàn tất. Đăng nhập lại rồi bấm Bắt đầu.' });
return null;
}
throw error;
}
$('objective-input').value = '';
state.recentRuns.unshift(snapshot);
state.review = null;
if (diffReviewCenter) diffReviewCenter.clear();
renderRun(snapshot, { preserveScroll: false });
toast('Nolane Agent đã nhận nhiệm vụ và bắt đầu tự động');
return snapshot;
}
async function sendFollowUp(content) {
if (content.startsWith('/')) { await executeSlashCommand(content); $('follow-up-input').value = ''; return; }
const id = state.currentRun?.mission?.id;
if (!id) return;
await api(`/api/agent/runs/${encodeURIComponent(id)}/messages`, { method: 'POST', body: JSON.stringify({ content }) });
$('follow-up-input').value = '';
const wasFailed = state.currentRun?.mission?.status === 'failed';
await refreshCurrent();
toast(wasFailed ? 'Đã nhận hướng dẫn. Nolane Agent đang tự tiếp tục từ checkpoint.' : 'Hướng dẫn sẽ được áp dụng ở checkpoint an toàn tiếp theo');
}
async function runAction(action) {
const id = state.currentRun?.mission?.id;
if (!id) return;
const suffix = RUN_ACTION_PATHS[action];
if (!suffix) throw new Error(`Unknown run action: ${action}`);
const snapshot = await api(`/api/agent/runs/${encodeURIComponent(id)}${suffix}`, { method: 'POST', body: '{}' });
renderRun(snapshot);
toast(({ pause: 'Đã tạm dừng an toàn', resume: 'Nolane Agent đã tiếp tục', stop: 'Đã dừng nhiệm vụ', retry: 'Nolane Agent đang thử lại' })[action]);
}
async function rollbackCurrent() {
const id = state.currentRun?.mission?.id;
if (!id) return;
if (!window.confirm('Hoàn tác toàn bộ thay đổi của nhiệm vụ này trong worktree cô lập?')) return;
const result = await api(`/api/agent/runs/${encodeURIComponent(id)}/rollback`, { method: 'POST', body: '{}' });
state.review = result.review ?? null;
renderRun(result, { preserveScroll: false });
if (state.review) renderReview(state.review);
await loadRuns();
toast('Đã hoàn tác thay đổi; dự án chính vẫn nguyên vẹn');
}
async function refreshCurrent() {
const id = state.currentRun?.mission?.id;
if (!id || state.refreshing) { state.refreshAgain = Boolean(id); return; }
state.refreshing = true;
try {
const snapshot = await api(`/api/agent/runs/${encodeURIComponent(id)}`);
renderRun(snapshot);
if (reviewReady(snapshot) && state.review?.missionId !== id) await loadReview(id).catch(() => null);
} catch (error) {
if (error.status !== 404) console.warn(error);
} finally {
state.refreshing = false;
if (state.refreshAgain) { state.refreshAgain = false; setTimeout(refreshCurrent, 60); }
}
}
const refreshCoalescer = createRefreshCoalescer({
delayMs: 120,
refresh: async ({ recent }) => {
await refreshCurrent();
if (recent) await loadRuns();
},
});
function scheduleRefresh(options = {}) {
refreshCoalescer.request(options);
}
function connectEvents() {
if (!token) return;
const source = new EventSource(`/events?token=${encodeURIComponent(token)}`);
source.onopen = () => { $('connection').className = 'connection-dot ok'; $('connection').title = 'Đã kết nối'; };
source.onerror = () => { $('connection').className = 'connection-dot error'; $('connection').title = 'Mất kết nối, đang thử lại'; };
source.onmessage = () => scheduleRefresh();
const eventTypes = ['run.created', 'run.planning.started', 'run.autopilot.started', 'run.autopilot.completed', 'run.autopilot.failed', 'mission.planned', 'mission.task.started', 'mission.task.awaiting-verification', 'mission.task.verified', 'agent.model.requested', 'agent.model.completed', 'agent.tool.completed', 'goal.fact.recorded', 'goal.plan.patch-proposed', 'goal.plan.patch-applied', 'goal.schedule.started', 'goal.schedule.completed', 'agent.browser.tools-authorized', 'agent.plugins.selected'];
for (const type of eventTypes) source.addEventListener(type, () => scheduleRefresh({ recent: type.startsWith('run.') }));
}
async function openAdvanced() {
$('advanced-drawer').hidden = false;
$('drawer-backdrop').hidden = false;
if (!state.workroomLoaded) {
const { initWorkroom } = await import('./workroom.js');
state.workroom = initWorkroom({ api, state, toast, token });
state.workroomLoaded = true;
}
if (state.projectId) await state.workroom?.setProject(state.projectId);
const goalOs = await ensureGoalOs();
if (state.projectId) await goalOs.setProject(state.projectId);
}
function closeAdvanced() { $('advanced-drawer').hidden = true; $('drawer-backdrop').hidden = true; }
function openCommandPalette() {
const actions = [
{ label: 'Nhiệm vụ mới', hint: 'Ctrl N', run: () => newTask() },
{ label: 'Mở chi tiết kỹ thuật', hint: 'Ctrl `', run: () => openAdvanced() },
...Object.entries(CENTER_SPECS).map(([id]) => ({ label: ({integratedBrowser:'Integrated Browser',secrets:'Secrets Manager',runtime:'Runtime Control Center',trust:'Workspace Trust Center',operations:'Agent Operations Center',contextMemory:'Context & Memory Center',traceEvidence:'Trace & Evidence Center',repositoryIntelligence:'Repository Intelligence Center',codebaseKnowledge:'Codebase Knowledge Graph',localOperations:'Local Operations & Human Control',gitGovernance:'Git Governance Center',instructionGovernance:'Instruction Governance Center',agentModes:'Agent Modes & Autonomy',missionState:'Mission State & Progress'})[id], hint: '', run: () => openCenter(id) })),
{ label: 'Kết nối AI', hint: '', run: () => openProviderCenter() },
{ label: 'Cài đặt Autopilot', hint: '', run: () => showDialog('settings-dialog') },
{ label: 'Mở dự án khác', hint: '', run: () => showDialog('project-dialog') },
];
$('command-results').replaceChildren(...actions.map((action) => {
const button = document.createElement('button'); button.type = 'button'; button.className = 'command-result';
const label = document.createElement('span'); label.textContent = action.label;
const hint = document.createElement('small'); hint.textContent = action.hint;
button.append(label, hint); button.onclick = () => { closeDialog('command-dialog'); action.run(); };
return button;
}));
showDialog('command-dialog'); requestAnimationFrame(() => $('command-input').focus());
}
function newTask() {
setView('home');
requestAnimationFrame(() => $('objective-input').focus());
}
function autoGrow(textarea) {
textarea.style.height = 'auto';
textarea.style.height = `${Math.min(130, textarea.scrollHeight)}px`;
}
$('agent-composer').onsubmit = async (event) => {
event.preventDefault();
const objective = $('objective-input').value.trim();
if (!objective) return;
$('start-run-button').disabled = true;
try { if (objective.startsWith('/')) { await executeSlashCommand(objective); $('objective-input').value = ''; } else await startRun(objective); } catch (error) { toast(error.message, true); } finally { $('start-run-button').disabled = false; }
};
$('follow-up-composer').onsubmit = async (event) => {
event.preventDefault(); const content = $('follow-up-input').value.trim(); if (!content) return;
try { await sendFollowUp(content); } catch (error) { toast(error.message, true); }
};
$('objective-input').addEventListener('keydown', (event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) $('agent-composer').requestSubmit(); });
$('follow-up-input').addEventListener('input', (event) => autoGrow(event.currentTarget));
$('follow-up-input').addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('follow-up-composer').requestSubmit(); } });
all('.suggestion').forEach((button) => { button.onclick = () => { $('objective-input').value = button.dataset.prompt; $('objective-input').focus(); }; });
all('.primary-shell-button').forEach((button)=>{button.onclick=()=>openShell(button.dataset.shell).catch((error)=>toast(error.message,true))});
$('new-task-wide').onclick = newTask;
$('brand-home').onclick = newTask;
for (const [id, spec] of Object.entries(CENTER_SPECS)) $(spec[3]).onclick = () => openCenter(id).catch((error) => toast(error.message, true));
$('mobile-history-button').onclick = () => document.body.classList.toggle('mobile-history-open');
$('collapse-sidebar').onclick = () => document.body.classList.toggle('sidebar-collapsed');
$('project-switcher').onclick = () => { $('project-menu').hidden = !$('project-menu').hidden; $('project-switcher').setAttribute('aria-expanded', String(!$('project-menu').hidden)); };
$('refresh-runs').onclick = () => loadRuns().catch((error) => toast(error.message, true));
$('settings-button').onclick = () => showDialog('settings-dialog');
$('provider-summary').onclick = () => openProviderCenter().catch((error) => toast(error.message, true));
$('composer-provider').onclick = () => openProviderCenter().catch((error) => toast(error.message, true));
$('autopilot-summary').onclick = () => showDialog('settings-dialog');
$('composer-autopilot').onclick = () => showDialog('settings-dialog');
$('command-button').onclick = openCommandPalette;
$('command-input').addEventListener('keydown', async (event) => {
if (event.key !== 'Enter') return;
const command = event.currentTarget.value.trim();
if (!command.startsWith('/')) return;
event.preventDefault();
try { await executeSlashCommand(command); } catch (error) { toast(error.message, true); }
});
$('pause-run').onclick = () => runAction('pause').catch((error) => toast(error.message, true));
$('resume-run').onclick = () => runAction('resume').catch((error) => toast(error.message, true));
$('retry-run').onclick = () => runAction('retry').catch((error) => toast(error.message, true));
$('stop-run').onclick = () => runAction('stop').catch((error) => toast(error.message, true));
$('rollback-run').onclick = () => rollbackCurrent().catch((error) => toast(error.message, true));
$('open-advanced').onclick = () => openAdvanced().catch((error) => toast(error.message, true));
$('close-advanced').onclick = closeAdvanced;
$('drawer-backdrop').onclick = closeAdvanced;
$('activity-toggle').onclick = () => { state.activityExpanded = !state.activityExpanded; $('activity-toggle').setAttribute('aria-expanded', String(state.activityExpanded)); $('activity-stream').hidden = !state.activityExpanded; };
all('.inspector-tab').forEach((tab) => { tab.onclick = () => { state.inspectorTab = tab.dataset.inspector; all('.inspector-tab').forEach((item) => item.classList.toggle('active', item === tab)); all('.inspector-view').forEach((view) => view.classList.toggle('active', view.dataset.inspectorView === state.inspectorTab)); $('inspector-panel').classList.add('open'); }; });
all('[data-close-dialog]').forEach((button) => { button.onclick = () => closeDialog(button.dataset.closeDialog); });
$('manage-projects').onclick = () => { closeDialog('settings-dialog'); showDialog('project-dialog'); };
$('save-settings').onclick = async () => {
if (!state.projectId) return;
try {
const profile = $('autonomy-select').value;
await api(`/api/projects/${encodeURIComponent(state.projectId)}/autonomy`, { method: 'PUT', body: JSON.stringify({ profile, scope: { allowedPaths: ['**'], deniedPaths: ['.env', '.env.*', '**/*.pem', '**/*.key'], managedWorktreesOnly: profile !== 'guided' } }) });
state.autonomyProfile = profile; await loadAutonomy(); closeDialog('settings-dialog'); toast('Đã lưu mức tự động cho dự án');
} catch (error) { toast(error.message, true); }
};
$('browse-workspace').onclick = async () => {
try {
const selected = await window.nolaneDesktop?.selectDirectory?.();
if (selected) { $('workspace-root').value = selected; $('project-name').value = selected.split(/[\\/]/).filter(Boolean).at(-1) || $('project-name').value; }
} catch (error) { toast(`Không thể mở trình chọn thư mục: ${error.message}`, true); }
};
$('project-form').onsubmit = async (event) => {
event.preventDefault();
try {
const project = await api('/api/projects', { method: 'POST', body: JSON.stringify({ name: $('project-name').value.trim(), workspaceRoot: $('workspace-root').value.trim() }) });
closeDialog('project-dialog'); await loadProjects(); await selectProject(project.id); newTask(); toast('Nolane Agent đã mở dự án');
if (!state.providerReadiness?.ready) await openProviderCenter({ message: 'Dự án đã sẵn sàng. Bây giờ hãy kết nối AI để Nolane Agent có thể bắt đầu làm việc.' });
} catch (error) { toast(error.message, true); }
};
$('attach-button').onclick = () => {
const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.accept = '.md,.txt,.json,.js,.mjs,.ts,.tsx,.jsx,.py,.rs,.go,.java,.css,.html,.yaml,.yml,.toml';
input.onchange = async () => {
const files = [...input.files].slice(0, 5).filter((file) => file.size <= 1_000_000);
const chunks = await Promise.all(files.map(async (file) => `\n\n--- ${file.name} ---\n${(await file.text()).slice(0, 20_000)}`));
$('objective-input').value += chunks.join(''); $('objective-input').focus(); toast(`Đã đính kèm ${files.length} tệp văn bản vào yêu cầu`);
};
input.click();
};
window.addEventListener('keydown', (event) => {
if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openCommandPalette(); }
if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') { event.preventDefault(); newTask(); }
if ((event.ctrlKey || event.metaKey) && event.key === '`') { event.preventDefault(); $('advanced-drawer').hidden ? openAdvanced().catch((error) => toast(error.message, true)) : closeAdvanced(); }
if (event.key === 'Escape') { $('project-menu').hidden = true; document.body.classList.remove('mobile-history-open'); }
});
document.addEventListener('click', (event) => { if (!event.target.closest('.project-switcher-wrap')) $('project-menu').hidden = true; });
setInterval(() => { if (state.currentRun) updateRunHeader(state.currentRun); }, 1_000).unref?.();
async function boot() {
try {
await loadRuntimePerformance();
state.resourceHud=initMissionResourceHud({api});
await state.resourceHud.refresh();
await Promise.all([loadProjects(), loadProviderReadiness()]);
if (state.projectId) await Promise.all([loadAutonomy(), loadRuns()]);
connectEvents();
$('connection').className = 'connection-dot ok';
if (state.recentRuns[0] && ['running', 'planning', 'paused'].includes(state.recentRuns[0].mission.status)) await openRun(state.recentRuns[0].mission.id);
else newTask();
if (state.projects.length && !state.providerReadiness.ready && !$('project-dialog').open) await openProviderCenter({ refresh: false });
} catch (error) {
$('connection').className = 'connection-dot error';
toast(`Không thể khởi động Nolane Agent: ${error.message}`, true);
}
}
boot();
