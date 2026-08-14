const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.a9e6e00d09e6.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.443103871518.mjs'),
  operations: () => import('./domains/operations.4dcefbff6b3a.mjs'),
  runtime: () => import('./domains/runtime.fdd7545bfb1f.mjs'),
  'context-memory': () => import('./domains/context-memory.e1c4065712d6.mjs'),
  evidence: () => import('./domains/evidence.62960d8d7fa7.mjs'),
  intelligence: () => import('./domains/intelligence.fa4223d29d2b.mjs'),
  'trust-security': () => import('./domains/trust-security.36d58c49b743.mjs'),
  governance: () => import('./domains/governance.6b75adb5b99f.mjs'),
  extensions: () => import('./domains/extensions.3d13305e1acb.mjs'),
  autonomy: () => import('./domains/autonomy.8a32883e429d.mjs'),
  labs: () => import('./domains/platform.cc96d8583bb4.mjs'),
  release: () => import('./domains/release.dbea8d3d3afa.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.1cc968b9d507.mjs'),
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
