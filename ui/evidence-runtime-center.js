const tabs = Object.freeze(['Graph', 'Retrieval', 'Context Packet', 'Leases', 'Recovery', 'Decision Efficiency']);
const el = (tag, className, text = '') => { const node = document.createElement(tag); if (className) node.className = className; node.textContent = text; return node; };
const jsonBody = (value) => JSON.stringify(value);

export function initEvidenceRuntimeCenter({ api, state, toast, setView } = {}) {
  const root = document.getElementById('evidence-runtime-center');
  let active = 'Graph';
  let lastPacket = null;
  let lastResult = null;

  const title = el('h1', '', 'Evidence Context Runtime');
  const subtitle = el('p', 'evidence-runtime-subtitle', 'Truy nguyên bằng chứng, context lease, counter-evidence và recovery recommendation.');
  const tabbar = el('div', 'evidence-runtime-tabs');
  const form = el('form', 'evidence-runtime-form');
  const query = document.createElement('textarea'); query.name = 'query'; query.rows = 3; query.placeholder = 'Mục tiêu hoặc truy vấn cần tìm bằng chứng';
  const hypothesis = document.createElement('input'); hypothesis.name = 'hypothesis'; hypothesis.placeholder = 'Giả thuyết cần tìm phản chứng (tùy chọn)';
  const action = el('button', 'primary', 'Run'); action.type = 'submit';
  form.append(query, hypothesis, action);
  const summary = el('div', 'evidence-runtime-summary');
  const list = el('div', 'evidence-runtime-results');


  function metricCard(label, value, detail = '') {
    const card = el('article', 'evidence-runtime-card decision-efficiency-card');
    card.append(el('span', 'decision-efficiency-label', label));
    card.append(el('strong', 'decision-efficiency-value', String(value)));
    if (detail) card.append(el('small', 'muted', detail));
    return card;
  }

  function renderDecisionEfficiency(missionResourceFabric) {
    list.replaceChildren();
    const decision = missionResourceFabric?.decision;
    if (!decision) { list.append(el('p', 'muted', 'Decision Efficiency chưa có dữ liệu.')); return; }
    const criteria = decision.criteria?.summary ?? {};
    const efficiency = decision.efficiency?.summary ?? {};
    const grid = el('section', 'decision-efficiency-grid');
    grid.append(
      metricCard('Criteria score', `${Number(criteria.verifiedCriteriaScore ?? 0)}/${Number(criteria.totalCriteriaWeight ?? 0)}`),
      metricCard('Token yield', Number(efficiency.tokenYield ?? 0).toFixed(3)),
      metricCard('Memory yield', Number(efficiency.memoryYield ?? 0).toFixed(3)),
      metricCard('Edit yield', Number(efficiency.editYield ?? 0).toFixed(3)),
    );
    list.append(grid);
    for (const item of (decision.recentDecisions ?? []).slice(0, 100)) {
      const card = el('article', 'evidence-runtime-card decision-evidence-card');
      card.append(el('strong', '', item.decisionId ?? 'Decision'));
      card.append(el('p', '', `Selected evidence: ${(item.selectedEvidence ?? []).join(', ') || 'none'}`));
      card.append(el('p', '', `Counter-evidence: ${(item.counterEvidence ?? []).join(', ') || 'none'}`));
      if (item.receiptSha256) card.append(el('code', '', item.receiptSha256));
      list.append(card);
    }
    const nonClaims = el('article', 'evidence-runtime-card decision-non-claims');
    nonClaims.append(el('strong', '', 'Non-claims'));
    nonClaims.append(el('p', '', 'Không lưu raw prompt, model output hoặc chain-of-thought; shadow metrics chưa tự thay đổi router.'));
    list.append(nonClaims);
  }

  function renderValue(value) {
    list.replaceChildren();
    if (!value) { list.append(el('p', 'muted', 'Chưa có kết quả.')); return; }
    const receipt = value.receiptSha256 ? el('code', 'evidence-runtime-receipt', value.receiptSha256) : null;
    if (receipt) list.append(receipt);
    const items = value.nodes ?? value.evidence ?? value.counterEvidence ?? value.actions ?? value.issues ?? [];
    if (!items.length) {
      const pre = el('pre', 'evidence-runtime-json', JSON.stringify(value, null, 2).slice(0, 30_000));
      list.append(pre); return;
    }
    for (const item of items.slice(0, 100)) {
      const card = el('article', 'evidence-runtime-card');
      card.append(el('strong', '', item.label ?? item.type ?? item.path ?? item.key ?? item.code ?? 'Evidence'));
      card.append(el('p', '', String(item.reason ?? item.text ?? item.sourceRef ?? '').slice(0, 2_000)));
      if (item.sourceHash) card.append(el('code', '', item.sourceHash));
      card.dataset.status = item.status ?? item.freshness ?? 'unknown';
      list.append(card);
    }
  }

  function renderTabs() {
    tabbar.replaceChildren(...tabs.map((label) => {
      const button = el('button', label === active ? 'active' : '', label); button.type = 'button';
      button.onclick = async () => { active = label; renderTabs(); summary.textContent = `Mode: ${label}`; if (label === 'Decision Efficiency') { lastResult = await api('/api/mission-resource-fabric'); renderDecisionEfficiency(lastResult); } else renderValue(label === 'Context Packet' ? lastPacket : lastResult); };
      return button;
    }));
  }

  form.onsubmit = async (event) => {
    event.preventDefault();
    if (!state.projectId) return toast('Chọn dự án trước.', true);
    try {
      if (active === 'Decision Efficiency') {
        lastResult = await api('/api/mission-resource-fabric');
      } else if (active === 'Graph' || active === 'Leases') {
        lastResult = await api(`/api/evidence-runtime/graph?projectId=${encodeURIComponent(state.projectId)}&includeStale=${active === 'Leases'}&limit=200`);
      } else if (active === 'Retrieval') {
        lastResult = await api('/api/evidence-runtime/retrieve', { method: 'POST', body: jsonBody({ projectId: state.projectId, query: query.value, hypothesis: hypothesis.value || null, limit: 30 }) });
      } else if (active === 'Context Packet') {
        lastPacket = await api('/api/evidence-runtime/packet', { method: 'POST', body: jsonBody({ projectId: state.projectId, role: 'reviewer', goal: { objective: query.value }, hypothesis: hypothesis.value || null, completionCriteria: ['Evidence reviewed'], budgetTokens: 6000 }) });
        lastResult = await api('/api/evidence-runtime/audit', { method: 'POST', body: jsonBody({ projectId: state.projectId, packet: lastPacket }) });
      } else {
        lastResult = await api('/api/evidence-runtime/recover', { method: 'POST', body: jsonBody({ projectId: state.projectId, recentToolCalls: [], testOutcomes: [], previousState: { errorCount: 1, passingTests: 0, evidenceCount: 0, uncertaintyCount: 2 }, currentState: { errorCount: 1, passingTests: 0, evidenceCount: 0, uncertaintyCount: 2 }, staleContextCount: 0, rejectedHypotheses: [] }) });
      }
      summary.textContent = `${active}: receipt ${String(lastResult?.receiptSha256 ?? lastPacket?.receiptSha256 ?? '').slice(0, 16)}`;
      if (active === 'Decision Efficiency') renderDecisionEfficiency(lastResult); else renderValue(active === 'Context Packet' ? lastPacket : lastResult);
    } catch (error) { toast(error.message, true); }
  };

  root.classList.add('evidence-runtime-center');
  root.replaceChildren(title, subtitle, tabbar, form, summary, list);
  renderTabs(); renderValue(null);
  return Object.freeze({
    async open() { setView('evidenceRuntime'); if (state.projectId) { query.value ||= 'Inspect current project evidence and counter-evidence'; } },
    async setProject() { lastPacket = null; lastResult = null; renderValue(null); },
  });
}
