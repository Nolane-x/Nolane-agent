export const CONTROL_PLANE_DOMAINS = Object.freeze(['overview', 'agent-kernel', 'operations', 'runtime', 'context-memory', 'evidence', 'intelligence', 'trust-security', 'governance', 'extensions', 'autonomy', 'capabilities', 'labs', 'release']);
const LABELS = Object.freeze({ overview: 'Overview', 'agent-kernel': 'Agent Kernel', operations: 'Operations', runtime: 'Runtime', 'context-memory': 'Context & Memory', evidence: 'Evidence', intelligence: 'Intelligence', 'trust-security': 'Trust & Security', governance: 'Governance', extensions: 'Extensions', autonomy: 'Autonomy', capabilities: 'Capability Atlas', labs: 'Labs & Benchmarks', release: 'Release & Recovery' });
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
function parsePath(value) { const path = String(value ?? '/control-plane/overview').split('?')[0].replace(/\/+$/, ''); const segments = path.split('/').filter(Boolean); if (segments[0] !== 'control-plane') throw new Error(`Invalid Control Plane path: ${value}`); return { path, domain: segments[1] ?? 'overview', subroute: segments.slice(2).join('/') || null }; }
export function createControlPlaneModel({ missionContext = null, loader } = {}) {
  if (typeof loader !== 'function') throw new Error('Control Plane requires loader');
  const cache = new Map(); let active = null;
  return Object.freeze({
    async navigate(path) { const parsed = parsePath(path); if (!CONTROL_PLANE_DOMAINS.includes(parsed.domain)) throw new Error(`Unknown Control Plane domain: ${parsed.domain}`); if (active?.domain !== parsed.domain) active?.module?.suspend?.(); if (!cache.has(parsed.domain)) cache.set(parsed.domain, Promise.resolve().then(() => loader(parsed.domain))); const module = await cache.get(parsed.domain); active = Object.freeze({ ...parsed, module, status: 'ready' }); return active; },
    async navigateSafe(path) { try { return await this.navigate(path); } catch (error) { const parsed = parsePath(path); cache.delete(parsed.domain); active = Object.freeze({ ...parsed, module: null, status: 'error', message: String(error?.message ?? error) }); return active; } },
    suspend() { active?.module?.suspend?.(); },
    snapshot() { return Object.freeze({ product: 'Nolane Agent', domains: CONTROL_PLANE_DOMAINS, activeDomain: active?.domain ?? 'overview', activePath: active?.path ?? '/control-plane/overview', activeSubroute: active?.subroute ?? null, missionContext: missionContext ? Object.freeze({ ...missionContext }) : null, loadedDomains: Object.freeze([...cache.keys()]) }); },
  });
}
export function renderControlPlaneShell(snapshot, { content = '' } = {}) {
  const back = snapshot.missionContext ? `<a href="#${escapeHtml(snapshot.missionContext.returnPath)}">← Back to Mission</a>` : '<span>Nolane Agent Control Plane</span>';
  return `<section class="control-plane-shell"><header>${back}<strong>Control Plane</strong></header><nav aria-label="Control Plane domains">${snapshot.domains.map((domain) => `<a href="#/control-plane/${domain}" data-control-plane-domain="${domain}" aria-current="${domain === snapshot.activeDomain ? 'page' : 'false'}">${escapeHtml(LABELS[domain])}</a>`).join('')}</nav><main data-control-plane-route="${escapeHtml(snapshot.activePath)}">${content}</main></section>`;
}
