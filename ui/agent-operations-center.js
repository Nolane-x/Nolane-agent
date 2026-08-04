const TAB_LABELS = Object.freeze({ models: 'Models', tools: 'Tools', mcp: 'MCP', permissions: 'Permissions', agents: 'Agents' });

function ensureStyles() {
  if (document.querySelector('link[data-agent-operations-center]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = '/agent-operations-center.css'; link.dataset.agentOperationsCenter = 'true';
  document.head.append(link);
}

const markup = `
<section id="agent-operations-center" class="agent-operations-center view" hidden aria-labelledby="agent-operations-title">
<header class="ops-header"><div><span class="eyebrow">Governed agent infrastructure</span><h1 id="agent-operations-title">Agent Operations Center</h1><p>Điều hành model, tool, MCP, quyền và đội agent từ một bề mặt an toàn duy nhất.</p></div><div class="ops-header-actions"><button id="ops-detect-providers" class="secondary-button" type="button">Kiểm tra model</button><button id="ops-refresh" class="secondary-button" type="button">Làm mới</button></div></header>
<div id="ops-summary" class="ops-summary"></div>
<nav id="ops-tabs" class="ops-tabs" aria-label="Agent Operations Center tabs"></nav>
<section id="ops-panel-models" class="ops-panel"></section>
<section id="ops-panel-tools" class="ops-panel" hidden></section>
<section id="ops-panel-mcp" class="ops-panel" hidden></section>
<section id="ops-panel-permissions" class="ops-panel" hidden></section>
<section id="ops-panel-agents" class="ops-panel" hidden></section>
</section>`;

function node(tag, className, text) { const element = document.createElement(tag); if (className) element.className = className; if (text != null) element.textContent = String(text); return element; }
function badge(text, tone = 'neutral') { return node('span', `ops-badge ${tone}`, text); }
function empty(text) { return node('div', 'ops-empty', text); }
function comma(value) { return (value ?? []).join(', ') || '—'; }
function formatDate(value) { return value ? new Date(value).toLocaleString('vi-VN') : '—'; }
function splitCsv(value) { return [...new Set(String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean))]; }

export function initAgentOperationsCenter({ api, state, toast, setView }) {
  ensureStyles();
  const host = document.createElement('div'); host.innerHTML = markup.trim();
  const root = host.firstElementChild; document.querySelector('.main-stage').append(root);
  const get = (id) => root.querySelector(`#${id}`);
  let snapshot = null; let projectId = state.projectId; let activeTab = 'models'; let toolQuery = '';

  const setTab = (name) => {
    activeTab = name;
    for (const tab of Object.keys(TAB_LABELS)) {
      get(`ops-panel-${tab}`).hidden = tab !== name;
      root.querySelector(`[data-ops-tab="${tab}"]`)?.classList.toggle('active', tab === name);
    }
  };

  const renderSummary = () => {
    const values = snapshot?.summary ?? {};
    const cards = [
      ['Models ready', `${values.providersReady ?? 0}/${values.providers ?? 0}`, values.providersReady ? 'good' : 'warn'],
      ['Tool schemas', values.tools ?? 0, 'neutral'], ['MCP servers', values.mcpServers ?? 0, 'neutral'],
      ['Active grants', values.activeGrants ?? 0, values.activeGrants ? 'good' : 'neutral'],
      ['Active tasks', values.activeTasks ?? 0, values.activeTasks ? 'live' : 'neutral'],
    ].map(([label, value, tone]) => { const card = node('article', `ops-stat ${tone}`); card.append(node('small', '', label), node('strong', '', value)); return card; });
    get('ops-summary').replaceChildren(...cards);
  };

  const renderModels = () => {
    const panel = get('ops-panel-models'); const providers = snapshot?.providers ?? [];
    if (!providers.length) return panel.replaceChildren(empty('Chưa đăng ký model provider.'));
    const grid = node('div', 'ops-card-grid');
    for (const provider of providers) {
      const ready = provider.available && provider.authenticated && provider.healthy;
      const card = node('article', 'ops-card provider-card');
      const head = node('div', 'ops-card-head'); const title = node('div'); title.append(node('strong', '', provider.label || provider.id), node('small', '', `${provider.kind || 'provider'} · ${provider.version || 'version unknown'}`)); head.append(title, badge(ready ? 'READY' : 'ATTENTION', ready ? 'good' : 'warn'));
      const tiers = node('div', 'ops-tier-row'); tiers.append(badge(`Quality ${provider.qualityTier ?? '—'}`), badge(`Cost ${provider.costTier ?? '—'}`), badge(`Latency ${provider.latencyTier ?? '—'}`), provider.local ? badge('LOCAL', 'good') : badge('REMOTE'));
      const caps = node('p', 'ops-muted', `Capabilities: ${comma(provider.capabilities)}`);
      const status = node('p', ready ? 'ops-good-copy' : 'ops-warning-copy', provider.error || (ready ? 'Provider có thể nhận task.' : `available=${provider.available}, authenticated=${provider.authenticated}, healthy=${provider.healthy}`));
      card.append(head, tiers, caps, status); grid.append(card);
    }
    const planes = node('article', 'ops-plane-card'); planes.append(node('strong', '', 'Adaptive & Operating Planes'), node('p', 'ops-muted', `Adaptive: ${comma(snapshot?.planes?.adaptive?.capabilities)}`), node('p', 'ops-muted', `Operating: ${comma(snapshot?.planes?.operating?.capabilities)}`));
    panel.replaceChildren(grid, planes);
  };

  const renderTools = () => {
    const panel = get('ops-panel-tools');
    const toolbar = node('div', 'ops-toolbar'); const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Tìm tool theo tên, nguồn hoặc capability'; search.value = toolQuery; search.oninput = () => { toolQuery = search.value; renderTools(); }; toolbar.append(search, badge(`${snapshot?.summary?.pinnedTools ?? 0} pinned`, 'good'));
    const terms = toolQuery.toLowerCase().trim(); const tools = (snapshot?.tools ?? []).filter((item) => !terms || [item.name, item.source, item.capability, item.description, ...(item.tags ?? [])].join(' ').toLowerCase().includes(terms));
    const list = node('div', 'ops-table');
    for (const item of tools) { const row = node('article', 'ops-table-row'); const copy = node('div'); copy.append(node('strong', '', item.name), node('small', '', item.description)); const meta = node('div', 'ops-row-badges'); meta.append(badge(item.source || 'unknown'), item.capability ? badge(item.capability, 'warn') : badge('no extra capability'), item.pinned ? badge('PINNED', 'good') : badge('DYNAMIC')); row.append(copy, meta); list.append(row); }
    panel.replaceChildren(toolbar, tools.length ? list : empty('Không có tool phù hợp bộ lọc.'));
  };

  const renderMcp = () => {
    const panel = get('ops-panel-mcp'); const layout = node('div', 'ops-two-column');
    const serverBox = node('section', 'ops-section-card'); serverBox.append(node('h2', '', 'MCP servers'));
    for (const server of snapshot?.mcp?.servers ?? []) { const row = node('article', 'ops-table-row'); const copy = node('div'); copy.append(node('strong', '', server.label || server.id), node('small', '', `${server.kind || 'server'} · ${server.serverInfo?.name || 'unknown'} ${server.serverInfo?.version || ''}`)); row.append(copy, badge(server.state || 'configured', /ready|connected|running/i.test(server.state || '') ? 'good' : 'neutral')); serverBox.append(row); }
    if (!(snapshot?.mcp?.servers ?? []).length) serverBox.append(empty('Chưa cấu hình MCP server.'));
    const toolBox = node('section', 'ops-section-card'); toolBox.append(node('h2', '', 'Namespaced MCP tools'));
    for (const item of snapshot?.mcp?.tools ?? []) { const row = node('article', 'ops-table-row'); const copy = node('div'); copy.append(node('strong', '', item.name), node('small', '', item.description || item.originalName)); row.append(copy, badge(item.serverId || 'server')); toolBox.append(row); }
    if (!(snapshot?.mcp?.tools ?? []).length) toolBox.append(empty('Không có MCP tool được discover.'));
    layout.append(serverBox, toolBox); panel.replaceChildren(layout);
  };

  const grantForm = () => {
    const form = node('form', 'ops-grant-form');
    const capability = document.createElement('select'); capability.name = 'capability'; capability.required = true;
    for (const item of snapshot?.capabilities ?? []) { const option = document.createElement('option'); option.value = item.id; option.textContent = `${item.id} · ${item.risk}`; capability.append(option); }
    const principal = document.createElement('input'); principal.name = 'principalId'; principal.required = true; principal.value = 'agent-operator'; principal.placeholder = 'Principal ID';
    const effect = document.createElement('select'); effect.name = 'effect'; effect.innerHTML = '<option value="allow">Allow</option><option value="deny">Deny</option>';
    const mode = document.createElement('select'); mode.name = 'mode'; mode.innerHTML = '<option value="session">Session</option><option value="once">One time</option><option value="timed">Timed</option><option value="persistent">Persistent</option>';
    const session = document.createElement('input'); session.name = 'sessionId'; session.value = 'operations-center'; session.placeholder = 'Session ID';
    const expires = document.createElement('input'); expires.name = 'expiresAt'; expires.type = 'datetime-local';
    const scope = document.createElement('input'); scope.name = 'scope'; scope.placeholder = 'Scope: path/domain/command/tool, comma separated';
    const reason = document.createElement('input'); reason.name = 'reason'; reason.required = true; reason.placeholder = 'Lý do cấp quyền';
    const impact = document.createElement('input'); impact.name = 'impact'; impact.required = true; impact.placeholder = 'Tác động dự kiến';
    const submit = node('button', 'primary-button', 'Tạo grant'); submit.type = 'submit';
    form.append(capability, principal, effect, mode, session, expires, scope, reason, impact, submit);
    form.onsubmit = async (event) => {
      event.preventDefault(); const fd = new FormData(form); const selectedMode = String(fd.get('mode'));
      const scopeItems = splitCsv(fd.get('scope'));
      const body = { principalId: fd.get('principalId'), capabilities: [fd.get('capability')], effect: fd.get('effect'), mode: selectedMode, reason: fd.get('reason'), expectedImpact: fd.get('impact'), scope: { paths: scopeItems, domains: scopeItems, commands: scopeItems, arguments: [], repositories: [], tools: scopeItems } };
      if (selectedMode === 'session') body.sessionId = fd.get('sessionId');
      if (selectedMode === 'timed') body.expiresAt = new Date(fd.get('expiresAt')).toISOString();
      try { await api('/api/capability-grants', { method: 'POST', body: JSON.stringify(body) }); toast('Đã tạo capability grant.'); await load(); setTab('permissions'); } catch (error) { toast(error.message, true); }
    };
    return form;
  };

  const renderPermissions = () => {
    const panel = get('ops-panel-permissions'); const definitions = node('section', 'ops-section-card'); definitions.append(node('h2', '', 'Capability definitions'));
    const defGrid = node('div', 'ops-cap-grid'); for (const item of snapshot?.capabilities ?? []) { const card = node('article', 'ops-cap-card'); card.append(node('strong', '', item.id), badge(item.risk, item.risk === 'critical' ? 'danger' : item.risk === 'high' ? 'warn' : 'neutral'), node('small', '', `Approval: ${item.approval}`)); defGrid.append(card); } definitions.append(defGrid);
    const grants = node('section', 'ops-section-card'); grants.append(node('h2', '', 'Capability grants'), grantForm());
    for (const item of snapshot?.grants ?? []) {
      const row = node('article', `ops-grant-row${item.revokedAt ? ' revoked' : ''}`); const copy = node('div'); copy.append(node('strong', '', `${comma(item.capabilities)} → ${item.principalId}`), node('small', '', `${item.effect}/${item.mode} · ${item.reason} · ${formatDate(item.createdAt)}`));
      const actions = node('div', 'ops-row-badges'); actions.append(badge(item.revokedAt ? 'REVOKED' : 'ACTIVE', item.revokedAt ? 'danger' : 'good'));
      if (!item.revokedAt) { const revoke = node('button', 'ops-revoke-button', 'Thu hồi'); revoke.type = 'button'; revoke.onclick = async () => { try { await api(`/api/capability-grants/${encodeURIComponent(item.id)}`, { method: 'DELETE', body: JSON.stringify({ reason: 'Revoked from Agent Operations Center.' }) }); toast('Đã thu hồi capability grant.'); await load(); setTab('permissions'); } catch (error) { toast(error.message, true); } }; actions.append(revoke); }
      row.append(copy, actions); grants.append(row);
    }
    panel.replaceChildren(definitions, grants);
  };

  const renderAgents = () => {
    const panel = get('ops-panel-agents'); const layout = node('div', 'ops-two-column');
    const profiles = node('section', 'ops-section-card'); profiles.append(node('h2', '', 'Agent profiles'), badge(snapshot?.agents?.profilesState || 'unknown', snapshot?.agents?.profilesState === 'ready' ? 'good' : 'warn'));
    for (const item of snapshot?.agents?.profiles ?? []) { const card = node('article', 'ops-profile-card'); card.append(node('strong', '', item.id), node('p', 'ops-muted', item.description), node('small', '', `Tools: ${comma(item.tools)} · MCP: ${comma(item.mcpServers)} · Max turns: ${item.maxTurns || '—'}`)); profiles.append(card); }
    if (!(snapshot?.agents?.profiles ?? []).length) profiles.append(empty(snapshot?.agents?.profilesReason ? `Profiles bị chặn: ${snapshot.agents.profilesReason}` : 'Chưa có custom agent profile.'));
    const work = node('section', 'ops-section-card'); work.append(node('h2', '', 'Mission & task state'));
    for (const item of snapshot?.agents?.tasks ?? []) { const row = node('article', 'ops-table-row'); const copy = node('div'); copy.append(node('strong', '', item.title || item.id), node('small', '', `${item.role || 'worker'} · mission ${item.missionId}`)); row.append(copy, badge(item.status || 'unknown', /running|review|planning/.test(item.status || '') ? 'live' : /failed|blocked/.test(item.status || '') ? 'danger' : 'neutral')); work.append(row); }
    if (!(snapshot?.agents?.tasks ?? []).length) work.append(empty('Dự án chưa có task agent.'));
    layout.append(profiles, work); panel.replaceChildren(layout);
  };

  const render = () => { renderSummary(); renderModels(); renderTools(); renderMcp(); renderPermissions(); renderAgents(); setTab(activeTab); };
  const load = async () => { projectId = state.projectId; if (!projectId) { snapshot = null; render(); return null; } snapshot = await api(`/api/operations-center?projectId=${encodeURIComponent(projectId)}`); render(); return snapshot; };

  for (const [id, label] of Object.entries(TAB_LABELS)) { const button = node('button', id === activeTab ? 'active' : '', label); button.type = 'button'; button.dataset.opsTab = id; button.onclick = () => setTab(id); get('ops-tabs').append(button); }
  get('ops-refresh').onclick = () => load().catch((error) => toast(error.message, true));
  get('ops-detect-providers').onclick = async () => { try { await api('/api/providers/detect'); await load(); toast('Đã kiểm tra lại model providers.'); } catch (error) { toast(error.message, true); } };

  return Object.freeze({ async open() { setView('operations'); await load(); }, async setProject(id) { projectId = id; if (!root.hidden) await load(); }, load });
}
