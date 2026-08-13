const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.eb5d26263418.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.b468fbd9dbbe.mjs'),
  operations: () => import('./domains/operations.7767665de63e.mjs'),
  runtime: () => import('./domains/runtime.2bb50d9ccbaa.mjs'),
  'context-memory': () => import('./domains/context-memory.f56d14c01720.mjs'),
  evidence: () => import('./domains/evidence.2c84f57fc039.mjs'),
  intelligence: () => import('./domains/intelligence.7fd460f0c3a1.mjs'),
  'trust-security': () => import('./domains/trust-security.3f350224301d.mjs'),
  governance: () => import('./domains/governance.1538dd262dd5.mjs'),
  extensions: () => import('./domains/extensions.2da10fc0deb3.mjs'),
  autonomy: () => import('./domains/autonomy.c080aff5eeca.mjs'),
  labs: () => import('./domains/platform.98ba4999bb42.mjs'),
  release: () => import('./domains/release.909c33e07405.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.942bdfe99104.mjs'),
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
