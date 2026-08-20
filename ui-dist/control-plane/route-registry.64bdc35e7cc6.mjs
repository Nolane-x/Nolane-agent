const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.b923dd7884d3.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.0ee6c799ded6.mjs'),
  operations: () => import('./domains/operations.15e1d43ad651.mjs'),
  runtime: () => import('./domains/runtime.f23985c739d2.mjs'),
  'context-memory': () => import('./domains/context-memory.e1a2b4315140.mjs'),
  evidence: () => import('./domains/evidence.e6f235ab41da.mjs'),
  intelligence: () => import('./domains/intelligence.7705664045bf.mjs'),
  'trust-security': () => import('./domains/trust-security.4250e6462bdc.mjs'),
  governance: () => import('./domains/governance.0dcedaec16f3.mjs'),
  extensions: () => import('./domains/extensions.3385f9e9120f.mjs'),
  autonomy: () => import('./domains/autonomy.8f80fce63750.mjs'),
  labs: () => import('./domains/platform.79d652429a34.mjs'),
  release: () => import('./domains/release.9bb11eccf28f.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.2248994a7161.mjs'),
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
