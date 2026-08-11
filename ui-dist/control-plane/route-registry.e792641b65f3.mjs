const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.3cd2d486907e.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.4c4ddb14a81f.mjs'),
  operations: () => import('./domains/operations.0edb2f930c24.mjs'),
  runtime: () => import('./domains/runtime.b3e986994d7b.mjs'),
  'context-memory': () => import('./domains/context-memory.b32c54ded87c.mjs'),
  evidence: () => import('./domains/evidence.21d94cc34f89.mjs'),
  intelligence: () => import('./domains/intelligence.687b6e6288e8.mjs'),
  'trust-security': () => import('./domains/trust-security.f3b0ead834ce.mjs'),
  governance: () => import('./domains/governance.be935219379d.mjs'),
  extensions: () => import('./domains/extensions.b4a903f8ed6a.mjs'),
  autonomy: () => import('./domains/autonomy.7c2cdbe212a4.mjs'),
  labs: () => import('./domains/platform.fcd7fb3d55ae.mjs'),
  release: () => import('./domains/release.6f764d0723e0.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.7d40ffcc9225.mjs'),
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
