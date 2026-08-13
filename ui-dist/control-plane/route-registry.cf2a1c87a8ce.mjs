const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.3d0be2c61e09.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.d7337faf8b78.mjs'),
  operations: () => import('./domains/operations.624082df2a80.mjs'),
  runtime: () => import('./domains/runtime.7abbb59d5661.mjs'),
  'context-memory': () => import('./domains/context-memory.4995dc5ba385.mjs'),
  evidence: () => import('./domains/evidence.7e56f1a4aa4c.mjs'),
  intelligence: () => import('./domains/intelligence.d4e465d599a6.mjs'),
  'trust-security': () => import('./domains/trust-security.7747c0ebeb4e.mjs'),
  governance: () => import('./domains/governance.322606d6c38d.mjs'),
  extensions: () => import('./domains/extensions.61387a7e1f3e.mjs'),
  autonomy: () => import('./domains/autonomy.9dac7a19ed90.mjs'),
  labs: () => import('./domains/platform.3a28e97a1c59.mjs'),
  release: () => import('./domains/release.28f1ea1d3d05.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.a96be93a94ab.mjs'),
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
