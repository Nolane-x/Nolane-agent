const TAB_ORDER = Object.freeze(['preview', 'plan', 'changes', 'tests', 'files', 'details']);
const TAB_LABELS = Object.freeze({ preview: 'Preview', plan: 'Plan', changes: 'Changes', tests: 'Tests', files: 'Files', details: 'Details' });
const TAB_LABELS_VI = Object.freeze({ preview: 'Xem trước', plan: 'Kế hoạch', changes: 'Thay đổi', tests: 'Kiểm thử', files: 'Tệp', details: 'Chi tiết' });
const VALID_PREVIEW_STATUS = new Set(['starting', 'loading', 'ready', 'error', 'stopped']);
const SHA256 = /^[a-f0-9]{64}$/i;
let artifactIdentity = 0;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function buildArtifactDockTabs(artifacts = []) {
  const available = new Set();
  for (const artifact of artifacts) if (TAB_ORDER.includes(artifact?.type)) available.add(artifact.type);
  return Object.freeze(TAB_ORDER.filter((id) => available.has(id)).map((id) => Object.freeze({ id, label: TAB_LABELS[id] })));
}

export function createArtifactDockModel({ missionId, width = 420 } = {}) {
  if (!missionId) throw new Error('Artifact Dock requires missionId');
  const artifacts = new Map(); const keys = new Map();
  let activeTab = null; let open = true; let pinned = false; let maximized = false; let dockWidth = Math.min(720, Math.max(360, Number(width) || 420));
  const api = {
    update(items = []) {
      for (const item of items) {
        if (!item?.id || !TAB_ORDER.includes(item.type)) continue;
        const id = String(item.id); artifacts.set(id, Object.freeze({ ...(artifacts.get(id) ?? {}), ...item, id }));
        if (!keys.has(id)) keys.set(id, Object.freeze({ id, sequence: ++artifactIdentity }));
      }
      const tabs = buildArtifactDockTabs([...artifacts.values()]);
      if (!activeTab || !tabs.some((tab) => tab.id === activeTab)) activeTab = tabs[0]?.id ?? null;
    },
    select(tab) {
      const tabs = buildArtifactDockTabs([...artifacts.values()]);
      if (!tabs.some((item) => item.id === tab)) throw new Error(`Artifact tab is unavailable: ${tab}`);
      activeTab = tab;
    },
    setWidth(value) { dockWidth = Math.min(720, Math.max(360, Number(value) || 420)); },
    setOpen(value) { open = Boolean(value); }, setPinned(value) { pinned = Boolean(value); }, setMaximized(value) { maximized = Boolean(value); },
    snapshot() {
      const values = [...artifacts.values()];
      return Object.freeze({ missionId: String(missionId), open, pinned, maximized, width: dockWidth, activeTab, tabs: buildArtifactDockTabs(values), artifacts: Object.freeze(values), artifactKeys: new Map(keys) });
    },
  };
  return Object.freeze(api);
}

export function createPreviewArtifactModel({ artifactId, maxSnapshots = 20, maxAnnotations = 100 } = {}) {
  if (!artifactId) throw new Error('Preview artifact requires artifactId');
  let status = 'stopped'; const snapshots = []; const annotations = [];
  return Object.freeze({
    setStatus(value) { if (!VALID_PREVIEW_STATUS.has(value)) throw new Error(`Unknown preview status: ${value}`); status = value; },
    recordSnapshot(value) {
      if (!['before', 'after'].includes(value?.phase)) throw new Error('Snapshot phase must be before or after');
      if (!SHA256.test(value?.sha256 ?? '')) throw new Error('Snapshot requires SHA256');
      snapshots.push(Object.freeze({ phase: value.phase, sha256: value.sha256.toLowerCase(), capturedAt: String(value.capturedAt ?? new Date().toISOString()) }));
      if (snapshots.length > maxSnapshots) snapshots.splice(0, snapshots.length - maxSnapshots);
    },
    annotate(value) {
      const bounds = value?.bounds; if (!value?.selector || !bounds || ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) throw new Error('Annotation requires selector and finite bounds');
      annotations.push(Object.freeze({ selector: String(value.selector), bounds: Object.freeze({ ...bounds }), note: String(value.note ?? '') }));
      if (annotations.length > maxAnnotations) annotations.splice(0, annotations.length - maxAnnotations);
    },
    snapshot() { return Object.freeze({ artifactId: String(artifactId), status, snapshots: Object.freeze([...snapshots]), annotations: Object.freeze([...annotations]) }); },
  });
}

export function renderArtifactDock(snapshot, { language = 'en' } = {}) {
  if (!snapshot?.open) return '';
  const labels = language === 'vi' ? TAB_LABELS_VI : TAB_LABELS;
  const tabId = (id) => `artifact-tab-${escapeHtml(id)}`;
  const panelId = (id) => `artifact-panel-${escapeHtml(id)}`;
  const tabs = snapshot.tabs.map((tab) => `<button type="button" id="${tabId(tab.id)}" role="tab" aria-selected="${tab.id === snapshot.activeTab}" aria-controls="${panelId(tab.id)}" tabindex="${tab.id === snapshot.activeTab ? '0' : '-1'}" data-artifact-tab="${escapeHtml(tab.id)}">${escapeHtml(labels[tab.id] ?? tab.label)}</button>`).join('');
  const active = snapshot.artifacts.filter((item) => item.type === snapshot.activeTab);
  const content = snapshot.activeTab ? `<div id="${panelId(snapshot.activeTab)}" role="tabpanel" aria-labelledby="${tabId(snapshot.activeTab)}" tabindex="0">${active.map((item) => `<article data-artifact-id="${escapeHtml(item.id)}"><h2>${escapeHtml(item.title ?? labels[item.type])}</h2></article>`).join('')}</div>` : '';
  return `<aside class="artifact-dock${snapshot.maximized ? ' artifact-dock--maximized' : ''}" aria-label="${language === 'vi' ? 'Artifact của nhiệm vụ' : 'Mission artifacts'}"><div class="artifact-dock__tabs" role="tablist">${tabs}</div><div class="artifact-dock__content">${content}</div></aside>`;
}
