const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.dbe139baf759.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.bf7e1f611157.mjs'),
  operations: () => import('./domains/operations.c7ad131c5174.mjs'),
  runtime: () => import('./domains/runtime.b5a1c689cde8.mjs'),
  'context-memory': () => import('./domains/context-memory.40a5d346a49a.mjs'),
  evidence: () => import('./domains/evidence.596e4b0b0bf8.mjs'),
  intelligence: () => import('./domains/intelligence.c7ef2c0f6530.mjs'),
  'trust-security': () => import('./domains/trust-security.2f51f6bafcab.mjs'),
  governance: () => import('./domains/governance.5fa7ba77b5ae.mjs'),
  extensions: () => import('./domains/extensions.557cf1510cb2.mjs'),
  autonomy: () => import('./domains/autonomy.0fe5b61950c2.mjs'),
  labs: () => import('./domains/platform.1adf78338349.mjs'),
  release: () => import('./domains/release.beed46438b44.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.aa7f042816a2.mjs'),
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
