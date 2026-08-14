const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.8e4c60043075.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.c4c653ad809d.mjs'),
  operations: () => import('./domains/operations.b50afa13c45e.mjs'),
  runtime: () => import('./domains/runtime.6e04771e76c3.mjs'),
  'context-memory': () => import('./domains/context-memory.ff49b218ec65.mjs'),
  evidence: () => import('./domains/evidence.ed0fe4d8a778.mjs'),
  intelligence: () => import('./domains/intelligence.41a68117ea4d.mjs'),
  'trust-security': () => import('./domains/trust-security.a4b81f9a8217.mjs'),
  governance: () => import('./domains/governance.8213306fbaa4.mjs'),
  extensions: () => import('./domains/extensions.cf3d67210000.mjs'),
  autonomy: () => import('./domains/autonomy.1f26aee6ad55.mjs'),
  labs: () => import('./domains/platform.600b771bf9ab.mjs'),
  release: () => import('./domains/release.5c601ee6cf86.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.6fbf14fc6368.mjs'),
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
