const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.8a28172a24c2.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.7cbfae8af067.mjs'),
  operations: () => import('./domains/operations.f05ac8a8841b.mjs'),
  runtime: () => import('./domains/runtime.c89802677e2b.mjs'),
  'context-memory': () => import('./domains/context-memory.f2fea23a9e15.mjs'),
  evidence: () => import('./domains/evidence.cd2005f76848.mjs'),
  intelligence: () => import('./domains/intelligence.2d7f147436a9.mjs'),
  'trust-security': () => import('./domains/trust-security.041d377b3a5a.mjs'),
  governance: () => import('./domains/governance.481e8d797858.mjs'),
  extensions: () => import('./domains/extensions.2ef2ae3fcdd5.mjs'),
  autonomy: () => import('./domains/autonomy.b345f0ed4d4f.mjs'),
  labs: () => import('./domains/platform.9d16239df026.mjs'),
  release: () => import('./domains/release.32325a3b541e.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.30ca509f8b32.mjs'),
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
