const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.219a1d8c00be.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.788f6792c54d.mjs'),
  operations: () => import('./domains/operations.a1b5bcfd1f7e.mjs'),
  runtime: () => import('./domains/runtime.27263c3225cc.mjs'),
  'context-memory': () => import('./domains/context-memory.edd345a42c19.mjs'),
  evidence: () => import('./domains/evidence.95e90e377b85.mjs'),
  intelligence: () => import('./domains/intelligence.6539c3bf720c.mjs'),
  'trust-security': () => import('./domains/trust-security.8745e0004d3d.mjs'),
  governance: () => import('./domains/governance.ef7205ee8e46.mjs'),
  extensions: () => import('./domains/extensions.d637a87f91d9.mjs'),
  autonomy: () => import('./domains/autonomy.94620056ced9.mjs'),
  labs: () => import('./domains/platform.8eb4789e416c.mjs'),
  release: () => import('./domains/release.40cea1f914f1.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.9ee16b1b5606.mjs'),
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
