const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.027a024693fb.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.8eb0402754dc.mjs'),
  operations: () => import('./domains/operations.0440bdbbd3cd.mjs'),
  runtime: () => import('./domains/runtime.da6dfe85f5c8.mjs'),
  'context-memory': () => import('./domains/context-memory.c8ca2d466558.mjs'),
  evidence: () => import('./domains/evidence.c839fc165b5e.mjs'),
  intelligence: () => import('./domains/intelligence.3d5f7c5ec744.mjs'),
  'trust-security': () => import('./domains/trust-security.5729cb1043ae.mjs'),
  governance: () => import('./domains/governance.9e5e452666a3.mjs'),
  extensions: () => import('./domains/extensions.2f70e4910957.mjs'),
  autonomy: () => import('./domains/autonomy.9a60d87b2174.mjs'),
  labs: () => import('./domains/platform.8e1c01e4990f.mjs'),
  release: () => import('./domains/release.6617ab504947.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.24fc32f4ca35.mjs'),
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
