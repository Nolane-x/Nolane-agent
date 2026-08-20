const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.02aa31f1c6d8.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.5b343ce384af.mjs'),
  operations: () => import('./domains/operations.2f69fbe87c46.mjs'),
  runtime: () => import('./domains/runtime.6a2776e5e245.mjs'),
  'context-memory': () => import('./domains/context-memory.62f2061b8459.mjs'),
  evidence: () => import('./domains/evidence.a2757a2c9d4d.mjs'),
  intelligence: () => import('./domains/intelligence.0103056bd40e.mjs'),
  'trust-security': () => import('./domains/trust-security.220ef40f7bee.mjs'),
  governance: () => import('./domains/governance.a5ad59ea74f3.mjs'),
  extensions: () => import('./domains/extensions.d67aa068f4a1.mjs'),
  autonomy: () => import('./domains/autonomy.7b0c450013c5.mjs'),
  labs: () => import('./domains/platform.2563dfe74cc1.mjs'),
  release: () => import('./domains/release.2647a9d369da.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.dab063fcaf61.mjs'),
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
