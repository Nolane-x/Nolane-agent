const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.22d22ba1c6fa.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.becbef885f28.mjs'),
  operations: () => import('./domains/operations.5561f2d42d8e.mjs'),
  runtime: () => import('./domains/runtime.7b21e55ea8ef.mjs'),
  'context-memory': () => import('./domains/context-memory.9fbf7b116076.mjs'),
  evidence: () => import('./domains/evidence.40eb28d040ab.mjs'),
  intelligence: () => import('./domains/intelligence.07552bef1b1a.mjs'),
  'trust-security': () => import('./domains/trust-security.f02c90b93cff.mjs'),
  governance: () => import('./domains/governance.b67d53069737.mjs'),
  extensions: () => import('./domains/extensions.f000f05a733a.mjs'),
  autonomy: () => import('./domains/autonomy.31d5af69b272.mjs'),
  labs: () => import('./domains/platform.cdc6b660d2e3.mjs'),
  release: () => import('./domains/release.f21e899f6e2f.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.3f3b9d863401.mjs'),
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
