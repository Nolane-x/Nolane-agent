const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.15dc68e79f06.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.4237d5841e9f.mjs'),
  operations: () => import('./domains/operations.690ec6e10e56.mjs'),
  runtime: () => import('./domains/runtime.689e4090fd36.mjs'),
  'context-memory': () => import('./domains/context-memory.728200a69d40.mjs'),
  evidence: () => import('./domains/evidence.c3bf00e560e5.mjs'),
  intelligence: () => import('./domains/intelligence.5b5cbe187223.mjs'),
  'trust-security': () => import('./domains/trust-security.6a8a0e47e7f8.mjs'),
  governance: () => import('./domains/governance.9d9dbbb2af11.mjs'),
  extensions: () => import('./domains/extensions.5c899c1a272d.mjs'),
  autonomy: () => import('./domains/autonomy.eb856da2d96d.mjs'),
  labs: () => import('./domains/platform.467e09dfe946.mjs'),
  release: () => import('./domains/release.9b94f735fa13.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.bfe73e199954.mjs'),
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
