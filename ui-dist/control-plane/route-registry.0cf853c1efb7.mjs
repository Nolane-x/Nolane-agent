const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.bed034e5f99b.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.4250435e6c85.mjs'),
  operations: () => import('./domains/operations.121e1c973589.mjs'),
  runtime: () => import('./domains/runtime.70b3c0d839ae.mjs'),
  'context-memory': () => import('./domains/context-memory.23009e506d2f.mjs'),
  evidence: () => import('./domains/evidence.3579343234dd.mjs'),
  intelligence: () => import('./domains/intelligence.11170fa69839.mjs'),
  'trust-security': () => import('./domains/trust-security.fe2e766e9075.mjs'),
  governance: () => import('./domains/governance.1c9ad97debaf.mjs'),
  extensions: () => import('./domains/extensions.3f419388ba44.mjs'),
  autonomy: () => import('./domains/autonomy.d11812c1ff96.mjs'),
  labs: () => import('./domains/platform.933a675244c5.mjs'),
  release: () => import('./domains/release.55aa89c877a8.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.df38e2ea9c79.mjs'),
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
