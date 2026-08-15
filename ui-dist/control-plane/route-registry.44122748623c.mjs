const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.676fdb342659.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.855c969328aa.mjs'),
  operations: () => import('./domains/operations.d23f1a3e1054.mjs'),
  runtime: () => import('./domains/runtime.c8b7c782211c.mjs'),
  'context-memory': () => import('./domains/context-memory.4e378cb8cab0.mjs'),
  evidence: () => import('./domains/evidence.b301629f3fab.mjs'),
  intelligence: () => import('./domains/intelligence.4425dd3f5bc7.mjs'),
  'trust-security': () => import('./domains/trust-security.832886b70322.mjs'),
  governance: () => import('./domains/governance.1013dd98af04.mjs'),
  extensions: () => import('./domains/extensions.5a20e403eb7b.mjs'),
  autonomy: () => import('./domains/autonomy.4d504a3f9111.mjs'),
  labs: () => import('./domains/platform.93043d17c179.mjs'),
  release: () => import('./domains/release.2f7aa393ac1b.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.b9562e633156.mjs'),
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
