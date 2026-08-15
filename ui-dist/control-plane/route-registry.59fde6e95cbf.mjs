const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.941302b28362.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.63496e3c33a1.mjs'),
  operations: () => import('./domains/operations.05f1ae60d5c4.mjs'),
  runtime: () => import('./domains/runtime.0d2cef6be01c.mjs'),
  'context-memory': () => import('./domains/context-memory.4f7ff2ec4af9.mjs'),
  evidence: () => import('./domains/evidence.9cae3c8e31a3.mjs'),
  intelligence: () => import('./domains/intelligence.f078f27b74c3.mjs'),
  'trust-security': () => import('./domains/trust-security.f255cb62e6db.mjs'),
  governance: () => import('./domains/governance.2f9cd90868cc.mjs'),
  extensions: () => import('./domains/extensions.a50c6b629d1c.mjs'),
  autonomy: () => import('./domains/autonomy.e9ff9718cbdb.mjs'),
  labs: () => import('./domains/platform.be4abe99d717.mjs'),
  release: () => import('./domains/release.77cf0025dbf1.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.540d9b671b80.mjs'),
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
