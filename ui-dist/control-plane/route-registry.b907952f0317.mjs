const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.f9abf545fae8.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.6126067de52c.mjs'),
  operations: () => import('./domains/operations.21bac935ccda.mjs'),
  runtime: () => import('./domains/runtime.d98e59e5922f.mjs'),
  'context-memory': () => import('./domains/context-memory.a87c0143345d.mjs'),
  evidence: () => import('./domains/evidence.c7660ddf4cfc.mjs'),
  intelligence: () => import('./domains/intelligence.604400d77ccb.mjs'),
  'trust-security': () => import('./domains/trust-security.f30cdf95e18f.mjs'),
  governance: () => import('./domains/governance.1e78c5ebaf5b.mjs'),
  extensions: () => import('./domains/extensions.5db94c435f04.mjs'),
  autonomy: () => import('./domains/autonomy.9bb2b55c0757.mjs'),
  labs: () => import('./domains/platform.c2cf0fb90356.mjs'),
  release: () => import('./domains/release.d3a34b5d0f3f.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.6345e38e3797.mjs'),
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
