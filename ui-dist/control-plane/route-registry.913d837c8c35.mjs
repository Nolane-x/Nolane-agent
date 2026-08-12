const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.0770b1656cd0.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.8094ccd36589.mjs'),
  operations: () => import('./domains/operations.e1940c099ab3.mjs'),
  runtime: () => import('./domains/runtime.bd675edc3ee2.mjs'),
  'context-memory': () => import('./domains/context-memory.ffb9614760f4.mjs'),
  evidence: () => import('./domains/evidence.9446d1f56efe.mjs'),
  intelligence: () => import('./domains/intelligence.a5f88e70e3fa.mjs'),
  'trust-security': () => import('./domains/trust-security.722ad9acce9b.mjs'),
  governance: () => import('./domains/governance.dfc6d43e2f59.mjs'),
  extensions: () => import('./domains/extensions.718adcf12327.mjs'),
  autonomy: () => import('./domains/autonomy.496e011f5105.mjs'),
  labs: () => import('./domains/platform.3a3bac11e78a.mjs'),
  release: () => import('./domains/release.e8e0e6c5878c.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.4edb2873e205.mjs'),
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
