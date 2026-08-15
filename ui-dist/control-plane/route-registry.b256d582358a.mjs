const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.91dff7916cff.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.28523897418c.mjs'),
  operations: () => import('./domains/operations.57345d938a35.mjs'),
  runtime: () => import('./domains/runtime.58848baf394d.mjs'),
  'context-memory': () => import('./domains/context-memory.12257b95a263.mjs'),
  evidence: () => import('./domains/evidence.475048191f8c.mjs'),
  intelligence: () => import('./domains/intelligence.65df7a159ab0.mjs'),
  'trust-security': () => import('./domains/trust-security.4f11d6ef24c2.mjs'),
  governance: () => import('./domains/governance.10180fccb405.mjs'),
  extensions: () => import('./domains/extensions.dbf3a2299d2f.mjs'),
  autonomy: () => import('./domains/autonomy.6da1e49b7070.mjs'),
  labs: () => import('./domains/platform.3e6cf87acbfc.mjs'),
  release: () => import('./domains/release.26acfb96c774.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.6e4e3f7a2e32.mjs'),
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
