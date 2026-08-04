const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.mjs'),
  operations: () => import('./domains/operations.mjs'),
  runtime: () => import('./domains/runtime.mjs'),
  'context-memory': () => import('./domains/context-memory.mjs'),
  evidence: () => import('./domains/evidence.mjs'),
  intelligence: () => import('./domains/intelligence.mjs'),
  'trust-security': () => import('./domains/trust-security.mjs'),
  governance: () => import('./domains/governance.mjs'),
  extensions: () => import('./domains/extensions.mjs'),
  autonomy: () => import('./domains/autonomy.mjs'),
  labs: () => import('./domains/platform.mjs'),
  release: () => import('./domains/release.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.mjs'),
  enumerable: false,
  configurable: false,
  writable: false,
});
export const CONTROL_PLANE_ROUTES = Object.freeze(approvedRoutes);
export async function loadControlPlaneDomain(domain) { const loader = CONTROL_PLANE_ROUTES[domain]; if (!loader) throw new Error(`Unknown Control Plane domain: ${domain}`); if (!cache.has(domain)) cache.set(domain, Promise.resolve().then(loader)); return cache.get(domain); }
export function clearControlPlaneRouteCache() { cache.clear(); }

export function renderControlPlaneDomain(domain, module) {
  if (domain === 'capabilities') return module.renderCapabilitiesView(module.buildCapabilitiesViewModel());
  if (domain === 'agent-kernel') return module.renderAgentKernelView(module.buildAgentKernelView());
  if (domain === 'overview') return module.renderOverviewView(module.buildOverviewView());
  if (domain === 'operations') return module.renderOperationsView(module.buildOperationsView());
  if (domain === 'runtime') { const model = module.createRuntimeView(); return module.renderRuntimeView(model.snapshot()); }
  if (domain === 'context-memory') return module.renderContextMemoryView(module.buildContextMemoryView());
  if (domain === 'evidence') return module.renderEvidenceView(module.buildEvidenceView());
  if (domain === 'intelligence') return module.renderIntelligenceView(module.buildIntelligenceView());
  if (domain === 'trust-security') return module.renderTrustSecurityView(module.buildTrustSecurityView());
  if (domain === 'governance') return module.renderGovernanceView(module.buildGovernanceView());
  if (domain === 'extensions') return module.renderExtensionsView(module.buildExtensionsView());
  if (domain === 'autonomy') return module.renderAutonomyView(module.buildAutonomyView());
  if (domain === 'release') return module.renderReleaseView(module.buildReleaseView());
  return module.renderPlatformView(module.buildPlatformView(), domain);
}
