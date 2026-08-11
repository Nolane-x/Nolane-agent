const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.29f51075a770.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.f5dd929262d5.mjs'),
  operations: () => import('./domains/operations.fff4c80ece6f.mjs'),
  runtime: () => import('./domains/runtime.a5c1feb91d60.mjs'),
  'context-memory': () => import('./domains/context-memory.01ab0875ed3e.mjs'),
  evidence: () => import('./domains/evidence.b3ac803323ea.mjs'),
  intelligence: () => import('./domains/intelligence.1c95cc0a05cb.mjs'),
  'trust-security': () => import('./domains/trust-security.52bce60241fa.mjs'),
  governance: () => import('./domains/governance.1cb00f54fca3.mjs'),
  extensions: () => import('./domains/extensions.bf95fedb5225.mjs'),
  autonomy: () => import('./domains/autonomy.e168d1a7e172.mjs'),
  labs: () => import('./domains/platform.304b91ea64f7.mjs'),
  release: () => import('./domains/release.ab2f14564f5d.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.a6049e592c92.mjs'),
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
