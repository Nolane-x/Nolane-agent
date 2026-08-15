const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.8e108f49a6a6.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.d7cf6fedc648.mjs'),
  operations: () => import('./domains/operations.465790c53d32.mjs'),
  runtime: () => import('./domains/runtime.7b0da9826e9b.mjs'),
  'context-memory': () => import('./domains/context-memory.4d05ac52a7b6.mjs'),
  evidence: () => import('./domains/evidence.0e940a945300.mjs'),
  intelligence: () => import('./domains/intelligence.5c453986de21.mjs'),
  'trust-security': () => import('./domains/trust-security.af3db3bf9924.mjs'),
  governance: () => import('./domains/governance.265542947512.mjs'),
  extensions: () => import('./domains/extensions.d0b89ecf5d44.mjs'),
  autonomy: () => import('./domains/autonomy.09967fc05c44.mjs'),
  labs: () => import('./domains/platform.885ff9e85d23.mjs'),
  release: () => import('./domains/release.fbb735a89340.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.74c6c81211be.mjs'),
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
