const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
let live = null;
let loadError = null;

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const pct = (value) => `${Math.max(0, Math.min(100, Math.round(number(value) * 100)))}%`;
const shortHash = (value) => value ? `${String(value).slice(0, 8)}…${String(value).slice(-6)}` : '—';
const shortId = (value) => value ? String(value).replace(/^[^_]*_/, '').slice(0, 8) : '—';
const KERNEL_COPY = Object.freeze({
  en: Object.freeze({ live: 'Live kernel telemetry', unavailable: 'Telemetry unavailable', loading: 'Loading kernel telemetry', awaiting: 'Awaiting first snapshot', activeThreads: 'Active threads', durableTotal: 'durable total', executionPlans: 'Execution plans', governedLanes: 'governed lanes', contextPackets: 'Context packets', tokensCompiled: 'tokens compiled', capabilityLeases: 'Capability leases', awaitingApproval: 'awaiting approval', executionFabric: 'Execution fabric', parallel: 'Parallel, isolated, review-gated', plans: 'plans', scout: 'Scout', repositoryIntelligence: 'Repository intelligence', builder: 'Builder', ownedWorktree: 'Owned worktree paths', reviewer: 'Reviewer', independentIdentity: 'Independent identity', integrator: 'Integrator', receiptMerge: 'Receipt-locked merge', conflictGraph: 'Conflict graph', adaptiveConcurrency: 'Adaptive concurrency', repairLoops: 'Repair loops', noSilentMerge: 'No silent merge', contextCompiler: 'Context compiler', relevantTruth: 'Relevant truth, not prompt bulk', instructions: 'Instructions', repository: 'Repository', evidence: 'Evidence', memory: 'Memory', transcript: 'Transcript', contextDescription: 'Path scope, trust score, freshness, deduplication and spillover are compiled into a signed packet before execution.', durableThreads: 'Durable threads', resumeAuthority: 'Resume without losing authority state', epochFenced: 'epoch-fenced', capabilityAuthority: 'Capability authority', leastPrivilege: 'Least privilege by lease', failClosed: 'fail-closed', executor: 'EXECUTOR', reviewBoundary: 'REVIEW<br>BOUNDARY', merge: 'MERGE', independentVerification: 'Independent verification', cannotApprove: 'The agent cannot approve itself', verificationDescription: 'Mutating lanes require a real diff and test receipt. Research lanes require outcome evidence. Sensitive capabilities always cross a human decision boundary.', coreInvariants: 'Core invariants', hardProperties: 'Hard properties, not UI promises', noPrivilege: 'No standing privilege', leaseDescription: 'Capabilities are issued as scoped, expiring leases only when an agent requests them.', kernelReady: 'Kernel ready', createThread: 'Create a durable thread to begin a resumable, receipt-backed execution.', projectBoundary: 'project boundary', unknown: 'Unknown', blocked: 'BLOCKED', enforced: 'ENFORCED', unavailableState: 'UNAVAILABLE' }),
  vi: Object.freeze({ live: 'Telemetry nhân kernel trực tiếp', unavailable: 'Telemetry không khả dụng', loading: 'Đang tải telemetry kernel', awaiting: 'Đang chờ snapshot đầu tiên', activeThreads: 'Thread đang hoạt động', durableTotal: 'tổng thread bền vững', executionPlans: 'Kế hoạch thực thi', governedLanes: 'lane được kiểm soát', contextPackets: 'Gói ngữ cảnh', tokensCompiled: 'token đã biên dịch', capabilityLeases: 'Lease khả năng', awaitingApproval: 'đang chờ phê duyệt', executionFabric: 'Hạ tầng thực thi', parallel: 'Song song, cô lập, qua cổng duyệt', plans: 'kế hoạch', scout: 'Trinh sát', repositoryIntelligence: 'Trí tuệ kho mã', builder: 'Xây dựng', ownedWorktree: 'Đường dẫn worktree sở hữu', reviewer: 'Người duyệt', independentIdentity: 'Danh tính độc lập', integrator: 'Tích hợp', receiptMerge: 'Merge khóa bằng receipt', conflictGraph: 'Đồ thị xung đột', adaptiveConcurrency: 'Đồng thời thích ứng', repairLoops: 'Vòng sửa chữa', noSilentMerge: 'Không merge im lặng', contextCompiler: 'Trình biên dịch ngữ cảnh', relevantTruth: 'Sự thật liên quan, không phải prompt dư thừa', instructions: 'Chỉ dẫn', repository: 'Kho mã', evidence: 'Bằng chứng', memory: 'Bộ nhớ', transcript: 'Bản ghi', contextDescription: 'Phạm vi đường dẫn, điểm tin cậy, độ mới, khử trùng lặp và phần tràn được biên dịch thành gói đã ký trước khi thực thi.', durableThreads: 'Thread bền vững', resumeAuthority: 'Tiếp tục mà không mất trạng thái quyền hạn', epochFenced: 'khóa theo epoch', capabilityAuthority: 'Quyền hạn khả năng', leastPrivilege: 'Đặc quyền tối thiểu theo lease', failClosed: 'đóng khi lỗi', executor: 'BỘ THỰC THI', reviewBoundary: 'BIÊN GIỚI<br>DUYỆT', merge: 'MERGE', independentVerification: 'Xác minh độc lập', cannotApprove: 'Agent không thể tự phê duyệt chính mình', verificationDescription: 'Lane biến đổi cần diff thật và receipt kiểm thử. Lane nghiên cứu cần bằng chứng kết quả. Khả năng nhạy cảm luôn đi qua ranh giới quyết định của con người.', coreInvariants: 'Bất biến lõi', hardProperties: 'Thuộc tính cứng, không phải lời hứa UI', noPrivilege: 'Không có đặc quyền thường trực', leaseDescription: 'Khả năng chỉ được cấp dưới dạng lease có phạm vi và thời hạn khi agent yêu cầu.', kernelReady: 'Kernel sẵn sàng', createThread: 'Tạo thread bền vững để bắt đầu thực thi có receipt và có thể tiếp tục.', projectBoundary: 'ranh giới dự án', unknown: 'Không rõ', blocked: 'BỊ CHẶN', enforced: 'ĐƯỢC ÉP BUỘC', unavailableState: 'KHÔNG KHẢ DỤNG' }),
});
const kernelCopy = (language = 'en') => KERNEL_COPY[language === 'vi' ? 'vi' : 'en'];
const stateLabel = (state, language = 'en') => ({ running: language === 'vi' ? 'Đang chạy' : 'Running', blocked: language === 'vi' ? 'Bị chặn' : 'Blocked', review: language === 'vi' ? 'Duyệt' : 'Review', paused: language === 'vi' ? 'Tạm dừng' : 'Paused', completed: language === 'vi' ? 'Hoàn tất' : 'Completed', failed: language === 'vi' ? 'Thất bại' : 'Failed', cancelled: language === 'vi' ? 'Đã hủy' : 'Cancelled' }[state] ?? String(state ?? kernelCopy(language).unknown));

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
function capabilityRows(leases, c) {
  if (!leases.length) return `<div class="kernel-empty"><strong>${escapeHtml(c.noPrivilege)}</strong><span>${escapeHtml(c.leaseDescription)}</span></div>`;
  return `<div class="kernel-table">${leases.map((lease) => `<div class="kernel-table-row"><span class="kernel-state" data-state="${escapeHtml(lease.state)}">${escapeHtml(lease.state)}</span><strong>${escapeHtml(lease.capability)}</strong><code>${escapeHtml(lease.scope)}</code><small>${escapeHtml(lease.resource ?? c.projectBoundary)}</small></div>`).join('')}</div>`;
}
function threadRows(threads, c, language) {
  if (!threads.length) return `<div class="kernel-empty"><strong>${escapeHtml(c.kernelReady)}</strong><span>${escapeHtml(c.createThread)}</span></div>`;
  return threads.map((thread) => `<article class="kernel-thread"><div><span class="kernel-state" data-state="${escapeHtml(thread.state)}">${escapeHtml(stateLabel(thread.state, language))}</span><strong>${escapeHtml(thread.title ?? thread.metadata?.title ?? (language === 'vi' ? 'Thread chưa đặt tên' : 'Untitled thread'))}</strong></div><p>${escapeHtml(thread.objective)}</p><footer><code>epoch ${escapeHtml(shortId(thread.epoch))}</code><span>rev ${number(thread.revision)}</span><span>${escapeHtml(thread.projectId)}</span></footer></article>`).join('');
}

export function renderAgentKernelView(value, { language = 'en' } = {}) {
  const c = kernelCopy(language);
  const architecture = [
    [c.durableThreads, value.architecture.durableThreads], [language === 'vi' ? 'Artifact kernel bền vững' : 'Durable kernel artifacts', value.architecture.durableKernelArtifacts], [language === 'vi' ? 'Kế hoạch tiếp tục sau restart' : 'Restart-resumable plans', value.architecture.restartResumablePlans], [language === 'vi' ? 'Khóa revision + epoch' : 'Revision + epoch fencing', value.architecture.optimisticRevisionFencing && value.architecture.epochFencing],
    [language === 'vi' ? 'Biên dịch ngữ cảnh theo đường dẫn' : 'Path-scoped context compiler', value.architecture.pathScopedContextCompilation], [language === 'vi' ? 'Nén transcript' : 'Transcript compaction', value.architecture.transcriptCompaction],
    [language === 'vi' ? 'DAG thực thi thích ứng' : 'Adaptive execution DAG', value.architecture.adaptiveDagExecution], [language === 'vi' ? 'Biên giới người duyệt độc lập' : 'Independent reviewer boundary', value.architecture.independentReviewBoundary],
    [language === 'vi' ? 'Lease khả năng có phạm vi' : 'Scoped capability leases', value.architecture.scopedCapabilityLeases], [language === 'vi' ? 'Merge không duyệt' : 'Unreviewed merge', value.architecture.unreviewedMergeAllowed === false ? 'blocked' : false],
  ];
  const contextWidth = pct(value.context.utilization);
  const contextLabel = value.context.utilization > 0 && value.context.utilization < 0.01 ? '<1%' : contextWidth;
  const statusCopy = value.status === 'live' ? c.live : value.status === 'error' ? `${c.unavailable}: ${value.error}` : c.loading;
  return `<section class="agent-kernel" aria-labelledby="agent-kernel-title">
    <header class="kernel-hero">
      <div><span class="kernel-eyebrow">NOLANE CORE · CHECKPOINT 14</span><h1 id="agent-kernel-title">${language === 'vi' ? 'Nhân Agent Chủ quyền' : 'Sovereign Agent Kernel'}</h1><p>${language === 'vi' ? 'Một backbone thực thi cho thread bền vững, ngữ cảnh đã biên dịch, lane agent cô lập, kiểm soát khả năng và duyệt độc lập.' : 'One execution backbone for durable threads, compiled context, isolated agent lanes, capability control and independent review.'}</p></div>
      <aside><span class="kernel-live"><i></i>${escapeHtml(statusCopy)}</span><code>${escapeHtml(shortHash(value.receiptSha256))}</code><small>${escapeHtml(value.generatedAt ? new Date(value.generatedAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US') : c.awaiting)}</small></aside>
    </header>
    <div class="kernel-metrics">
      ${metric(c.activeThreads, value.metrics.activeThreads, `${value.metrics.threads} ${c.durableTotal}`, 'is-primary')}
      ${metric(c.executionPlans, value.metrics.plans, `${value.plans.reduce((sum, item) => sum + number(item.taskCount), 0)} ${c.governedLanes}`)}
      ${metric(c.contextPackets, value.metrics.contextPackets, `${value.context.used.toLocaleString()} ${c.tokensCompiled}`)}
      ${metric(c.capabilityLeases, value.metrics.capabilityLeases, `${value.metrics.pendingApprovals} ${c.awaitingApproval}`, value.metrics.pendingApprovals ? 'is-warning' : '')}
    </div>
    <div class="kernel-grid">
      <article class="kernel-panel kernel-fabric">
        <header><div><span class="kernel-kicker">${escapeHtml(c.executionFabric)}</span><h2>${escapeHtml(c.parallel)}</h2></div><span>${value.plans.length} ${escapeHtml(c.plans)}</span></header>
        <div class="fabric-flow">
          <div class="fabric-node"><span>01</span><strong>${escapeHtml(c.scout)}</strong><small>${escapeHtml(c.repositoryIntelligence)}</small></div><i></i>
          <div class="fabric-node"><span>02</span><strong>${escapeHtml(c.builder)}</strong><small>${escapeHtml(c.ownedWorktree)}</small></div><i></i>
          <div class="fabric-node is-review"><span>03</span><strong>${escapeHtml(c.reviewer)}</strong><small>${escapeHtml(c.independentIdentity)}</small></div><i></i>
          <div class="fabric-node"><span>04</span><strong>${escapeHtml(c.integrator)}</strong><small>${escapeHtml(c.receiptMerge)}</small></div>
        </div>
        <div class="kernel-rule-strip"><span>${escapeHtml(c.conflictGraph)}</span><span>${escapeHtml(c.adaptiveConcurrency)}</span><span>${escapeHtml(c.repairLoops)}</span><span>${escapeHtml(c.noSilentMerge)}</span></div>
      </article>
      <article class="kernel-panel kernel-context">
        <header><div><span class="kernel-kicker">${escapeHtml(c.contextCompiler)}</span><h2>${escapeHtml(c.relevantTruth)}</h2></div><strong>${contextLabel}</strong></header>
        <progress class="context-meter" max="100" value="${Math.max(0, Math.min(100, Number.parseFloat(contextWidth) || 0))}" aria-label="${escapeHtml(c.contextCompiler)} ${escapeHtml(contextLabel)}"></progress>
        <div class="context-lanes"><span><i></i>${escapeHtml(c.instructions)}</span><span><i></i>${escapeHtml(c.repository)}</span><span><i></i>${escapeHtml(c.evidence)}</span><span><i></i>${escapeHtml(c.memory)}</span><span><i></i>${escapeHtml(c.transcript)}</span></div>
        <p>${escapeHtml(c.contextDescription)}</p>
      </article>
      <article class="kernel-panel kernel-threads"><header><div><span class="kernel-kicker">${escapeHtml(c.durableThreads)}</span><h2>${escapeHtml(c.resumeAuthority)}</h2></div><span>${escapeHtml(c.epochFenced)}</span></header><div class="kernel-thread-list">${threadRows(value.threads, c, language)}</div></article>
      <article class="kernel-panel kernel-capabilities"><header><div><span class="kernel-kicker">${escapeHtml(c.capabilityAuthority)}</span><h2>${escapeHtml(c.leastPrivilege)}</h2></div><span>${escapeHtml(c.failClosed)}</span></header>${capabilityRows(value.leases, c)}</article>
      <article class="kernel-panel kernel-boundary">
        <div class="boundary-orbit"><span>${escapeHtml(c.executor)}</span><i></i><strong>${c.reviewBoundary}</strong><i></i><span>${escapeHtml(c.merge)}</span></div>
        <div><span class="kernel-kicker">${escapeHtml(c.independentVerification)}</span><h2>${escapeHtml(c.cannotApprove)}</h2><p>${escapeHtml(c.verificationDescription)}</p></div>
      </article>
      <article class="kernel-panel kernel-architecture"><header><div><span class="kernel-kicker">${escapeHtml(c.coreInvariants)}</span><h2>${escapeHtml(c.hardProperties)}</h2></div></header><div class="architecture-list">${architecture.map(([label, enabled]) => `<div><i data-enabled="${enabled === true || enabled === 'blocked'}"></i><span>${escapeHtml(label)}</span><strong>${enabled === 'blocked' ? escapeHtml(c.blocked) : enabled ? escapeHtml(c.enforced) : escapeHtml(c.unavailableState)}</strong></div>`).join('')}</div></article>
    </div>
  </section>`;
}
