const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.142adb4ccc4d.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.587f86f0707d.mjs'),
  operations: () => import('./domains/operations.6aa9268eaeb2.mjs'),
  runtime: () => import('./domains/runtime.17d3856c9d66.mjs'),
  'context-memory': () => import('./domains/context-memory.35e80c8f9d52.mjs'),
  evidence: () => import('./domains/evidence.aef9f18beee6.mjs'),
  intelligence: () => import('./domains/intelligence.5fb87535e17c.mjs'),
  'trust-security': () => import('./domains/trust-security.b7275e8e7ee6.mjs'),
  governance: () => import('./domains/governance.3b97f31d5c60.mjs'),
  extensions: () => import('./domains/extensions.29c1e4ace3e8.mjs'),
  autonomy: () => import('./domains/autonomy.f4b8d69338f8.mjs'),
  labs: () => import('./domains/platform.f4842fbaa690.mjs'),
  release: () => import('./domains/release.a99d1573c7e0.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.2cbe57072113.mjs'),
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
