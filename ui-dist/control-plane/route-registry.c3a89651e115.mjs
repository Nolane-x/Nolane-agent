const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.6d81d0a6148d.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.9ee8e0c3691a.mjs'),
  operations: () => import('./domains/operations.202b0fb0b181.mjs'),
  runtime: () => import('./domains/runtime.e783b736db74.mjs'),
  'context-memory': () => import('./domains/context-memory.a9b0c9c8d8be.mjs'),
  evidence: () => import('./domains/evidence.cca89a0b2dc7.mjs'),
  intelligence: () => import('./domains/intelligence.be220ce08ac6.mjs'),
  'trust-security': () => import('./domains/trust-security.d4ac42d72b4a.mjs'),
  governance: () => import('./domains/governance.1fd6ac48df62.mjs'),
  extensions: () => import('./domains/extensions.a0ce457c44b6.mjs'),
  autonomy: () => import('./domains/autonomy.9ffd8e55a072.mjs'),
  labs: () => import('./domains/platform.45f2b54c8533.mjs'),
  release: () => import('./domains/release.0bd767b5b38f.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.ebf33c903dff.mjs'),
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
