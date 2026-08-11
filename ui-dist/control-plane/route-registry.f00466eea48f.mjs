const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.2c37c5a72c21.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.010b640024af.mjs'),
  operations: () => import('./domains/operations.6e8c5f562c8c.mjs'),
  runtime: () => import('./domains/runtime.47df4291cff3.mjs'),
  'context-memory': () => import('./domains/context-memory.0e74560f5ad3.mjs'),
  evidence: () => import('./domains/evidence.c67ef6819c35.mjs'),
  intelligence: () => import('./domains/intelligence.8a395c64efde.mjs'),
  'trust-security': () => import('./domains/trust-security.45a2ab9f047b.mjs'),
  governance: () => import('./domains/governance.6227ce4b8179.mjs'),
  extensions: () => import('./domains/extensions.e86ef88e8bbc.mjs'),
  autonomy: () => import('./domains/autonomy.7e694d263fc8.mjs'),
  labs: () => import('./domains/platform.5b9a275d61a9.mjs'),
  release: () => import('./domains/release.a4ab2f1cdcec.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.1ea1f5c2397b.mjs'),
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
