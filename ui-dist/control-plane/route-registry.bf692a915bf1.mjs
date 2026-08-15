const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.f83211c26e72.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.d9cdb4832cfd.mjs'),
  operations: () => import('./domains/operations.74f745c92a18.mjs'),
  runtime: () => import('./domains/runtime.30d13b56cbcb.mjs'),
  'context-memory': () => import('./domains/context-memory.046ee362693d.mjs'),
  evidence: () => import('./domains/evidence.7402ed87cf78.mjs'),
  intelligence: () => import('./domains/intelligence.16421f0bed6a.mjs'),
  'trust-security': () => import('./domains/trust-security.0155fdd199b6.mjs'),
  governance: () => import('./domains/governance.37cfaa45f431.mjs'),
  extensions: () => import('./domains/extensions.b1dc5ce6efc1.mjs'),
  autonomy: () => import('./domains/autonomy.44fba162835d.mjs'),
  labs: () => import('./domains/platform.923ecc5fb3eb.mjs'),
  release: () => import('./domains/release.64d95c8d7473.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.2de68a5e9ab6.mjs'),
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
