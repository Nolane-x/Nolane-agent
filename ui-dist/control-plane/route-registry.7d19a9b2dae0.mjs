const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.a045ce6322c8.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.077b10a34db5.mjs'),
  operations: () => import('./domains/operations.1e407b3ea4c7.mjs'),
  runtime: () => import('./domains/runtime.5dc75fc92955.mjs'),
  'context-memory': () => import('./domains/context-memory.0cd8cd5a3a59.mjs'),
  evidence: () => import('./domains/evidence.50951656d59c.mjs'),
  intelligence: () => import('./domains/intelligence.513914d2ed93.mjs'),
  'trust-security': () => import('./domains/trust-security.78025902b2e1.mjs'),
  governance: () => import('./domains/governance.323c4b9208ba.mjs'),
  extensions: () => import('./domains/extensions.09cdb0602695.mjs'),
  autonomy: () => import('./domains/autonomy.c54ea5097323.mjs'),
  labs: () => import('./domains/platform.4ca0fa1526cb.mjs'),
  release: () => import('./domains/release.0e8fbd31f062.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.27195773e5d1.mjs'),
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
