const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.b82bcb96051d.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.8b1ea869f323.mjs'),
  operations: () => import('./domains/operations.e72b2223025f.mjs'),
  runtime: () => import('./domains/runtime.d6c672881304.mjs'),
  'context-memory': () => import('./domains/context-memory.27914bab9ea9.mjs'),
  evidence: () => import('./domains/evidence.2e482f686271.mjs'),
  intelligence: () => import('./domains/intelligence.5ea5be2b30b9.mjs'),
  'trust-security': () => import('./domains/trust-security.67a038a8b899.mjs'),
  governance: () => import('./domains/governance.cf0190a9721d.mjs'),
  extensions: () => import('./domains/extensions.8fba69054aa3.mjs'),
  autonomy: () => import('./domains/autonomy.959bf4312bc6.mjs'),
  labs: () => import('./domains/platform.26fdae1464b1.mjs'),
  release: () => import('./domains/release.c2bc9b00fddd.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.6052477e885b.mjs'),
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
