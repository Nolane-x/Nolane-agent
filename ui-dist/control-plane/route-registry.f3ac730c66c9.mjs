const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.22cacb637051.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.533326679159.mjs'),
  operations: () => import('./domains/operations.8cd3e1e72ac0.mjs'),
  runtime: () => import('./domains/runtime.c4690b162d4b.mjs'),
  'context-memory': () => import('./domains/context-memory.29d1074bcf43.mjs'),
  evidence: () => import('./domains/evidence.278eac1c1b8d.mjs'),
  intelligence: () => import('./domains/intelligence.6fac9f1ede8a.mjs'),
  'trust-security': () => import('./domains/trust-security.dd9cd02ec012.mjs'),
  governance: () => import('./domains/governance.22678b39e91e.mjs'),
  extensions: () => import('./domains/extensions.d2a6003e46f2.mjs'),
  autonomy: () => import('./domains/autonomy.52fdfdb5d47c.mjs'),
  labs: () => import('./domains/platform.5a6e5a1cb87f.mjs'),
  release: () => import('./domains/release.85d18654362b.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.d7a0da92665f.mjs'),
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
