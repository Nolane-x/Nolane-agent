const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.2281fd3ddf81.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.75432dfe11bf.mjs'),
  operations: () => import('./domains/operations.27456c70e94d.mjs'),
  runtime: () => import('./domains/runtime.1d3a66b945f4.mjs'),
  'context-memory': () => import('./domains/context-memory.72fe9d0bdbe0.mjs'),
  evidence: () => import('./domains/evidence.c47e91ae9ddf.mjs'),
  intelligence: () => import('./domains/intelligence.a7c6895c7c99.mjs'),
  'trust-security': () => import('./domains/trust-security.ed6191db843b.mjs'),
  governance: () => import('./domains/governance.9041c57c3d48.mjs'),
  extensions: () => import('./domains/extensions.9a853678fa9d.mjs'),
  autonomy: () => import('./domains/autonomy.e4ad0ff2ed79.mjs'),
  labs: () => import('./domains/platform.30e3da92c211.mjs'),
  release: () => import('./domains/release.76dff3b76257.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.6cef7c5d1d1d.mjs'),
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
