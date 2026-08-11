const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.5626be5a4ccf.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.be97e7e1606e.mjs'),
  operations: () => import('./domains/operations.d5e92a135169.mjs'),
  runtime: () => import('./domains/runtime.921a317b8182.mjs'),
  'context-memory': () => import('./domains/context-memory.72f2fed2a460.mjs'),
  evidence: () => import('./domains/evidence.4be500a3aca1.mjs'),
  intelligence: () => import('./domains/intelligence.0952a3fee40e.mjs'),
  'trust-security': () => import('./domains/trust-security.64312cea7c18.mjs'),
  governance: () => import('./domains/governance.0858bbcc16ed.mjs'),
  extensions: () => import('./domains/extensions.d670a689d18f.mjs'),
  autonomy: () => import('./domains/autonomy.d2fc2dfee6dd.mjs'),
  labs: () => import('./domains/platform.16840fcb9b36.mjs'),
  release: () => import('./domains/release.8af228f5cab5.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.ccbc11f8d7e6.mjs'),
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
