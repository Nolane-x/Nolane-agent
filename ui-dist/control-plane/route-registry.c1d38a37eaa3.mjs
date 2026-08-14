const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.8b2b4d065a9b.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.f8c0913f182b.mjs'),
  operations: () => import('./domains/operations.b623da5cadab.mjs'),
  runtime: () => import('./domains/runtime.dbfbb00565ef.mjs'),
  'context-memory': () => import('./domains/context-memory.d3f8a3c5f563.mjs'),
  evidence: () => import('./domains/evidence.6ecf48633c6b.mjs'),
  intelligence: () => import('./domains/intelligence.7b5751e49fad.mjs'),
  'trust-security': () => import('./domains/trust-security.e0557cf4f3d6.mjs'),
  governance: () => import('./domains/governance.97f4ae14732b.mjs'),
  extensions: () => import('./domains/extensions.6a4f548afbdc.mjs'),
  autonomy: () => import('./domains/autonomy.a6da97e2ab16.mjs'),
  labs: () => import('./domains/platform.92736a806ce1.mjs'),
  release: () => import('./domains/release.1b885497dbd2.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.cd910c0787a4.mjs'),
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
