const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.f1093e1d3bde.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.5e9b924fd43d.mjs'),
  operations: () => import('./domains/operations.dd1130ee1291.mjs'),
  runtime: () => import('./domains/runtime.47e91d896d56.mjs'),
  'context-memory': () => import('./domains/context-memory.8f9db78945a2.mjs'),
  evidence: () => import('./domains/evidence.88c02544f0c5.mjs'),
  intelligence: () => import('./domains/intelligence.83866cb703b9.mjs'),
  'trust-security': () => import('./domains/trust-security.adcf3054acce.mjs'),
  governance: () => import('./domains/governance.5c8f10b1b434.mjs'),
  extensions: () => import('./domains/extensions.8a20251763e5.mjs'),
  autonomy: () => import('./domains/autonomy.55ebe216c655.mjs'),
  labs: () => import('./domains/platform.a59a492c31bf.mjs'),
  release: () => import('./domains/release.0e82b94a4c79.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.8ea512e68d6a.mjs'),
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
