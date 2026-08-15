const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.35a15f48f17e.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.d8a95d2a5c67.mjs'),
  operations: () => import('./domains/operations.0590d77099e2.mjs'),
  runtime: () => import('./domains/runtime.9bf010c49069.mjs'),
  'context-memory': () => import('./domains/context-memory.be737f8a9284.mjs'),
  evidence: () => import('./domains/evidence.e33291bb0962.mjs'),
  intelligence: () => import('./domains/intelligence.3aab1b7c0e34.mjs'),
  'trust-security': () => import('./domains/trust-security.582b4de9bcb9.mjs'),
  governance: () => import('./domains/governance.4e0460acb2eb.mjs'),
  extensions: () => import('./domains/extensions.05df562bbe45.mjs'),
  autonomy: () => import('./domains/autonomy.5e8aaf1cc4ab.mjs'),
  labs: () => import('./domains/platform.2c5c4079c849.mjs'),
  release: () => import('./domains/release.388f9124a7b0.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.29ce06fdb1a2.mjs'),
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
