const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.c40d8d3d33d6.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.608fc9497672.mjs'),
  operations: () => import('./domains/operations.d901f620bffa.mjs'),
  runtime: () => import('./domains/runtime.6504efb3ec4e.mjs'),
  'context-memory': () => import('./domains/context-memory.9a7accf4c281.mjs'),
  evidence: () => import('./domains/evidence.1885ef718b9b.mjs'),
  intelligence: () => import('./domains/intelligence.9d69d9470c10.mjs'),
  'trust-security': () => import('./domains/trust-security.a7f64dd6208d.mjs'),
  governance: () => import('./domains/governance.6b24d6ef6e8c.mjs'),
  extensions: () => import('./domains/extensions.83a0ac3f4806.mjs'),
  autonomy: () => import('./domains/autonomy.e958f5fe4ec4.mjs'),
  labs: () => import('./domains/platform.31a7c68d6ccb.mjs'),
  release: () => import('./domains/release.ed401a1d5538.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.411511b5b272.mjs'),
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
