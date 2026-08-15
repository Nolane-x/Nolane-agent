const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.f98937959dfd.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.3a1c7979f2f2.mjs'),
  operations: () => import('./domains/operations.35b8b94e2feb.mjs'),
  runtime: () => import('./domains/runtime.abf251ab0cf5.mjs'),
  'context-memory': () => import('./domains/context-memory.460c9fc9e5ae.mjs'),
  evidence: () => import('./domains/evidence.875ad6745169.mjs'),
  intelligence: () => import('./domains/intelligence.9084029b5719.mjs'),
  'trust-security': () => import('./domains/trust-security.c1ebc5970160.mjs'),
  governance: () => import('./domains/governance.34cf3d212c18.mjs'),
  extensions: () => import('./domains/extensions.733127905d37.mjs'),
  autonomy: () => import('./domains/autonomy.9c4311e49cc9.mjs'),
  labs: () => import('./domains/platform.f391746062bc.mjs'),
  release: () => import('./domains/release.d24b309a40fb.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.890041dcaaeb.mjs'),
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
