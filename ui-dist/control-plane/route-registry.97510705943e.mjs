const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.2cc89754be44.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.e7505b49ebcd.mjs'),
  operations: () => import('./domains/operations.141fe5858d4d.mjs'),
  runtime: () => import('./domains/runtime.a2f4dabfc702.mjs'),
  'context-memory': () => import('./domains/context-memory.95107e7f08ec.mjs'),
  evidence: () => import('./domains/evidence.3b92bbe42fa0.mjs'),
  intelligence: () => import('./domains/intelligence.b826d78652f9.mjs'),
  'trust-security': () => import('./domains/trust-security.bcb93328984a.mjs'),
  governance: () => import('./domains/governance.e803eb038c35.mjs'),
  extensions: () => import('./domains/extensions.c2badec55e25.mjs'),
  autonomy: () => import('./domains/autonomy.52e1af0efe83.mjs'),
  labs: () => import('./domains/platform.acad729b160b.mjs'),
  release: () => import('./domains/release.e233e0d34ab7.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.bfc7042fc935.mjs'),
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
