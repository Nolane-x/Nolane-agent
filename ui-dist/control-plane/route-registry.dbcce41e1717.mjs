const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.748f50ce246b.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.420fc8a83438.mjs'),
  operations: () => import('./domains/operations.57e7a36490a6.mjs'),
  runtime: () => import('./domains/runtime.c3f87fd0f32c.mjs'),
  'context-memory': () => import('./domains/context-memory.8606b7ae863f.mjs'),
  evidence: () => import('./domains/evidence.6cd61f58e259.mjs'),
  intelligence: () => import('./domains/intelligence.519a4c5e0b5e.mjs'),
  'trust-security': () => import('./domains/trust-security.a91fc56ebecc.mjs'),
  governance: () => import('./domains/governance.bf0af14d3781.mjs'),
  extensions: () => import('./domains/extensions.abf0cf51d877.mjs'),
  autonomy: () => import('./domains/autonomy.e42f690986e8.mjs'),
  labs: () => import('./domains/platform.b6c7ea9149df.mjs'),
  release: () => import('./domains/release.de9539b8b9f6.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.743cbef7a997.mjs'),
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
