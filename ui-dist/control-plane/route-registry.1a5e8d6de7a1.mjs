const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.f0f89d3466b8.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.eab737fec65b.mjs'),
  operations: () => import('./domains/operations.69de673b3823.mjs'),
  runtime: () => import('./domains/runtime.8f652e7c20b6.mjs'),
  'context-memory': () => import('./domains/context-memory.53bea95b9dd0.mjs'),
  evidence: () => import('./domains/evidence.edb53a4af6ef.mjs'),
  intelligence: () => import('./domains/intelligence.8b9725cb9ff8.mjs'),
  'trust-security': () => import('./domains/trust-security.7b87387f1439.mjs'),
  governance: () => import('./domains/governance.5e1e7e0bb4cb.mjs'),
  extensions: () => import('./domains/extensions.d6d554bc50c2.mjs'),
  autonomy: () => import('./domains/autonomy.ae6adb4d02d1.mjs'),
  labs: () => import('./domains/platform.f6f56f136784.mjs'),
  release: () => import('./domains/release.1552b44e67c0.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.97180dd0691b.mjs'),
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
