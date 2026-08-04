function bytes(value) {
  const number = Math.max(0, Number(value) || 0);
  if (number < 1024) return `${number} B`;
  if (number < 1024 ** 2) return `${(number / 1024).toFixed(1)} KiB`;
  if (number < 1024 ** 3) return `${(number / 1024 ** 2).toFixed(1)} MiB`;
  return `${(number / 1024 ** 3).toFixed(2)} GiB`;
}
function boundedEntries(entries) { return (Array.isArray(entries) ? entries : []).slice(0, 12); }
function item(label, value, tone = '') {
  const row = document.createElement('div'); row.className = `resource-hud-row ${tone}`.trim();
  const name = document.createElement('span'); name.textContent = label;
  const metric = document.createElement('strong'); metric.textContent = value;
  row.append(name, metric); return row;
}
export function initMissionResourceHud({ api, root = document.getElementById('mission-resource-hud') } = {}) {
  if (typeof api !== 'function') throw new TypeError('api is required');
  if (!root) throw new Error('mission resource HUD root is missing');
  const stateLabel = root.querySelector('#mission-resource-hud-state');
  const rssLabel = root.querySelector('#mission-resource-hud-rss');
  const details = root.querySelector('#mission-resource-hud-details');
  const toggle = root.querySelector('#mission-resource-hud-toggle');
  let disposed = false; let rendering = false;
  toggle.onclick = () => { const open = details.hidden; details.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); };
  async function refresh() {
    if (disposed || rendering) return null;
    rendering = true;
    try {
      const snapshot = await api('/api/mission-resource-fabric');
      const pressure = String(snapshot.governorState ?? 'normal').toLowerCase();
      document.documentElement.dataset.resourcePressure = pressure;
      const resources = snapshot.resources?.aggregates ?? {};
      stateLabel.textContent = pressure === 'normal' ? 'Ổn định' : pressure;
      rssLabel.textContent = bytes(resources.currentRssBytes);
      const rows = [
        item('Tiến trình', String(resources.currentProcessCount ?? 0)),
        item('CPU time', `${Math.round(Number(resources.cpuTimeMs) || 0)} ms`),
        item('Provider sessions', String(snapshot.sessions?.sessions?.length ?? 0)),
        item('Index cursor', String(snapshot.intelligence?.latestCursor ?? 0)),
        item('Journey receipts', String(snapshot.journeys?.entries?.length ?? 0)),
      ];
      for (const entry of boundedEntries(snapshot.resources?.entries)) rows.push(item(entry.providerId ?? entry.taskId ?? 'process', bytes(entry.current?.rssBytes), entry.state));
      requestAnimationFrame(() => { if (!disposed) details.replaceChildren(...rows); });
      return snapshot;
    } catch (error) {
      stateLabel.textContent = 'Không khả dụng';
      requestAnimationFrame(() => { if (!disposed) details.replaceChildren(item('Runtime', String(error?.message ?? error), 'error')); });
      return null;
    } finally { rendering = false; }
  }
  const timer = setInterval(refresh, 5_000); timer.unref?.();
  return Object.freeze({ refresh, close() { disposed = true; clearInterval(timer); } });
}
