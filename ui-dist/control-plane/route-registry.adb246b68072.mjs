const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.adad994a4191.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.289662317975.mjs'),
  operations: () => import('./domains/operations.e457691348cb.mjs'),
  runtime: () => import('./domains/runtime.ca2f41e83fda.mjs'),
  'context-memory': () => import('./domains/context-memory.eba13096605e.mjs'),
  evidence: () => import('./domains/evidence.be13e55349d3.mjs'),
  intelligence: () => import('./domains/intelligence.d8d0c26e0367.mjs'),
  'trust-security': () => import('./domains/trust-security.7d27163dd07b.mjs'),
  governance: () => import('./domains/governance.c5f50afe7f94.mjs'),
  extensions: () => import('./domains/extensions.3213654a0aa4.mjs'),
  autonomy: () => import('./domains/autonomy.0336ee5a0466.mjs'),
  labs: () => import('./domains/platform.db1294fb9c43.mjs'),
  release: () => import('./domains/release.6f0758d38352.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.179ea6a33ff1.mjs'),
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
