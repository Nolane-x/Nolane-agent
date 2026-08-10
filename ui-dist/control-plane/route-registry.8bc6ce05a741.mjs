const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.b69b37868c52.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.ce2009f1c6c4.mjs'),
  operations: () => import('./domains/operations.65cc52ed2a16.mjs'),
  runtime: () => import('./domains/runtime.be5c8c69ef06.mjs'),
  'context-memory': () => import('./domains/context-memory.e34180910af7.mjs'),
  evidence: () => import('./domains/evidence.42c83badbf05.mjs'),
  intelligence: () => import('./domains/intelligence.bf8a499ffe0c.mjs'),
  'trust-security': () => import('./domains/trust-security.76e4da166483.mjs'),
  governance: () => import('./domains/governance.da6697fb1f5e.mjs'),
  extensions: () => import('./domains/extensions.658c32a0ab2d.mjs'),
  autonomy: () => import('./domains/autonomy.ee20c71b32ea.mjs'),
  labs: () => import('./domains/platform.2acac698f44e.mjs'),
  release: () => import('./domains/release.8c46d87e54cd.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.aac5f914eafd.mjs'),
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
