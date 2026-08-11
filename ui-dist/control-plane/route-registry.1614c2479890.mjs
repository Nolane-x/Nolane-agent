const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.266f2a71f603.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.b665226984cf.mjs'),
  operations: () => import('./domains/operations.3ba550c83518.mjs'),
  runtime: () => import('./domains/runtime.e807e622891b.mjs'),
  'context-memory': () => import('./domains/context-memory.a56450c4ea94.mjs'),
  evidence: () => import('./domains/evidence.e3ef5e268905.mjs'),
  intelligence: () => import('./domains/intelligence.7ec61d7e38ce.mjs'),
  'trust-security': () => import('./domains/trust-security.d63edd8b1225.mjs'),
  governance: () => import('./domains/governance.58015e7c096e.mjs'),
  extensions: () => import('./domains/extensions.ce58d9b0fe6a.mjs'),
  autonomy: () => import('./domains/autonomy.12e4aacd6432.mjs'),
  labs: () => import('./domains/platform.8277e1d9216f.mjs'),
  release: () => import('./domains/release.cb52830de342.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.c75fc7ca1dba.mjs'),
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
