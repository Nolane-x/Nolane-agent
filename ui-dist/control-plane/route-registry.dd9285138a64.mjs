const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.58420392dd7d.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.2b9a21e032f5.mjs'),
  operations: () => import('./domains/operations.58d76b0fb4fc.mjs'),
  runtime: () => import('./domains/runtime.cce396b5be18.mjs'),
  'context-memory': () => import('./domains/context-memory.04729f9bf553.mjs'),
  evidence: () => import('./domains/evidence.5fc3d3f903cd.mjs'),
  intelligence: () => import('./domains/intelligence.31024cd4a0d1.mjs'),
  'trust-security': () => import('./domains/trust-security.769a28f07905.mjs'),
  governance: () => import('./domains/governance.ce59caf983d2.mjs'),
  extensions: () => import('./domains/extensions.cec6c708487b.mjs'),
  autonomy: () => import('./domains/autonomy.005c8f3e51d3.mjs'),
  labs: () => import('./domains/platform.f1a670f2ff5f.mjs'),
  release: () => import('./domains/release.607becc5bed9.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.972987e3dd55.mjs'),
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
