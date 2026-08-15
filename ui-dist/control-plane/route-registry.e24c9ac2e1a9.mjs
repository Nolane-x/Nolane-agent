const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.8a5c68bb45cd.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.3f30f5e3bd58.mjs'),
  operations: () => import('./domains/operations.70625eb000a4.mjs'),
  runtime: () => import('./domains/runtime.105661f18714.mjs'),
  'context-memory': () => import('./domains/context-memory.810666330013.mjs'),
  evidence: () => import('./domains/evidence.d4c93fda2a80.mjs'),
  intelligence: () => import('./domains/intelligence.e90450d77579.mjs'),
  'trust-security': () => import('./domains/trust-security.af09760ffea3.mjs'),
  governance: () => import('./domains/governance.b2e7d469e8de.mjs'),
  extensions: () => import('./domains/extensions.300305b89f5a.mjs'),
  autonomy: () => import('./domains/autonomy.7ca17ad4e00f.mjs'),
  labs: () => import('./domains/platform.204839f5e5c3.mjs'),
  release: () => import('./domains/release.39800ef1839a.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.dfcb20566d91.mjs'),
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
