const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.965f897168b6.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.49bf49a1b31f.mjs'),
  operations: () => import('./domains/operations.650e1f10987b.mjs'),
  runtime: () => import('./domains/runtime.724c347ebd02.mjs'),
  'context-memory': () => import('./domains/context-memory.fa097a73a42c.mjs'),
  evidence: () => import('./domains/evidence.a0c1122e3f50.mjs'),
  intelligence: () => import('./domains/intelligence.182d97537ce6.mjs'),
  'trust-security': () => import('./domains/trust-security.7181c27a0c87.mjs'),
  governance: () => import('./domains/governance.e4e3a96627c6.mjs'),
  extensions: () => import('./domains/extensions.03f65808e3b5.mjs'),
  autonomy: () => import('./domains/autonomy.339a23be3475.mjs'),
  labs: () => import('./domains/platform.7a30129d4354.mjs'),
  release: () => import('./domains/release.9fcc2066a2b0.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.023ce743367c.mjs'),
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
