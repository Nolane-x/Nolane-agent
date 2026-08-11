const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.a7cd079bfa93.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.3a382e4ce16a.mjs'),
  operations: () => import('./domains/operations.406d36655de3.mjs'),
  runtime: () => import('./domains/runtime.cdbfd6c8d83a.mjs'),
  'context-memory': () => import('./domains/context-memory.59390a997161.mjs'),
  evidence: () => import('./domains/evidence.15c7bedb48dc.mjs'),
  intelligence: () => import('./domains/intelligence.f684c9f216b7.mjs'),
  'trust-security': () => import('./domains/trust-security.4801fc47fdce.mjs'),
  governance: () => import('./domains/governance.274d84cc4517.mjs'),
  extensions: () => import('./domains/extensions.4fab2218b224.mjs'),
  autonomy: () => import('./domains/autonomy.1805081912a3.mjs'),
  labs: () => import('./domains/platform.1da711cf11b5.mjs'),
  release: () => import('./domains/release.e33d7260eb30.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.12f9be32ca22.mjs'),
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
