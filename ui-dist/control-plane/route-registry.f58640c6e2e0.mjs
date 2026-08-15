const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.6f4d034e21b2.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.7d1536f9e520.mjs'),
  operations: () => import('./domains/operations.f9b8c509216e.mjs'),
  runtime: () => import('./domains/runtime.50af7aad06de.mjs'),
  'context-memory': () => import('./domains/context-memory.6b0499066672.mjs'),
  evidence: () => import('./domains/evidence.b50fb01785e6.mjs'),
  intelligence: () => import('./domains/intelligence.613670b4f584.mjs'),
  'trust-security': () => import('./domains/trust-security.3a995e161a8e.mjs'),
  governance: () => import('./domains/governance.26f434c65c12.mjs'),
  extensions: () => import('./domains/extensions.f2f0aafcbb3e.mjs'),
  autonomy: () => import('./domains/autonomy.c1eb499540ed.mjs'),
  labs: () => import('./domains/platform.b667917a96b6.mjs'),
  release: () => import('./domains/release.cdcb75575270.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.0f5436cba7d4.mjs'),
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
