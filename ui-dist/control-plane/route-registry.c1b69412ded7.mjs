const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.98239a4818a8.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.a87e0f9d8540.mjs'),
  operations: () => import('./domains/operations.ee485a7d5eaa.mjs'),
  runtime: () => import('./domains/runtime.2ab1c4f28db0.mjs'),
  'context-memory': () => import('./domains/context-memory.f69f84867d1d.mjs'),
  evidence: () => import('./domains/evidence.ab5d86687374.mjs'),
  intelligence: () => import('./domains/intelligence.c5104da22b2c.mjs'),
  'trust-security': () => import('./domains/trust-security.0bf09cb001c1.mjs'),
  governance: () => import('./domains/governance.ec4b61955e1e.mjs'),
  extensions: () => import('./domains/extensions.f8e55aa0f9c5.mjs'),
  autonomy: () => import('./domains/autonomy.0c029ff20756.mjs'),
  labs: () => import('./domains/platform.22ec6d65af05.mjs'),
  release: () => import('./domains/release.3c3b8d9b83ed.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.2ac092e1a124.mjs'),
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
