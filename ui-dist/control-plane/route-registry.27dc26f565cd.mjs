const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.470a778476fd.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.27dcbe2e8280.mjs'),
  operations: () => import('./domains/operations.53f428d2bc08.mjs'),
  runtime: () => import('./domains/runtime.6b9a046d7ea2.mjs'),
  'context-memory': () => import('./domains/context-memory.5961824ce16b.mjs'),
  evidence: () => import('./domains/evidence.8748113317fb.mjs'),
  intelligence: () => import('./domains/intelligence.fb1ad310ec5f.mjs'),
  'trust-security': () => import('./domains/trust-security.dc19e4b1581f.mjs'),
  governance: () => import('./domains/governance.c1edbf2e5c19.mjs'),
  extensions: () => import('./domains/extensions.c50fe3c29d71.mjs'),
  autonomy: () => import('./domains/autonomy.b8086bb262be.mjs'),
  labs: () => import('./domains/platform.2d2c5da2643f.mjs'),
  release: () => import('./domains/release.8d50c8e782f5.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.27b6c6635f03.mjs'),
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
