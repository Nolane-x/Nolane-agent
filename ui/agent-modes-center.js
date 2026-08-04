const MODE_LABELS = Object.freeze([
  'Ask', 'Read only', 'Plan', 'Edit with approval', 'Auto edit', 'Review', 'Debug',
  'Test writer', 'Refactor', 'Migration', 'Architecture', 'Create project', 'CI repair',
  'Issue resolution', 'Background', 'Learn codebase', 'Explain step by step', 'Fast',
  'Deep', 'Offline local',
]);

const GROUPS = Object.freeze([
  ['Explore', ['ask', 'read-only', 'plan', 'learn-codebase', 'explain']],
  ['Build', ['edit-approved', 'auto-edit', 'test-writer', 'refactor', 'project-create']],
  ['Specialists', ['review', 'debug', 'migration', 'architecture', 'ci-repair', 'issue-resolution']],
  ['Execution', ['background', 'fast', 'deep', 'offline']],
]);

function installStyles() {
  if (document.querySelector('link[data-forge-agent-modes]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = '/agent-modes-center.css'; link.dataset.forgeAgentModes = 'true';
  document.head.append(link);
}
function element(tag, className = '', text = '') {
  const item = document.createElement(tag); if (className) item.className = className; if (text !== '') item.textContent = text; return item;
}
function badge(text, tone = 'neutral') { return element('span', `mode-badge ${tone}`, String(text)); }
function comma(items) { return Array.isArray(items) && items.length ? items.join(', ') : 'None'; }
function number(value) { return Number(value ?? 0).toLocaleString('vi-VN'); }
function policyTone(mode) { return mode.readOnly ? 'safe' : mode.approvalPolicy === 'always' || mode.approvalPolicy === 'state-change' ? 'guided' : 'autonomous'; }
function modeSummary(mode) {
  return `${mode.approvalPolicy} approval · ${mode.networkPolicy?.mode || 'deny'} network · ${mode.commitPolicy} commit`;
}

export function initAgentModesCenter({ api, state, toast, setView, openRun }) {
  installStyles();
  const root = document.getElementById('agent-modes-center');
  root.className = 'agent-modes-center view';
  root.innerHTML = `
    <div class="mode-ambient" aria-hidden="true"><span></span><span></span><span></span></div>
    <header class="mode-header">
      <div><span class="mode-kicker">AUTONOMY CONTROL PLANE</span><h1>Agent Modes</h1><p>Choose a machine-enforced operating boundary. The server resolves the canonical policy; the browser cannot broaden it.</p></div>
      <button id="mode-refresh" class="secondary-button" type="button">Refresh modes</button>
    </header>
    <section class="mode-hero-grid">
      <article class="mode-neural-orbit"><div class="mode-orbit-core"><strong id="mode-count">20</strong><small>governed modes</small></div><i></i><i></i><i></i></article>
      <article class="mode-live-summary"><span>Selected profile</span><strong id="mode-selected-name">—</strong><small id="mode-selected-summary">Select a mode to inspect its enforceable boundary.</small><div id="mode-selected-badges" class="mode-badges"></div></article>
      <article class="mode-run-status"><span>Workspace</span><strong id="mode-project-name">No project selected</strong><small id="mode-provider-note">Provider and trust checks run on the server when the mission starts.</small></article>
    </section>
    <div class="mode-layout">
      <section class="mode-catalog"><div id="mode-groups"></div></section>
      <aside class="mode-inspector">
        <div class="mode-inspector-head"><div><span>CANONICAL POLICY</span><h2 id="mode-policy-title">Select a mode</h2></div><span id="mode-policy-receipt" class="mode-receipt">No receipt</span></div>
        <div id="mode-policy-matrix" class="mode-policy-matrix"></div>
        <form id="mode-run-form" class="mode-run-form">
          <label>Mission objective<textarea name="objective" rows="5" required placeholder="Describe the exact outcome Nolane Agent should produce..."></textarea></label>
          <div class="mode-limit-grid">
            <label>Max turns<input name="maxTurns" type="number" min="1" placeholder="Built-in"></label>
            <label>Max tasks<input name="maxTasks" type="number" min="1" placeholder="Built-in"></label>
            <label>Token budget<input name="budgetTokens" type="number" min="1" placeholder="Built-in"></label>
          </div>
          <label class="mode-checkbox"><input name="denyNetwork" type="checkbox"><span>Force network deny for this run</span></label>
          <label class="mode-checkbox"><input name="disableChildren" type="checkbox"><span>Disable child agents for this run</span></label>
          <button id="mode-start-run" class="primary-button mode-launch" type="submit" disabled>Launch governed mission</button>
          <p class="mode-form-note">Overrides can only lower budgets or remove permissions. Capability, workspace-trust and provider checks still apply.</p>
        </form>
      </aside>
    </div>`;

  let modes = [];
  let selectedId = null;
  let resolution = null;
  const get = (id) => root.querySelector(`#${id}`);

  const renderPolicy = () => {
    const policy = resolution?.policy;
    get('mode-policy-title').textContent = policy?.label || 'Select a mode';
    get('mode-policy-receipt').textContent = resolution?.receiptSha256 ? `sha256:${resolution.receiptSha256.slice(0, 12)}` : 'No receipt';
    get('mode-selected-name').textContent = policy?.label || '—';
    get('mode-selected-summary').textContent = policy ? modeSummary(policy) : 'Select a mode to inspect its enforceable boundary.';
    get('mode-selected-badges').replaceChildren(...(policy ? [
      badge(policy.readOnly ? 'READ ONLY' : 'WRITES', policy.readOnly ? 'safe' : 'warn'),
      badge(policy.localOnly ? 'LOCAL ONLY' : policy.networkPolicy?.mode?.toUpperCase(), policy.localOnly ? 'safe' : 'neutral'),
      badge(policy.routingMode?.toUpperCase(), 'live'),
    ] : []));
    const matrix = get('mode-policy-matrix'); matrix.replaceChildren();
    if (!policy) { matrix.append(element('p', 'mode-empty', 'No policy selected.')); return; }
    const rows = [
      ['Approval', policy.approvalPolicy], ['Network', `${policy.networkPolicy?.mode || 'deny'}${policy.networkPolicy?.domains?.length ? ` · ${policy.networkPolicy.domains.length} domains` : ''}`],
      ['Commit', policy.commitPolicy], ['Local only', policy.localOnly ? 'Yes' : 'No'], ['Background', policy.backgroundAllowed ? 'Allowed' : 'Denied'],
      ['Child agents', policy.allowChildAgents ? 'Allowed' : 'Denied'], ['Max turns', number(policy.maxTurns)], ['Max tasks', number(policy.maxTasks)],
      ['Token budget', number(policy.budgetTokens)], ['Context budget', number(policy.contextBudget)], ['Verification', policy.verificationDepth],
      ['Tool groups', comma(policy.toolGroups)], ['Denied tools', comma(policy.deniedToolGroups)], ['Capabilities', comma(policy.requiredCapabilities)],
    ];
    for (const [label, value] of rows) { const row = element('div', 'mode-policy-row'); row.append(element('span', '', label), element('strong', '', value)); matrix.append(row); }
    get('mode-start-run').disabled = !state.projectId;
  };

  const resolve = async (modeId, overrides = {}) => {
    selectedId = modeId;
    root.querySelectorAll('[data-mode-id]').forEach((card) => card.classList.toggle('selected', card.dataset.modeId === modeId));
    resolution = await api('/api/agent-modes/resolve', { method: 'POST', body: JSON.stringify({ modeId, overrides }) });
    renderPolicy(); return resolution;
  };

  const renderCatalog = () => {
    const mount = get('mode-groups'); mount.replaceChildren(); get('mode-count').textContent = String(modes.length || MODE_LABELS.length);
    for (const [groupLabel, ids] of GROUPS) {
      const section = element('section', 'mode-group'); section.append(element('h2', '', groupLabel)); const grid = element('div', 'mode-card-grid');
      for (const id of ids) {
        const mode = modes.find((item) => item.id === id); if (!mode) continue;
        const card = element('button', `mode-card ${policyTone(mode)}`); card.type = 'button'; card.dataset.modeId = mode.id;
        const head = element('div', 'mode-card-head'); head.append(element('strong', '', mode.label), badge(mode.category, 'neutral'));
        card.append(head, element('p', '', mode.description));
        const foot = element('div', 'mode-card-foot'); foot.append(element('span', '', `${number(mode.budgetTokens)} tokens`), element('span', '', `${mode.maxTurns} turns`), element('span', '', mode.verificationDepth)); card.append(foot);
        card.onclick = () => resolve(mode.id).catch((error) => toast(error.message, true)); grid.append(card);
      }
      section.append(grid); mount.append(section);
    }
  };

  const load = async () => {
    modes = await api('/api/agent-modes');
    renderCatalog();
    get('mode-project-name').textContent = state.projectId || 'No project selected';
    const initial = selectedId && modes.some((item) => item.id === selectedId) ? selectedId : 'auto-edit';
    await resolve(initial);
  };

  get('mode-refresh').onclick = () => load().catch((error) => toast(error.message, true));
  get('mode-run-form').onsubmit = async (event) => {
    event.preventDefault();
    if (!state.projectId) { toast('Select a trusted project first.', true); return; }
    const data = new FormData(event.currentTarget); const overrides = {};
    for (const key of ['maxTurns', 'maxTasks', 'budgetTokens']) { const raw = String(data.get(key) || '').trim(); if (raw) overrides[key] = Number(raw); }
    if (data.get('denyNetwork')) overrides.networkPolicy = { mode: 'deny', domains: [], ports: [] };
    if (data.get('disableChildren')) overrides.allowChildAgents = false;
    try {
      const canonical = await api('/api/agent-modes/resolve', { method: 'POST', body: JSON.stringify({ modeId: selectedId, overrides }) });
      const mission = await api('/api/agent/runs', { method: 'POST', body: JSON.stringify({ projectId: state.projectId, objective: data.get('objective'), modeId: selectedId, modeOverrides: overrides }) });
      resolution = canonical; renderPolicy(); toast(`Mission launched in ${canonical.policy.label} mode.`); await openRun(mission.mission?.id || mission.id);
    } catch (error) { toast(error.message, true); }
  };

  return Object.freeze({
    async open() { setView('agentModes'); await load(); },
    async setProject(projectId) { get('mode-project-name').textContent = projectId || 'No project selected'; if (!root.hidden) await load(); },
    load,
  });
}
