const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.0f782b9293e9.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.7389f7945980.mjs'),
  operations: () => import('./domains/operations.174165bfdfba.mjs'),
  runtime: () => import('./domains/runtime.7656dcf200a3.mjs'),
  'context-memory': () => import('./domains/context-memory.a621365533c9.mjs'),
  evidence: () => import('./domains/evidence.6df63f127a2c.mjs'),
  intelligence: () => import('./domains/intelligence.41d1df28610e.mjs'),
  'trust-security': () => import('./domains/trust-security.d627aa807f26.mjs'),
  governance: () => import('./domains/governance.7a2e4f2a64d2.mjs'),
  extensions: () => import('./domains/extensions.5ba141e7ceaa.mjs'),
  autonomy: () => import('./domains/autonomy.eef22bedccb0.mjs'),
  labs: () => import('./domains/platform.508291857742.mjs'),
  release: () => import('./domains/release.f455c2f81c83.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.689926dadd5b.mjs'),
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
