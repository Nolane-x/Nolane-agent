const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.905f0a6c7e8e.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.bb98d1979b86.mjs'),
  operations: () => import('./domains/operations.5be5834e1113.mjs'),
  runtime: () => import('./domains/runtime.c21c91a38841.mjs'),
  'context-memory': () => import('./domains/context-memory.872e9039ae87.mjs'),
  evidence: () => import('./domains/evidence.2a2283932be2.mjs'),
  intelligence: () => import('./domains/intelligence.32948b8539da.mjs'),
  'trust-security': () => import('./domains/trust-security.11c89ad4cbc0.mjs'),
  governance: () => import('./domains/governance.692b3f2bc190.mjs'),
  extensions: () => import('./domains/extensions.86c1f51ad122.mjs'),
  autonomy: () => import('./domains/autonomy.79bac9ee9805.mjs'),
  labs: () => import('./domains/platform.ce9f7adb1647.mjs'),
  release: () => import('./domains/release.bb69d6edea98.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.156b49b60e38.mjs'),
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
