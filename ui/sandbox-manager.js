function ensureStyles() {
  if (document.querySelector('link[data-sandbox-manager]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = '/sandbox-manager.css'; link.dataset.sandboxManager = 'true';
  document.head.append(link);
}

const markup = `<div class="sandbox-grid-bg" aria-hidden="true"></div>
<header class="sandbox-header"><div><span class="eyebrow">Local execution guard</span><h1>Local Resource Sandbox</h1><p>Quan sát CPU, RAM, process và dung lượng workspace của terminal do Nolane Agent quản lý. Lease bị vượt ngưỡng liên tiếp sẽ được dừng và ghi receipt.</p></div><div class="sandbox-actions"><button id="sandbox-refresh" class="secondary-button" type="button">Làm mới</button></div></header>
<section id="sandbox-capabilities" class="sandbox-capabilities" aria-live="polite"></section>
<section class="sandbox-section"><header><div><span class="eyebrow">Durable leases</span><h2>Sandbox đang quản lý</h2></div><span id="sandbox-count" class="sandbox-count">0 lease</span></header><div id="sandbox-list" class="sandbox-list"></div></section>`;

function node(tag, className, text) { const value = document.createElement(tag); if (className) value.className = className; if (text != null) value.textContent = String(text); return value; }
function formatBytes(value) { const bytes = Math.max(0, Number(value) || 0); if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`; if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`; return `${(bytes / 1024 ** 3).toFixed(2)} GiB`; }
function percentage(actual, limit) { return Math.max(0, Math.min(100, limit > 0 ? (Number(actual) / Number(limit)) * 100 : 0)); }

export function initSandboxManager({ api, state, toast, setView }) {
  ensureStyles();
  const root = document.getElementById('sandbox-manager');
  root.className = 'sandbox-manager view'; root.innerHTML = markup;
  const get = (id) => root.querySelector(`#${id}`);
  let projectId = state.projectId;
  let capabilities = null;
  let leases = [];

  const meter = (label, actual, limit, formatter = (value) => String(value)) => {
    const box = node('div', 'sandbox-meter');
    const head = node('div', 'sandbox-meter-head'); head.append(node('span', '', label), node('strong', '', `${formatter(actual)} / ${formatter(limit)}`));
    const track = node('div', 'sandbox-meter-track'); const fill = node('span', 'sandbox-meter-fill'); fill.style.setProperty('--sandbox-value', `${percentage(actual, limit)}%`); track.append(fill);
    box.append(head, track); return box;
  };

  const renderCapabilities = () => {
    const host = get('sandbox-capabilities');
    if (!capabilities) { host.replaceChildren(node('div', 'sandbox-empty', 'Đang kiểm tra capability của host.')); return; }
    const values = [
      ['Enforcement', capabilities.cgroupV2 ? 'cgroup v2 + watchdog' : capabilities.watchdogTerminate ? 'watchdog terminate' : 'unavailable'],
      ['Platform', capabilities.platform],
      ['Limits', (capabilities.limits ?? []).join(' · ')],
      ['Podman', capabilities.nativeDrivers?.podman?.available ? `available ${capabilities.nativeDrivers.podman.version ?? ''}`.trim() : `unavailable · ${capabilities.nativeDrivers?.podman?.reason ?? 'not detected'}`],
      ['Windows Job Objects', capabilities.nativeDrivers?.windowsJobObjects?.available ? 'available' : `unavailable · ${capabilities.nativeDrivers?.windowsJobObjects?.reason ?? 'wrong platform or helper missing'}`],
      ['macOS sandbox', capabilities.nativeDrivers?.macOsSandbox?.available ? 'available' : `unavailable · ${capabilities.nativeDrivers?.macOsSandbox?.reason ?? 'wrong platform or runtime missing'}`],
    ];
    host.replaceChildren(...values.map(([label, value]) => { const card = node('article', 'sandbox-capability'); card.append(node('small', '', label), node('strong', '', value)); return card; }));
  };

  const renderLease = (lease) => {
    const card = node('article', `sandbox-lease state-${lease.state}`);
    const header = node('header', 'sandbox-lease-header');
    const title = node('div'); title.append(node('small', '', lease.mode), node('strong', '', lease.id));
    header.append(title, node('span', `sandbox-state ${lease.state}`, lease.state));
    const usage = lease.usage ?? {};
    const limits = lease.limits ?? {};
    const meters = node('div', 'sandbox-meters');
    meters.append(
      meter('CPU', usage.cpuPercent ?? 0, limits.cpuPercent ?? 0, (value) => `${Number(value || 0).toFixed(1)}%`),
      meter('RAM', usage.memoryBytes ?? 0, limits.memoryBytes ?? 0, formatBytes),
      meter('Process', usage.processCount ?? 0, limits.processCount ?? 0),
      meter('Disk', usage.diskBytes ?? 0, limits.diskBytes ?? 0, formatBytes),
    );
    const meta = node('div', 'sandbox-meta');
    meta.append(node('span', '', `PID ${lease.attachedPid ?? '—'}`), node('span', '', `Grace ${lease.consecutiveViolations ?? 0}/${limits.violationGraceSamples ?? 0}`), node('code', '', `receipt ${String(lease.receiptSha256 ?? '—').slice(0, 16)}`));
    const evidence = node('div', 'sandbox-evidence');
    for (const violation of lease.violations ?? []) evidence.append(node('span', 'sandbox-violation', `${violation.dimension}: ${violation.actual} > ${violation.limit}`));
    if (!(lease.violations ?? []).length) evidence.append(node('span', 'sandbox-ok', 'Không có giới hạn bị vượt trong sample cuối.'));
    const actions = node('div', 'sandbox-lease-actions');
    const sample = node('button', 'secondary-button', 'Sample now'); sample.type = 'button'; sample.disabled = !['active', 'pressure'].includes(lease.state);
    sample.onclick = async () => { try { await api(`/api/local-resource-sandboxes/${encodeURIComponent(lease.id)}/sample`, { method: 'POST', body: JSON.stringify({ projectId }) }); await load(); } catch (error) { toast(error.message, true); } };
    const close = node('button', 'danger-button', 'Close'); close.type = 'button'; close.disabled = lease.state === 'closed';
    close.onclick = async () => { try { await api(`/api/local-resource-sandboxes/${encodeURIComponent(lease.id)}/close`, { method: 'POST', body: JSON.stringify({ projectId, terminate: true }) }); await load(); } catch (error) { toast(error.message, true); } };
    actions.append(sample, close);
    card.append(header, meters, meta, evidence, actions);
    return card;
  };

  const render = () => {
    renderCapabilities();
    get('sandbox-count').textContent = `${leases.length} lease`;
    const host = get('sandbox-list');
    host.replaceChildren(...leases.map(renderLease));
    if (!leases.length) host.append(node('div', 'sandbox-empty', projectId ? 'Chưa có terminal sandbox trong dự án này.' : 'Chọn dự án để xem sandbox.'));
  };

  async function load() {
    projectId = state.projectId ?? projectId;
    capabilities = await api('/api/local-resource-sandboxes/capabilities');
    leases = projectId ? await api(`/api/local-resource-sandboxes?projectId=${encodeURIComponent(projectId)}`) : [];
    render(); return { capabilities, leases };
  }

  get('sandbox-refresh').onclick = () => load().catch((error) => toast(error.message, true));
  return Object.freeze({
    async open() { setView('sandbox'); try { return await load(); } catch (error) { toast(`Không thể tải Sandbox Manager: ${error.message}`, true); render(); return null; } },
    async setProject(value) { projectId = value; if (!root.hidden) return load(); return null; },
    load,
  });
}
