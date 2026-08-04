const FEATURES = Object.freeze([
  ['instructions', 'Instructions', 'AGENTS.md, CLAUDE.md, Cursor và Windsurf rules'],
  ['hooks', 'Lifecycle hooks', 'Script chạy trước/sau tool, test và phiên agent'],
  ['skills', 'Agent profiles & skills', 'Custom agents, skill workflow và executable đi kèm'],
  ['mcp', 'MCP tools', 'Tool server và dữ liệu doanh nghiệp bên ngoài'],
  ['plugins', 'Plugin context', 'Skill, command, agent và server từ plugin đã cài'],
  ['bootstrap', 'Workspace bootstrap', 'Dependency setup và development environment scripts'],
  ['background', 'Background execution', 'Autopilot, automation và scheduled work'],
]);

function ensureStyles() {
  if (document.querySelector('link[data-workspace-trust-center]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = '/workspace-trust-center.css'; link.dataset.workspaceTrustCenter = 'true';
  document.head.append(link);
}

const markup = `
<section id="workspace-trust-center" class="workspace-trust-center view" hidden aria-labelledby="workspace-trust-title">
<header class="trust-center-header"><div><span class="eyebrow">Repository security boundary</span><h1 id="workspace-trust-title">Workspace Trust Center</h1><p>Project code remains readable, but behavior-shaping files and background execution stay blocked until you explicitly trust this exact workspace identity.</p></div><button id="workspace-trust-refresh" class="secondary-button" type="button">Làm mới</button></header>
<div class="trust-summary-grid">
<article class="trust-status-card"><div class="trust-status-heading"><span class="trust-shield">✓</span><div><small>Current decision</small><h2 id="workspace-trust-state">Chưa tin cậy</h2></div><span id="workspace-trust-badge" class="trust-badge untrusted">UNTRUSTED</span></div><p id="workspace-trust-explanation">Nolane Agent đang chặn instructions, hooks, skills, MCP, plugin context và background execution.</p><dl class="trust-identity"><div><dt>Workspace</dt><dd id="workspace-trust-root">—</dd></div><div><dt>Identity fingerprint</dt><dd><code id="workspace-trust-fingerprint">—</code></dd></div><div><dt>Decision actor</dt><dd id="workspace-trust-actor">—</dd></div><div><dt>Last updated</dt><dd id="workspace-trust-updated">—</dd></div></dl></article>
<article class="trust-decision-card"><span class="eyebrow">Explicit human decision</span><h2>Thay đổi mức tin cậy</h2><p>Quyết định được ràng buộc vào filesystem identity. Nếu thư mục bị thay thế tại cùng đường dẫn, Nolane Agent tự động quay lại trạng thái untrusted.</p><label for="workspace-trust-reason">Lý do quyết định</label><textarea id="workspace-trust-reason" rows="3" maxlength="1000" placeholder="Ví dụ: Tôi đã xem source, hooks, MCP config và xác nhận repository thuộc nhóm của mình."></textarea><div class="trust-actions"><button id="workspace-trust-approve" class="primary-button" type="button">Tin cậy workspace này</button><button id="workspace-trust-revoke" class="danger-button" type="button">Thu hồi tin cậy</button></div><small>Mọi quyết định có audit receipt SHA-256 và danh tính người phê duyệt.</small></article>
</div>
<section class="trust-features-panel"><div class="trust-panel-heading"><div><span class="eyebrow">Deny-first feature policy</span><h2>Bề mặt đang được kiểm soát</h2></div><span id="workspace-trust-feature-count" class="runtime-count">0/7 enabled</span></div><div id="workspace-trust-feature-grid" class="trust-feature-grid"></div></section>
<section class="trust-audit-panel"><div class="trust-panel-heading"><div><span class="eyebrow">Immutable decision history</span><h2>Audit timeline</h2></div></div><div id="workspace-trust-audit" class="trust-audit-list"><div class="trust-empty">Chưa có quyết định trust.</div></div></section>
</section>`;

export function initWorkspaceTrustCenter({ api, state, toast, setView }) {
  ensureStyles();
  const host = document.createElement('div'); host.innerHTML = markup.trim();
  const root = host.firstElementChild; document.querySelector('.main-stage').append(root);
  const get = (id) => root.querySelector(`#${id}`);
  let projectId = state.projectId;
  let snapshot = null;
  let audit = [];

  const renderFeatures = () => {
    const entries = FEATURES.map(([id, title, description]) => {
      const decision = snapshot?.features?.[id] ?? { allowed: false, reason: 'no-project-selected' };
      const card = document.createElement('article'); card.className = `trust-feature-card ${decision.allowed ? 'allowed' : 'blocked'}`;
      const top = document.createElement('div'); top.className = 'trust-feature-heading';
      const name = document.createElement('strong'); name.textContent = title;
      const badge = document.createElement('span'); badge.className = `trust-mini-badge ${decision.allowed ? 'allowed' : 'blocked'}`; badge.textContent = decision.allowed ? 'ENABLED' : 'BLOCKED';
      const copy = document.createElement('p'); copy.textContent = description;
      const reason = document.createElement('small'); reason.textContent = decision.allowed ? 'Bound to the trusted workspace identity.' : `Reason: ${decision.reason ?? snapshot?.reason ?? 'untrusted'}`;
      top.append(name, badge); card.append(top, copy, reason); return card;
    });
    get('workspace-trust-feature-grid').replaceChildren(...entries);
    const enabled = FEATURES.filter(([id]) => snapshot?.features?.[id]?.allowed).length;
    get('workspace-trust-feature-count').textContent = `${enabled}/${FEATURES.length} enabled`;
  };

  const renderAudit = () => {
    if (!audit.length) { const empty = document.createElement('div'); empty.className = 'trust-empty'; empty.textContent = 'Chưa có quyết định trust.'; get('workspace-trust-audit').replaceChildren(empty); return; }
    const rows = [...audit].reverse().map((entry) => {
      const row = document.createElement('article'); row.className = 'trust-audit-row';
      const marker = document.createElement('span'); marker.className = `trust-audit-marker ${entry.type === 'workspace.trusted' ? 'trusted' : 'revoked'}`;
      const copy = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = entry.type === 'workspace.trusted' ? 'Workspace trusted' : 'Trust revoked';
      const meta = document.createElement('small'); meta.textContent = `${entry.actor} · ${new Date(entry.at).toLocaleString()} · ${String(entry.receiptSha256 ?? '').slice(0, 16)}…`;
      const reason = document.createElement('p'); reason.textContent = entry.reason;
      copy.append(title, meta, reason); row.append(marker, copy); return row;
    });
    get('workspace-trust-audit').replaceChildren(...rows);
  };

  const render = () => {
    const trusted = snapshot?.state === 'trusted';
    get('workspace-trust-state').textContent = trusted ? 'Workspace đã được tin cậy' : 'Workspace chưa được tin cậy';
    get('workspace-trust-badge').textContent = trusted ? 'TRUSTED' : 'UNTRUSTED';
    get('workspace-trust-badge').className = `trust-badge ${trusted ? 'trusted' : 'untrusted'}`;
    get('workspace-trust-explanation').textContent = trusted ? 'Behavior-shaping project content is enabled for the current filesystem identity.' : 'Nolane Agent đang chặn instructions, hooks, skills, MCP, plugin context và background execution.';
    get('workspace-trust-root').textContent = snapshot?.workspaceRoot ?? '—';
    get('workspace-trust-fingerprint').textContent = snapshot?.fingerprint ?? '—';
    get('workspace-trust-actor').textContent = snapshot?.actor ?? '—';
    get('workspace-trust-updated').textContent = snapshot?.updatedAt ? new Date(snapshot.updatedAt).toLocaleString() : '—';
    get('workspace-trust-approve').disabled = !projectId || trusted;
    get('workspace-trust-revoke').disabled = !projectId || !trusted;
    renderFeatures(); renderAudit();
  };

  const load = async () => {
    projectId = state.projectId;
    if (!projectId) { snapshot = null; audit = []; render(); return null; }
    [snapshot, audit] = await Promise.all([
      api(`/api/workspace-trust/${encodeURIComponent(projectId)}`),
      api(`/api/workspace-trust/${encodeURIComponent(projectId)}/audit`),
    ]);
    render(); return snapshot;
  };

  const decide = async (method) => {
    if (!projectId) throw new Error('Chọn một dự án trước.');
    const reason = get('workspace-trust-reason').value.trim();
    if (!reason) throw new Error('Hãy ghi lý do quyết định trust.');
    const result = await api(`/api/workspace-trust/${encodeURIComponent(projectId)}`, { method, body: JSON.stringify({ reason }) });
    get('workspace-trust-reason').value = '';
    await load(); toast(result.state === 'trusted' ? 'Workspace đã được tin cậy.' : 'Đã thu hồi độ tin cậy.');
    return result;
  };

  get('workspace-trust-refresh').onclick = () => load().catch((error) => toast(error.message, true));
  get('workspace-trust-approve').onclick = () => decide('PUT').catch((error) => toast(error.message, true));
  get('workspace-trust-revoke').onclick = () => decide('DELETE').catch((error) => toast(error.message, true));

  return Object.freeze({
    async open() { setView('trust'); await load(); },
    async setProject(id) { projectId = id; if (!root.hidden) await load(); },
    load,
  });
}
