const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.c35069e9f6ea.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.fec5297f3cf7.mjs'),
  operations: () => import('./domains/operations.d6f53b67e044.mjs'),
  runtime: () => import('./domains/runtime.e8317964aff6.mjs'),
  'context-memory': () => import('./domains/context-memory.f6935649c052.mjs'),
  evidence: () => import('./domains/evidence.58a09bc327d7.mjs'),
  intelligence: () => import('./domains/intelligence.e2b9c22d8a66.mjs'),
  'trust-security': () => import('./domains/trust-security.1d4befb9715a.mjs'),
  governance: () => import('./domains/governance.3269c46e5d1b.mjs'),
  extensions: () => import('./domains/extensions.a651a3048d1f.mjs'),
  autonomy: () => import('./domains/autonomy.495351cd3eb6.mjs'),
  labs: () => import('./domains/platform.132816d734d6.mjs'),
  release: () => import('./domains/release.b30ee5567d41.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.9bfef6ee8ca5.mjs'),
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
