const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.f8ed86f95888.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.22a9cb9ef4d7.mjs'),
  operations: () => import('./domains/operations.4b94aab9b4a9.mjs'),
  runtime: () => import('./domains/runtime.d92cdb536fe8.mjs'),
  'context-memory': () => import('./domains/context-memory.9c663d1c6567.mjs'),
  evidence: () => import('./domains/evidence.a2dd8253ef96.mjs'),
  intelligence: () => import('./domains/intelligence.7bd63e88f528.mjs'),
  'trust-security': () => import('./domains/trust-security.ed0b014396a6.mjs'),
  governance: () => import('./domains/governance.e71cf92504c1.mjs'),
  extensions: () => import('./domains/extensions.de62496aec17.mjs'),
  autonomy: () => import('./domains/autonomy.4537f1cac504.mjs'),
  labs: () => import('./domains/platform.060cde4ef7e7.mjs'),
  release: () => import('./domains/release.13e6fba2a976.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.84aa9b067099.mjs'),
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
