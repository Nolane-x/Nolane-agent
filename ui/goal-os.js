function ensureModuleStyle(href) {
  if (document.querySelector(`link[data-forge-module-style="${href}"]`)) return;
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href; link.dataset.forgeModuleStyle = href; document.head.append(link);
}
ensureModuleStyle('/goal-os.css');
const byId = (id) => document.getElementById(id);
const BROWSER_ENDPOINTS = Object.freeze({ open: '/api/browser/open', snapshot: '/api/browser/snapshot', close: '/api/browser/close' });

function text(value, fallback = '—') {
  const out = String(value ?? '').trim();
  return out || fallback;
}

function boundedJson(value, max = 30_000) {
  const raw = JSON.stringify(value, null, 2);
  return raw.length <= max ? raw : `${raw.slice(0, max)}\n[TRUNCATED]`;
}

function empty(label) {
  const node = document.createElement('div');
  node.className = 'summary-empty';
  node.textContent = label;
  return node;
}

function feedRow(title, detail, tone = '') {
  const row = document.createElement('article');
  row.className = `goal-feed-row ${tone}`.trim();
  const strong = document.createElement('strong'); strong.textContent = title;
  const copy = document.createElement('p'); copy.textContent = detail;
  row.append(strong, copy);
  return row;
}

export function initGoalOs({ api, state, toast, showDialog } = {}) {
  let currentGoalId = null;
  let bound = false;
  let pendingPluginReview = null;

  function resetGoal() {
    currentGoalId = null;
    byId('goal-objective').textContent = 'Nhiệm vụ này chưa gắn với Goal OS';
    byId('goal-revision').textContent = 'rev —';
    byId('goal-status').textContent = '—';
    byId('goal-token-budget').textContent = 'Không giới hạn';
    byId('goal-plan-count').textContent = '0 lần cập nhật';
    byId('goal-discoveries').replaceChildren(empty('Chưa có phát hiện mới.'));
    byId('goal-plan-changes').replaceChildren(empty('Kế hoạch chưa cần thay đổi.'));
    byId('mission-graph-list').replaceChildren(empty('Chưa có mission graph.'));
  }

  function renderGraph(graph) {
    const goal = graph.goal;
    if (!goal) return resetGoal();
    currentGoalId = goal.id;
    byId('goal-objective').textContent = goal.title || goal.objective;
    byId('goal-revision').textContent = `rev ${goal.revision ?? 0}`;
    byId('goal-status').textContent = text(goal.status);
    const tokenBudget = Number(goal.budget?.maxTotalTokens ?? 0);
    byId('goal-token-budget').textContent = tokenBudget > 0 ? tokenBudget.toLocaleString('vi-VN') : 'Không giới hạn';
    byId('goal-plan-count').textContent = `${graph.planPatches?.length ?? 0} lần cập nhật`;

    const discoveries = graph.discoveries ?? [];
    byId('goal-discoveries').replaceChildren(...(discoveries.length ? discoveries.slice(-12).reverse().map((fact) => feedRow(
      text(fact.claim, 'Phát hiện mới'),
      `${text(fact.impact, 'medium')} · độ tin cậy ${Math.round(Number(fact.confidence ?? 0) * 100)}%`,
      fact.impact === 'critical' || fact.impact === 'high' ? 'important' : '',
    )) : [empty('Chưa có phát hiện mới.') ]));

    const patches = graph.planPatches ?? [];
    byId('goal-plan-changes').replaceChildren(...(patches.length ? patches.slice(-10).reverse().map((patch) => feedRow(
      patch.status === 'applied' ? 'Đã áp dụng thay đổi kế hoạch' : 'Đề xuất thay đổi kế hoạch',
      text(patch.reason, `Patch ${patch.id}`),
      patch.status,
    )) : [empty('Kế hoạch chưa cần thay đổi.') ]));

    const nodes = graph.nodes ?? [];
    const activeId = graph.active?.taskId ? `task:${graph.active.taskId}` : graph.active?.runId ? `run:${graph.active.runId}` : null;
    byId('mission-graph-list').replaceChildren(...(nodes.length ? nodes.slice(0, 60).map((item) => {
      const row = document.createElement('article'); row.className = `mission-node ${item.id === activeId ? 'active' : ''}`;
      const dot = document.createElement('span'); dot.className = `mission-node-dot ${item.kind}`;
      const copy = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = item.label;
      const meta = document.createElement('small'); meta.textContent = `${item.kind}${item.metadata?.status ? ` · ${item.metadata.status}` : ''}`;
      copy.append(title, meta); row.append(dot, copy); return row;
    }) : [empty('Chưa có mission graph.') ]));
  }

  async function loadForSnapshot(snapshot) {
    const goalId = snapshot?.mission?.metadata?.goalId ?? null;
    if (!goalId) return resetGoal();
    const graph = await api(`/api/mission-graph?goalId=${encodeURIComponent(goalId)}`);
    renderGraph(graph);
    await refreshBrowserPermissions().catch(() => null);
    return graph;
  }

  function showCommandResult(result) {
    const container = byId('command-results');
    const article = document.createElement('article'); article.className = 'command-output-card';
    const title = document.createElement('strong'); title.textContent = `/${result.command}`;
    const pre = document.createElement('pre'); pre.textContent = boundedJson(result.value);
    article.append(title, pre); container.replaceChildren(article);
    showDialog?.('command-dialog');
  }

  async function executeCommand(command, context = {}) {
    const result = await api('/api/commands', { method: 'POST', body: JSON.stringify({ command, context: { projectId: state.projectId, goalId: currentGoalId, missionId: state.currentRun?.mission?.id ?? null, ...context } }) });
    showCommandResult(result);
    toast?.(`Đã chạy /${result.command}`);
    return result;
  }

  async function browser(action, input = {}) {
    if (!state.projectId) throw new Error('Hãy mở một dự án trước');
    const endpoint = BROWSER_ENDPOINTS[action] ?? `/api/browser/${action}`;
    const result = await api(endpoint, { method: 'POST', body: JSON.stringify({ projectId: state.projectId, ...input }) });
    byId('browser-output').textContent = boundedJson(result);
    return result;
  }


  async function refreshBrowserRuntime() {
    const status = await api('/api/browser/runtime');
    byId('browser-runtime-status').textContent = status.ready ? `Playwright ${status.version} sẵn sàng` : `Playwright ${status.version} chưa được cài`;
    byId('install-browser-runtime').hidden = status.ready === true;
    return status;
  }

  async function refreshBrowserPermissions() {
    if (!currentGoalId) return null;
    const permissions = await api(`/api/permissions/browser?goalId=${encodeURIComponent(currentGoalId)}`);
    const allowed = new Set(permissions.writeActions ?? []);
    for (const action of ['click', 'fill', 'type', 'press']) byId(`browser-permission-${action}`).checked = allowed.has(action);
    return permissions;
  }

  async function saveBrowserPermissions() {
    if (!currentGoalId) throw new Error('Nhiệm vụ hiện tại chưa có Goal OS');
    const selected = ['click', 'fill', 'type', 'press'].filter((action) => byId(`browser-permission-${action}`).checked);
    const current = await api(`/api/permissions/browser?goalId=${encodeURIComponent(currentGoalId)}`);
    const existing = new Set(current.writeActions ?? []);
    const grant = selected.filter((action) => !existing.has(action));
    const revoke = [...existing].filter((action) => !selected.includes(action));
    if (grant.length) await api('/api/permissions/browser', { method: 'POST', body: JSON.stringify({ action: 'grant', goalId: currentGoalId, actions: grant }) });
    if (revoke.length) await api('/api/permissions/browser', { method: 'POST', body: JSON.stringify({ action: 'revoke', goalId: currentGoalId, actions: revoke }) });
    return refreshBrowserPermissions();
  }

  function renderPluginReview(review, plugin) {
    pendingPluginReview = { review, plugin };
    byId('plugin-review-title').textContent = `${plugin.name} ${plugin.version}`;
    const rows = [];
    for (const kind of ['mcp', 'lsp']) {
      for (const server of review.capabilities?.[kind]?.servers ?? []) {
        const label = document.createElement('label'); label.className = 'plugin-server-review';
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.dataset.serverKind = kind; checkbox.value = server.id;
        const copy = document.createElement('span');
        const strong = document.createElement('strong'); strong.textContent = `${kind.toUpperCase()} · ${server.id}`;
        const detail = document.createElement('small'); detail.textContent = `${server.command} ${(server.args ?? []).join(' ')} · ${(server.risks ?? []).join(', ')}`;
        copy.append(strong, detail); label.append(checkbox, copy); rows.push(label);
      }
    }
    if (!rows.length) rows.push(empty('Plugin không yêu cầu MCP/LSP process.'));
    byId('plugin-review-list').replaceChildren(...rows);
    showDialog?.('plugin-review-dialog');
  }

  async function activateReviewedPlugin() {
    if (!pendingPluginReview) return;
    const { plugin } = pendingPluginReview;
    const approvedServers = { mcp: [], lsp: [] };
    for (const checkbox of byId('plugin-review-list').querySelectorAll('input[data-server-kind]:checked')) approvedServers[checkbox.dataset.serverKind].push(checkbox.value);
    const requestedCapabilities = plugin.capabilities.filter((capability) => capability !== 'hooks' && (!['mcp', 'lsp'].includes(capability) || approvedServers[capability].length));
    await api(`/api/plugins/${encodeURIComponent(plugin.id)}/activate`, { method: 'POST', body: JSON.stringify({ projectId: state.projectId, requestedCapabilities, approvedServers, allowHooks: false }) });
    pendingPluginReview = null;
    byId('plugin-review-dialog').close?.();
    await refreshPlugins();
    toast?.(`Đã kích hoạt ${plugin.name}`);
  }

  async function refreshPlugins() {
    const plugins = await api('/api/plugins');
    const list = byId('plugin-list');
    if (!plugins.length) { list.replaceChildren(empty('Chưa cài plugin.')); return plugins; }
    list.replaceChildren(...plugins.map((plugin) => {
      const row = document.createElement('article'); row.className = 'plugin-row';
      const copy = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = `${plugin.name} ${plugin.version}`;
      const meta = document.createElement('small'); meta.textContent = `${plugin.capabilities.join(', ') || 'không capability'}${plugin.hooks?.quarantined ? ' · hooks quarantined' : ''}`;
      copy.append(title, meta);
      const active = plugin.activeProjects.includes(state.projectId);
      const button = document.createElement('button'); button.type = 'button'; button.textContent = active ? 'Tắt' : 'Bật';
      button.onclick = async () => {
        if (active) {
          await api(`/api/plugins/${encodeURIComponent(plugin.id)}/deactivate`, { method: 'POST', body: JSON.stringify({ projectId: state.projectId }) });
          await refreshPlugins(); toast?.(`Đã tắt ${plugin.name}`);
          return;
        }
        const review = await api(`/api/plugins/${encodeURIComponent(plugin.id)}/review?projectId=${encodeURIComponent(state.projectId)}`);
        const needsReview = (review.capabilities?.mcp?.servers?.length ?? 0) + (review.capabilities?.lsp?.servers?.length ?? 0) > 0;
        if (needsReview) renderPluginReview(review, plugin);
        else {
          await api(`/api/plugins/${encodeURIComponent(plugin.id)}/activate`, { method: 'POST', body: JSON.stringify({ projectId: state.projectId, requestedCapabilities: plugin.capabilities.filter((capability) => capability !== 'hooks'), approvedServers: {}, allowHooks: false }) });
          await refreshPlugins(); toast?.(`Đã bật ${plugin.name}`);
        }
      };
      row.append(copy, button); return row;
    }));
    return plugins;
  }

  function bind() {
    if (bound) return; bound = true;
    byId('install-browser-runtime').onclick = async () => { try { byId('browser-runtime-status').textContent = 'Đang cài Playwright và Chromium…'; await api('/api/browser/runtime/install', { method: 'POST', body: JSON.stringify({ force: false }) }); await refreshBrowserRuntime(); toast?.('Browser runtime đã sẵn sàng'); } catch (error) { toast?.(error.message, true); } };
    byId('save-browser-permissions').onclick = () => saveBrowserPermissions().then(() => toast?.('Đã cập nhật quyền browser')).catch((error) => toast?.(error.message, true));
    byId('plugin-review-activate').onclick = () => activateReviewedPlugin().catch((error) => toast?.(error.message, true));
    byId('browser-open').onclick = () => browser('open', { url: byId('browser-url').value || 'about:blank', headed: true, persistent: true }).catch((error) => toast?.(error.message, true));
    byId('browser-snapshot').onclick = () => browser('snapshot', { depth: 4 }).catch((error) => toast?.(error.message, true));
    byId('browser-close').onclick = () => browser('close').catch((error) => toast?.(error.message, true));
    byId('plugin-marketplace-add').onclick = async () => {
      try {
        const market = await api('/api/plugins/marketplaces', { method: 'POST', body: JSON.stringify({ source: byId('plugin-marketplace-source').value.trim() }) });
        byId('plugin-marketplace-id').value = market.id; toast?.(`Đã thêm marketplace ${market.name}`);
      } catch (error) { toast?.(error.message, true); }
    };
    byId('plugin-install').onclick = async () => {
      try {
        await api('/api/plugins/install', { method: 'POST', body: JSON.stringify({ marketplaceId: byId('plugin-marketplace-id').value.trim(), pluginName: byId('plugin-name').value.trim() }) });
        await refreshPlugins(); toast?.('Đã cài plugin vào cache cách ly');
      } catch (error) { toast?.(error.message, true); }
    };
  }

  async function setProject() { bind(); await Promise.all([refreshPlugins().catch(() => []), refreshBrowserRuntime().catch(() => null), refreshBrowserPermissions().catch(() => null)]); }
  bind();
  return Object.freeze({ loadForSnapshot, executeCommand, setProject, refreshPlugins, resetGoal });
}
