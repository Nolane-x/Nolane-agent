const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.6af7e4c80144.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.07de1795bcec.mjs'),
  operations: () => import('./domains/operations.72f02fd600bc.mjs'),
  runtime: () => import('./domains/runtime.c22d39eb274f.mjs'),
  'context-memory': () => import('./domains/context-memory.f12c56901526.mjs'),
  evidence: () => import('./domains/evidence.0f1d88a93826.mjs'),
  intelligence: () => import('./domains/intelligence.591afd0389d9.mjs'),
  'trust-security': () => import('./domains/trust-security.0cf45590482f.mjs'),
  governance: () => import('./domains/governance.bd8e582aede3.mjs'),
  extensions: () => import('./domains/extensions.118a3497adcc.mjs'),
  autonomy: () => import('./domains/autonomy.64b90324b4ee.mjs'),
  labs: () => import('./domains/platform.0fa6e662d03c.mjs'),
  release: () => import('./domains/release.fa8d703bf8a3.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.b223b4f350bd.mjs'),
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
