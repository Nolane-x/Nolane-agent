const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.c8fe8fce47cf.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.1d3f54c68e16.mjs'),
  operations: () => import('./domains/operations.c4299c756f40.mjs'),
  runtime: () => import('./domains/runtime.b90fcc4dfa19.mjs'),
  'context-memory': () => import('./domains/context-memory.3548028a77f2.mjs'),
  evidence: () => import('./domains/evidence.8bc6d8edf663.mjs'),
  intelligence: () => import('./domains/intelligence.033d65b5c05a.mjs'),
  'trust-security': () => import('./domains/trust-security.88f136825807.mjs'),
  governance: () => import('./domains/governance.5d5d55be700a.mjs'),
  extensions: () => import('./domains/extensions.e2c976ae38cf.mjs'),
  autonomy: () => import('./domains/autonomy.fe6ae651273e.mjs'),
  labs: () => import('./domains/platform.d72b47a733bc.mjs'),
  release: () => import('./domains/release.c667d0a5173e.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.09df56c7551a.mjs'),
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
