const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.c30eed8bb21f.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.aeaa3f4fc9f6.mjs'),
  operations: () => import('./domains/operations.88e4aa6db35d.mjs'),
  runtime: () => import('./domains/runtime.b6d4ced65663.mjs'),
  'context-memory': () => import('./domains/context-memory.330948422fc3.mjs'),
  evidence: () => import('./domains/evidence.bc0ae4a945d2.mjs'),
  intelligence: () => import('./domains/intelligence.1d3251dcc3ef.mjs'),
  'trust-security': () => import('./domains/trust-security.c92377f17d70.mjs'),
  governance: () => import('./domains/governance.964e734b2111.mjs'),
  extensions: () => import('./domains/extensions.5d68927d65d1.mjs'),
  autonomy: () => import('./domains/autonomy.8161d32e0055.mjs'),
  labs: () => import('./domains/platform.ff1d8e4217fb.mjs'),
  release: () => import('./domains/release.8b21923c895f.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.17a4cbf3106b.mjs'),
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
