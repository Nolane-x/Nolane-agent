const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.875f0cea1c55.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.8740fdf5c6f1.mjs'),
  operations: () => import('./domains/operations.664f072f8b17.mjs'),
  runtime: () => import('./domains/runtime.a546ca8fdc46.mjs'),
  'context-memory': () => import('./domains/context-memory.341e23daa385.mjs'),
  evidence: () => import('./domains/evidence.7d66bc0021de.mjs'),
  intelligence: () => import('./domains/intelligence.92c4943a4a9f.mjs'),
  'trust-security': () => import('./domains/trust-security.14242440fed4.mjs'),
  governance: () => import('./domains/governance.fd239c82c28b.mjs'),
  extensions: () => import('./domains/extensions.cf13a1cfbd49.mjs'),
  autonomy: () => import('./domains/autonomy.2b2309bee443.mjs'),
  labs: () => import('./domains/platform.b9553d1e6440.mjs'),
  release: () => import('./domains/release.be9b57b93824.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.d458e680e318.mjs'),
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
