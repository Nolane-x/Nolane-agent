const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.60a5b82d412f.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.33f42cd2f50f.mjs'),
  operations: () => import('./domains/operations.6cc680129a17.mjs'),
  runtime: () => import('./domains/runtime.39e37d4fd0e5.mjs'),
  'context-memory': () => import('./domains/context-memory.524d8d5586f7.mjs'),
  evidence: () => import('./domains/evidence.f170ce8af83f.mjs'),
  intelligence: () => import('./domains/intelligence.24efa8c8f479.mjs'),
  'trust-security': () => import('./domains/trust-security.8f7eedf0aed7.mjs'),
  governance: () => import('./domains/governance.76553685b486.mjs'),
  extensions: () => import('./domains/extensions.8f50b43fdc80.mjs'),
  autonomy: () => import('./domains/autonomy.0cc67cfe61ca.mjs'),
  labs: () => import('./domains/platform.9c7a91462e6b.mjs'),
  release: () => import('./domains/release.ecb2abb87810.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.6838e99204ba.mjs'),
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
