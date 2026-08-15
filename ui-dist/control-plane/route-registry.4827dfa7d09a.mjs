const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.c9f113c6b266.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.acc6ee461950.mjs'),
  operations: () => import('./domains/operations.1b9eb977ab78.mjs'),
  runtime: () => import('./domains/runtime.a9c8c0cea90c.mjs'),
  'context-memory': () => import('./domains/context-memory.48e91d4e85ea.mjs'),
  evidence: () => import('./domains/evidence.585bda969782.mjs'),
  intelligence: () => import('./domains/intelligence.3111b4a1c002.mjs'),
  'trust-security': () => import('./domains/trust-security.453f3c8a50b5.mjs'),
  governance: () => import('./domains/governance.60ba1b91c69c.mjs'),
  extensions: () => import('./domains/extensions.5b57f804b231.mjs'),
  autonomy: () => import('./domains/autonomy.b3a09a384237.mjs'),
  labs: () => import('./domains/platform.00d0597b531d.mjs'),
  release: () => import('./domains/release.e78f73bb80e1.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.5e1baa2d505f.mjs'),
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
