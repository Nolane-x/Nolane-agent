const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.9ec3ca5aae62.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.60330a9b4d50.mjs'),
  operations: () => import('./domains/operations.9b4a14857562.mjs'),
  runtime: () => import('./domains/runtime.68fef99d15a9.mjs'),
  'context-memory': () => import('./domains/context-memory.0d9b6ad8c6dc.mjs'),
  evidence: () => import('./domains/evidence.dd996c18fe32.mjs'),
  intelligence: () => import('./domains/intelligence.cdc2a3132e6c.mjs'),
  'trust-security': () => import('./domains/trust-security.b5f6b67dcf9e.mjs'),
  governance: () => import('./domains/governance.94a1abbf8c6c.mjs'),
  extensions: () => import('./domains/extensions.cc299361c01c.mjs'),
  autonomy: () => import('./domains/autonomy.be389b1ed124.mjs'),
  labs: () => import('./domains/platform.3a6c1413ebf9.mjs'),
  release: () => import('./domains/release.d21a00a6022d.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.af673788dfda.mjs'),
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
