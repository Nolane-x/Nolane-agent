const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.ae790d95b374.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.a56df27eebd6.mjs'),
  operations: () => import('./domains/operations.e9566dc63130.mjs'),
  runtime: () => import('./domains/runtime.6dc578079fd3.mjs'),
  'context-memory': () => import('./domains/context-memory.cf77592533e1.mjs'),
  evidence: () => import('./domains/evidence.2c183036a719.mjs'),
  intelligence: () => import('./domains/intelligence.9a73b7f13925.mjs'),
  'trust-security': () => import('./domains/trust-security.170ee5bcdd77.mjs'),
  governance: () => import('./domains/governance.a0166103d334.mjs'),
  extensions: () => import('./domains/extensions.1fabee237777.mjs'),
  autonomy: () => import('./domains/autonomy.18bc224e4f2f.mjs'),
  labs: () => import('./domains/platform.565fd6dc52cf.mjs'),
  release: () => import('./domains/release.259f5d4ce487.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.62bf23b51abd.mjs'),
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
