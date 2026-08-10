const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.ce77591b40d7.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.b8d9995ec789.mjs'),
  operations: () => import('./domains/operations.cb066a8e162e.mjs'),
  runtime: () => import('./domains/runtime.49208d09ea7d.mjs'),
  'context-memory': () => import('./domains/context-memory.a29d6d83fbbf.mjs'),
  evidence: () => import('./domains/evidence.7f0f615fd6e2.mjs'),
  intelligence: () => import('./domains/intelligence.c9e935648840.mjs'),
  'trust-security': () => import('./domains/trust-security.2211c4a6a01e.mjs'),
  governance: () => import('./domains/governance.758c3a133b40.mjs'),
  extensions: () => import('./domains/extensions.b19283a933bd.mjs'),
  autonomy: () => import('./domains/autonomy.3b1e16aafacc.mjs'),
  labs: () => import('./domains/platform.be3005e16903.mjs'),
  release: () => import('./domains/release.8c770ba617b8.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.91b26df5ea6e.mjs'),
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
