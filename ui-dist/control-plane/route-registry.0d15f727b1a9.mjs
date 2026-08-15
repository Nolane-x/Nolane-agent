const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.8ce0f4206873.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.e054a17aad51.mjs'),
  operations: () => import('./domains/operations.fde942c1c3a0.mjs'),
  runtime: () => import('./domains/runtime.ab577958b482.mjs'),
  'context-memory': () => import('./domains/context-memory.b859eefa95d3.mjs'),
  evidence: () => import('./domains/evidence.5e13b682949b.mjs'),
  intelligence: () => import('./domains/intelligence.627a6c6d3163.mjs'),
  'trust-security': () => import('./domains/trust-security.f5f8ad69f1b8.mjs'),
  governance: () => import('./domains/governance.664d563e387c.mjs'),
  extensions: () => import('./domains/extensions.cd77e0326a74.mjs'),
  autonomy: () => import('./domains/autonomy.92ed1a0419d8.mjs'),
  labs: () => import('./domains/platform.eb912f2d0582.mjs'),
  release: () => import('./domains/release.ee19dfd798a4.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.f47ebed41e97.mjs'),
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
