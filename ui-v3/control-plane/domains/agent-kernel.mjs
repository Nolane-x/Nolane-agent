const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
let live = null;
let loadError = null;

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const pct = (value) => `${Math.max(0, Math.min(100, Math.round(number(value) * 100)))}%`;
const shortHash = (value) => value ? `${String(value).slice(0, 8)}…${String(value).slice(-6)}` : '—';
const shortId = (value) => value ? String(value).replace(/^[^_]*_/, '').slice(0, 8) : '—';
const stateLabel = (state) => ({ running: 'Running', blocked: 'Blocked', review: 'Review', paused: 'Paused', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled' }[state] ?? String(state ?? 'Unknown'));

export async function loadAgentKernelSnapshot({ api } = {}) {
  if (!api?.get) throw new TypeError('Agent Kernel view requires an API client');
  try { live = await api.get('/api/sovereign-kernel/snapshot'); loadError = null; }
  catch (error) { loadError = String(error?.message ?? error); live = null; }
  return live;
}

export function buildAgentKernelView(snapshot = live) {
  const metrics = snapshot?.metrics ?? {};
  const context = Array.isArray(snapshot?.context) ? snapshot.context : [];
  const threads = Array.isArray(snapshot?.threads) ? snapshot.threads : [];
  const plans = Array.isArray(snapshot?.plans) ? snapshot.plans : [];
  const leases = Array.isArray(snapshot?.capabilities?.leases) ? snapshot.capabilities.leases : [];
  const architecture = snapshot?.architecture ?? {};
  const contextTokens = context.reduce((sum, item) => sum + number(item.tokenEstimate), 0);
  const contextBudget = context.reduce((sum, item) => sum + number(item.tokenBudget), 0);
  return Object.freeze({
    status: snapshot ? 'live' : loadError ? 'error' : 'loading', error: loadError,
    metrics: Object.freeze({ threads: number(metrics.threads), activeThreads: number(metrics.activeThreads), plans: number(metrics.plans), contextPackets: number(metrics.contextPackets), capabilityLeases: number(metrics.capabilityLeases), pendingApprovals: number(metrics.pendingApprovals) }),
    context: Object.freeze({ used: contextTokens, budget: contextBudget, utilization: contextBudget ? contextTokens / contextBudget : 0, packets: context.slice(0, 6) }),
    threads: Object.freeze(threads.slice(0, 7)), plans: Object.freeze(plans.slice(0, 5)), leases: Object.freeze(leases.slice(0, 6)), architecture: Object.freeze({ ...architecture }),
    receiptSha256: snapshot?.receiptSha256 ?? null, generatedAt: snapshot?.generatedAt ?? null,
  });
}

function metric(label, value, note, accent = '') {
  return `<article class="kernel-metric ${accent}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`;
}
function capabilityRows(leases) {
  if (!leases.length) return '<div class="kernel-empty"><strong>No standing privilege</strong><span>Capabilities are issued as scoped, expiring leases only when an agent requests them.</span></div>';
  return `<div class="kernel-table">${leases.map((lease) => `<div class="kernel-table-row"><span class="kernel-state" data-state="${escapeHtml(lease.state)}">${escapeHtml(lease.state)}</span><strong>${escapeHtml(lease.capability)}</strong><code>${escapeHtml(lease.scope)}</code><small>${escapeHtml(lease.resource ?? 'project boundary')}</small></div>`).join('')}</div>`;
}
function threadRows(threads) {
  if (!threads.length) return '<div class="kernel-empty"><strong>Kernel ready</strong><span>Create a durable thread to begin a resumable, receipt-backed execution.</span></div>';
  return threads.map((thread) => `<article class="kernel-thread"><div><span class="kernel-state" data-state="${escapeHtml(thread.state)}">${escapeHtml(stateLabel(thread.state))}</span><strong>${escapeHtml(thread.title ?? thread.metadata?.title ?? 'Untitled thread')}</strong></div><p>${escapeHtml(thread.objective)}</p><footer><code>epoch ${escapeHtml(shortId(thread.epoch))}</code><span>rev ${number(thread.revision)}</span><span>${escapeHtml(thread.projectId)}</span></footer></article>`).join('');
}

export function renderAgentKernelView(value) {
  const architecture = [
    ['Durable threads', value.architecture.durableThreads], ['Durable kernel artifacts', value.architecture.durableKernelArtifacts], ['Restart-resumable plans', value.architecture.restartResumablePlans], ['Revision + epoch fencing', value.architecture.optimisticRevisionFencing && value.architecture.epochFencing],
    ['Path-scoped context compiler', value.architecture.pathScopedContextCompilation], ['Transcript compaction', value.architecture.transcriptCompaction],
    ['Adaptive execution DAG', value.architecture.adaptiveDagExecution], ['Independent reviewer boundary', value.architecture.independentReviewBoundary],
    ['Scoped capability leases', value.architecture.scopedCapabilityLeases], ['Unreviewed merge', value.architecture.unreviewedMergeAllowed === false ? 'blocked' : false],
  ];
  const contextWidth = pct(value.context.utilization);
  const contextLabel = value.context.utilization > 0 && value.context.utilization < 0.01 ? '<1%' : contextWidth;
  const statusCopy = value.status === 'live' ? 'Live kernel telemetry' : value.status === 'error' ? `Telemetry unavailable: ${value.error}` : 'Loading kernel telemetry';
  return `<section class="agent-kernel" aria-labelledby="agent-kernel-title">
    <header class="kernel-hero">
      <div><span class="kernel-eyebrow">NOLANE CORE · CHECKPOINT 14</span><h1 id="agent-kernel-title">Sovereign Agent Kernel</h1><p>One execution backbone for durable threads, compiled context, isolated agent lanes, capability control and independent review.</p></div>
      <aside><span class="kernel-live"><i></i>${escapeHtml(statusCopy)}</span><code>${escapeHtml(shortHash(value.receiptSha256))}</code><small>${escapeHtml(value.generatedAt ? new Date(value.generatedAt).toLocaleString() : 'Awaiting first snapshot')}</small></aside>
    </header>
    <div class="kernel-metrics">
      ${metric('Active threads', value.metrics.activeThreads, `${value.metrics.threads} durable total`, 'is-primary')}
      ${metric('Execution plans', value.metrics.plans, `${value.plans.reduce((sum, item) => sum + number(item.taskCount), 0)} governed lanes`)}
      ${metric('Context packets', value.metrics.contextPackets, `${value.context.used.toLocaleString()} tokens compiled`)}
      ${metric('Capability leases', value.metrics.capabilityLeases, `${value.metrics.pendingApprovals} awaiting approval`, value.metrics.pendingApprovals ? 'is-warning' : '')}
    </div>
    <div class="kernel-grid">
      <article class="kernel-panel kernel-fabric">
        <header><div><span class="kernel-kicker">Execution fabric</span><h2>Parallel, isolated, review-gated</h2></div><span>${value.plans.length} plans</span></header>
        <div class="fabric-flow">
          <div class="fabric-node"><span>01</span><strong>Scout</strong><small>Repository intelligence</small></div><i></i>
          <div class="fabric-node"><span>02</span><strong>Builder</strong><small>Owned worktree paths</small></div><i></i>
          <div class="fabric-node is-review"><span>03</span><strong>Reviewer</strong><small>Independent identity</small></div><i></i>
          <div class="fabric-node"><span>04</span><strong>Integrator</strong><small>Receipt-locked merge</small></div>
        </div>
        <div class="kernel-rule-strip"><span>Conflict graph</span><span>Adaptive concurrency</span><span>Repair loops</span><span>No silent merge</span></div>
      </article>
      <article class="kernel-panel kernel-context">
        <header><div><span class="kernel-kicker">Context compiler</span><h2>Relevant truth, not prompt bulk</h2></div><strong>${contextLabel}</strong></header>
        <progress class="context-meter" max="100" value="${Math.max(0, Math.min(100, Number.parseFloat(contextWidth) || 0))}" aria-label="Context utilization ${escapeHtml(contextLabel)}"></progress>
        <div class="context-lanes"><span><i></i>Instructions</span><span><i></i>Repository</span><span><i></i>Evidence</span><span><i></i>Memory</span><span><i></i>Transcript</span></div>
        <p>Path scope, trust score, freshness, deduplication and spillover are compiled into a signed packet before execution.</p>
      </article>
      <article class="kernel-panel kernel-threads"><header><div><span class="kernel-kicker">Durable threads</span><h2>Resume without losing authority state</h2></div><span>epoch-fenced</span></header><div class="kernel-thread-list">${threadRows(value.threads)}</div></article>
      <article class="kernel-panel kernel-capabilities"><header><div><span class="kernel-kicker">Capability authority</span><h2>Least privilege by lease</h2></div><span>fail-closed</span></header>${capabilityRows(value.leases)}</article>
      <article class="kernel-panel kernel-boundary">
        <div class="boundary-orbit"><span>EXECUTOR</span><i></i><strong>REVIEW<br>BOUNDARY</strong><i></i><span>MERGE</span></div>
        <div><span class="kernel-kicker">Independent verification</span><h2>The agent cannot approve itself</h2><p>Mutating lanes require a real diff and test receipt. Research lanes require outcome evidence. Sensitive capabilities always cross a human decision boundary.</p></div>
      </article>
      <article class="kernel-panel kernel-architecture"><header><div><span class="kernel-kicker">Core invariants</span><h2>Hard properties, not UI promises</h2></div></header><div class="architecture-list">${architecture.map(([label, enabled]) => `<div><i data-enabled="${enabled === true || enabled === 'blocked'}"></i><span>${escapeHtml(label)}</span><strong>${enabled === 'blocked' ? 'BLOCKED' : enabled ? 'ENFORCED' : 'UNAVAILABLE'}</strong></div>`).join('')}</div></article>
    </div>
  </section>`;
}
