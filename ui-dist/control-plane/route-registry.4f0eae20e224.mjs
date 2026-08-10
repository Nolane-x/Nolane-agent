const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.af7726e50242.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.662f5183c722.mjs'),
  operations: () => import('./domains/operations.7e758f75be5b.mjs'),
  runtime: () => import('./domains/runtime.f95b2239070a.mjs'),
  'context-memory': () => import('./domains/context-memory.1c5088325bf5.mjs'),
  evidence: () => import('./domains/evidence.276d5b62ffba.mjs'),
  intelligence: () => import('./domains/intelligence.1fb972f7861d.mjs'),
  'trust-security': () => import('./domains/trust-security.ee3bb9a1b0e4.mjs'),
  governance: () => import('./domains/governance.0721568b572b.mjs'),
  extensions: () => import('./domains/extensions.4948b5cb47c8.mjs'),
  autonomy: () => import('./domains/autonomy.b7e6e06b39e0.mjs'),
  labs: () => import('./domains/platform.05dc17df3aea.mjs'),
  release: () => import('./domains/release.37b177cdb215.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.cb0b44853fe2.mjs'),
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
