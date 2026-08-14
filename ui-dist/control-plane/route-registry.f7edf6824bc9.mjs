const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.62ff82ca95db.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.7a65fcb2d49f.mjs'),
  operations: () => import('./domains/operations.ac43f821b8f7.mjs'),
  runtime: () => import('./domains/runtime.531b783c5c65.mjs'),
  'context-memory': () => import('./domains/context-memory.ae11b6f82d2b.mjs'),
  evidence: () => import('./domains/evidence.64c4c8c9e72e.mjs'),
  intelligence: () => import('./domains/intelligence.1ce643031eb0.mjs'),
  'trust-security': () => import('./domains/trust-security.9cc35645bbd6.mjs'),
  governance: () => import('./domains/governance.1053941c9395.mjs'),
  extensions: () => import('./domains/extensions.2266f781c4d5.mjs'),
  autonomy: () => import('./domains/autonomy.67f7ce9641fa.mjs'),
  labs: () => import('./domains/platform.c3165ede8df1.mjs'),
  release: () => import('./domains/release.4ed7ec26668e.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.fe517ab65fdc.mjs'),
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
