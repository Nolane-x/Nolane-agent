const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.ce5549fe47ac.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.89699dba4a1d.mjs'),
  operations: () => import('./domains/operations.1bfd6d25c5b6.mjs'),
  runtime: () => import('./domains/runtime.29719b6f76dc.mjs'),
  'context-memory': () => import('./domains/context-memory.6eb221a44229.mjs'),
  evidence: () => import('./domains/evidence.cf634a7529ba.mjs'),
  intelligence: () => import('./domains/intelligence.2408bcb95d12.mjs'),
  'trust-security': () => import('./domains/trust-security.a21e76c49363.mjs'),
  governance: () => import('./domains/governance.a798f72c3567.mjs'),
  extensions: () => import('./domains/extensions.360168539335.mjs'),
  autonomy: () => import('./domains/autonomy.f5bb52412853.mjs'),
  labs: () => import('./domains/platform.adb12ccc2780.mjs'),
  release: () => import('./domains/release.56b694c11fb2.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.8917bede9688.mjs'),
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
