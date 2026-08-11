const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.6c3fc79da886.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.268f5eaca58a.mjs'),
  operations: () => import('./domains/operations.efd808b4b14c.mjs'),
  runtime: () => import('./domains/runtime.ca3c37c97850.mjs'),
  'context-memory': () => import('./domains/context-memory.5dde60681124.mjs'),
  evidence: () => import('./domains/evidence.e4d413e58e55.mjs'),
  intelligence: () => import('./domains/intelligence.3d17f1dc1108.mjs'),
  'trust-security': () => import('./domains/trust-security.d3ead7924cfd.mjs'),
  governance: () => import('./domains/governance.263777348134.mjs'),
  extensions: () => import('./domains/extensions.8aca3021a718.mjs'),
  autonomy: () => import('./domains/autonomy.bff3da14ca08.mjs'),
  labs: () => import('./domains/platform.aeb5f1827db6.mjs'),
  release: () => import('./domains/release.d7206a9c7883.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.f87e1c3cad95.mjs'),
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
