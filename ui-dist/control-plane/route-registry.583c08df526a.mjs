const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.8ddbb2926d84.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.11752d58938e.mjs'),
  operations: () => import('./domains/operations.3c81a283dae0.mjs'),
  runtime: () => import('./domains/runtime.85f5d4981e91.mjs'),
  'context-memory': () => import('./domains/context-memory.bf65065ba011.mjs'),
  evidence: () => import('./domains/evidence.3ed0fc4df93c.mjs'),
  intelligence: () => import('./domains/intelligence.01f2482bcd41.mjs'),
  'trust-security': () => import('./domains/trust-security.421395d8e149.mjs'),
  governance: () => import('./domains/governance.2975fcb1f1fd.mjs'),
  extensions: () => import('./domains/extensions.4b5c07553581.mjs'),
  autonomy: () => import('./domains/autonomy.2525451061b9.mjs'),
  labs: () => import('./domains/platform.8192d9936478.mjs'),
  release: () => import('./domains/release.afdd4c5a77f5.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.da1a599a52aa.mjs'),
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
