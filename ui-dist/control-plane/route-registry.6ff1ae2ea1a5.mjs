const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.818a3b9dcf00.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.e6531a96114c.mjs'),
  operations: () => import('./domains/operations.d4f006ba3dc1.mjs'),
  runtime: () => import('./domains/runtime.0e7360d3f08d.mjs'),
  'context-memory': () => import('./domains/context-memory.2b66b4e14e36.mjs'),
  evidence: () => import('./domains/evidence.211949d4f5b9.mjs'),
  intelligence: () => import('./domains/intelligence.de1e48b29ee7.mjs'),
  'trust-security': () => import('./domains/trust-security.9d54b43b2472.mjs'),
  governance: () => import('./domains/governance.9361e42c3a31.mjs'),
  extensions: () => import('./domains/extensions.a69e17e68dbb.mjs'),
  autonomy: () => import('./domains/autonomy.5dd7df09a14a.mjs'),
  labs: () => import('./domains/platform.b201e0b14c3a.mjs'),
  release: () => import('./domains/release.e9d1a51fed95.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.3a2d537119bb.mjs'),
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
