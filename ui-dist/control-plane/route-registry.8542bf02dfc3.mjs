const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.72e0c9dc050d.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.36903f23ad8a.mjs'),
  operations: () => import('./domains/operations.5cb584baeb7f.mjs'),
  runtime: () => import('./domains/runtime.d470178d4b27.mjs'),
  'context-memory': () => import('./domains/context-memory.d6876c926407.mjs'),
  evidence: () => import('./domains/evidence.256956294e56.mjs'),
  intelligence: () => import('./domains/intelligence.4c010d8b5951.mjs'),
  'trust-security': () => import('./domains/trust-security.306b3c2e3d30.mjs'),
  governance: () => import('./domains/governance.6bdae9e79f45.mjs'),
  extensions: () => import('./domains/extensions.9432cd919d3d.mjs'),
  autonomy: () => import('./domains/autonomy.83203d39526c.mjs'),
  labs: () => import('./domains/platform.e88294967457.mjs'),
  release: () => import('./domains/release.5e6cbc259d8a.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.109d77708ed0.mjs'),
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
