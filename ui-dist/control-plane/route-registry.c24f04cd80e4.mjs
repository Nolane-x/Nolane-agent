const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.4c763b051ea2.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.67a1849bd85b.mjs'),
  operations: () => import('./domains/operations.694576b9a777.mjs'),
  runtime: () => import('./domains/runtime.f2156bb230e7.mjs'),
  'context-memory': () => import('./domains/context-memory.3950dca09f4f.mjs'),
  evidence: () => import('./domains/evidence.18aeb97b7367.mjs'),
  intelligence: () => import('./domains/intelligence.0ccb42907d9e.mjs'),
  'trust-security': () => import('./domains/trust-security.898875f81a4c.mjs'),
  governance: () => import('./domains/governance.7f3075c062af.mjs'),
  extensions: () => import('./domains/extensions.d0be653e720c.mjs'),
  autonomy: () => import('./domains/autonomy.dcabaf9782f2.mjs'),
  labs: () => import('./domains/platform.5796404af003.mjs'),
  release: () => import('./domains/release.469ca4247303.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.7aa50c43c496.mjs'),
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
