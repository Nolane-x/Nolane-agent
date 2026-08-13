const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.ff8d79e1a6c7.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.852f6a31c490.mjs'),
  operations: () => import('./domains/operations.3b60ef21e859.mjs'),
  runtime: () => import('./domains/runtime.ae8ef98f8054.mjs'),
  'context-memory': () => import('./domains/context-memory.b54e76bf97cf.mjs'),
  evidence: () => import('./domains/evidence.e40553fe416a.mjs'),
  intelligence: () => import('./domains/intelligence.ea9d2ed07431.mjs'),
  'trust-security': () => import('./domains/trust-security.848a24399a63.mjs'),
  governance: () => import('./domains/governance.71eb42786de4.mjs'),
  extensions: () => import('./domains/extensions.14f296180a38.mjs'),
  autonomy: () => import('./domains/autonomy.f28e0e634f79.mjs'),
  labs: () => import('./domains/platform.74437aa4d672.mjs'),
  release: () => import('./domains/release.5c14527f919a.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.4e6e7c93178a.mjs'),
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
