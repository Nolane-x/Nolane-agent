const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.1a8ef9f6906e.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.f4b31ae6d0d6.mjs'),
  operations: () => import('./domains/operations.8de5ddd1686d.mjs'),
  runtime: () => import('./domains/runtime.c62c2abbd8cc.mjs'),
  'context-memory': () => import('./domains/context-memory.1c986088a59a.mjs'),
  evidence: () => import('./domains/evidence.1be80581e6ec.mjs'),
  intelligence: () => import('./domains/intelligence.1bfc68eb16bd.mjs'),
  'trust-security': () => import('./domains/trust-security.8b7e61373eae.mjs'),
  governance: () => import('./domains/governance.04771ff0439b.mjs'),
  extensions: () => import('./domains/extensions.feace69a4c16.mjs'),
  autonomy: () => import('./domains/autonomy.f309e645b4be.mjs'),
  labs: () => import('./domains/platform.f7f058f09028.mjs'),
  release: () => import('./domains/release.548aa8bf11be.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.23b557d55d45.mjs'),
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
