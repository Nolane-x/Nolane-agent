const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.cd9cdb86e9f4.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.fcb904aed281.mjs'),
  operations: () => import('./domains/operations.2ba480542b88.mjs'),
  runtime: () => import('./domains/runtime.9ff4ddfe5018.mjs'),
  'context-memory': () => import('./domains/context-memory.8c00e01fd72c.mjs'),
  evidence: () => import('./domains/evidence.53d8441914d6.mjs'),
  intelligence: () => import('./domains/intelligence.710d169cebca.mjs'),
  'trust-security': () => import('./domains/trust-security.0f3adb9331c9.mjs'),
  governance: () => import('./domains/governance.578de236bb1a.mjs'),
  extensions: () => import('./domains/extensions.9e5285240556.mjs'),
  autonomy: () => import('./domains/autonomy.1fa01d4a6385.mjs'),
  labs: () => import('./domains/platform.2d392167c446.mjs'),
  release: () => import('./domains/release.39ee0ac0a99d.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.6817e801e291.mjs'),
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
