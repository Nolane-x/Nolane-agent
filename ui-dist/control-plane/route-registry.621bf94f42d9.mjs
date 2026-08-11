const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.96ad68e59cf7.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.b54b7219575e.mjs'),
  operations: () => import('./domains/operations.73471573dc82.mjs'),
  runtime: () => import('./domains/runtime.e7ec284d9eab.mjs'),
  'context-memory': () => import('./domains/context-memory.fff544717ad6.mjs'),
  evidence: () => import('./domains/evidence.6309b116c65b.mjs'),
  intelligence: () => import('./domains/intelligence.1305f4e3c970.mjs'),
  'trust-security': () => import('./domains/trust-security.10bf0ea7219f.mjs'),
  governance: () => import('./domains/governance.2cde363ff359.mjs'),
  extensions: () => import('./domains/extensions.526354ce6c56.mjs'),
  autonomy: () => import('./domains/autonomy.2f75eb551ccc.mjs'),
  labs: () => import('./domains/platform.b298ffa3dccb.mjs'),
  release: () => import('./domains/release.945610d79baa.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.1141d7ded9be.mjs'),
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
