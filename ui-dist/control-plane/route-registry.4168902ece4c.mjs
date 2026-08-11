const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.fe979292cf71.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.bfc4bd5ad5be.mjs'),
  operations: () => import('./domains/operations.bce7f4b417fe.mjs'),
  runtime: () => import('./domains/runtime.ff9bdf21e33a.mjs'),
  'context-memory': () => import('./domains/context-memory.87508d1e73ea.mjs'),
  evidence: () => import('./domains/evidence.3b9e4bf44af3.mjs'),
  intelligence: () => import('./domains/intelligence.f02d4a38e572.mjs'),
  'trust-security': () => import('./domains/trust-security.23151689d7d5.mjs'),
  governance: () => import('./domains/governance.9a5989504973.mjs'),
  extensions: () => import('./domains/extensions.dcb8cc6f40cb.mjs'),
  autonomy: () => import('./domains/autonomy.93d6e9fd8471.mjs'),
  labs: () => import('./domains/platform.a5b048b08794.mjs'),
  release: () => import('./domains/release.946801d8415d.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.dd00e08e32d8.mjs'),
  enumerable: false,
  configurable: false,
  writable: false,
});
export const CONTROL_PLANE_ROUTES = Object.freeze(approvedRoutes);
export async function loadControlPlaneDomain(domain) { const loader = CONTROL_PLANE_ROUTES[domain]; if (!loader) throw new Error(`Unknown Control Plane domain: ${domain}`); if (!cache.has(domain)) cache.set(domain, Promise.resolve().then(loader)); return cache.get(domain); }
export function clearControlPlaneRouteCache() { cache.clear(); }

export function renderControlPlaneDomain(domain, module, { language = 'en' } = {}) {
  if (domain === 'capabilities') return module.renderCapabilitiesView(module.buildCapabilitiesViewModel({ language }));
  if (domain === 'agent-kernel') return module.renderAgentKernelView(module.buildAgentKernelView(), { language });
  if (domain === 'overview') return module.renderOverviewView(module.buildOverviewView(), { language });
  if (domain === 'operations') return module.renderOperationsView(module.buildOperationsView(), { language });
  if (domain === 'runtime') { const model = module.createRuntimeView(); return module.renderRuntimeView(model.snapshot(), { language }); }
  if (domain === 'context-memory') return module.renderContextMemoryView(module.buildContextMemoryView(), { language });
  if (domain === 'evidence') return module.renderEvidenceView(module.buildEvidenceView(), { language });
  if (domain === 'intelligence') return module.renderIntelligenceView(module.buildIntelligenceView(), { language });
  if (domain === 'trust-security') return module.renderTrustSecurityView(module.buildTrustSecurityView(), { language });
  if (domain === 'governance') return module.renderGovernanceView(module.buildGovernanceView(), { language });
  if (domain === 'extensions') return module.renderExtensionsView(module.buildExtensionsView(), { language });
  if (domain === 'autonomy') return module.renderAutonomyView(module.buildAutonomyView(), { language });
  if (domain === 'release') return module.renderReleaseView(module.buildReleaseView(), { language });
  return module.renderPlatformView(module.buildPlatformView(), domain, { language });
}
