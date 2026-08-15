const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.49f0623eca39.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.a1e2c197307f.mjs'),
  operations: () => import('./domains/operations.d65a3735ccf7.mjs'),
  runtime: () => import('./domains/runtime.24d366736a48.mjs'),
  'context-memory': () => import('./domains/context-memory.033f04098323.mjs'),
  evidence: () => import('./domains/evidence.33053f5305a8.mjs'),
  intelligence: () => import('./domains/intelligence.28e17f4d591d.mjs'),
  'trust-security': () => import('./domains/trust-security.73c18c3afd35.mjs'),
  governance: () => import('./domains/governance.ecbecc7f5613.mjs'),
  extensions: () => import('./domains/extensions.8130b72de8b0.mjs'),
  autonomy: () => import('./domains/autonomy.d6bd482b313e.mjs'),
  labs: () => import('./domains/platform.2487eff17ceb.mjs'),
  release: () => import('./domains/release.b74603483128.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.cb566f4b123b.mjs'),
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
