const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.b6123e517b43.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.8e1854552fd3.mjs'),
  operations: () => import('./domains/operations.4ebe1a64ebd9.mjs'),
  runtime: () => import('./domains/runtime.1ddc82352613.mjs'),
  'context-memory': () => import('./domains/context-memory.ceeb9e4d3bb3.mjs'),
  evidence: () => import('./domains/evidence.46fd08fb8201.mjs'),
  intelligence: () => import('./domains/intelligence.26675ee7211a.mjs'),
  'trust-security': () => import('./domains/trust-security.e9878e8efdd3.mjs'),
  governance: () => import('./domains/governance.b6171ce4ab5b.mjs'),
  extensions: () => import('./domains/extensions.62049f49d08a.mjs'),
  autonomy: () => import('./domains/autonomy.dcdf88bfa5d9.mjs'),
  labs: () => import('./domains/platform.304f1d99d339.mjs'),
  release: () => import('./domains/release.e62d0e33f7e8.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.a405cf8a4a1e.mjs'),
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
