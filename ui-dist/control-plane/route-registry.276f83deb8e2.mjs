const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.69ca9f03ddc6.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.a4a745119e07.mjs'),
  operations: () => import('./domains/operations.eaf6bdc3551e.mjs'),
  runtime: () => import('./domains/runtime.d4f453356dd3.mjs'),
  'context-memory': () => import('./domains/context-memory.896a3c78e502.mjs'),
  evidence: () => import('./domains/evidence.84282670cae2.mjs'),
  intelligence: () => import('./domains/intelligence.30821cc610f3.mjs'),
  'trust-security': () => import('./domains/trust-security.c47c5ab0b806.mjs'),
  governance: () => import('./domains/governance.b51422a453f8.mjs'),
  extensions: () => import('./domains/extensions.a9d46bc10c32.mjs'),
  autonomy: () => import('./domains/autonomy.c61fcf508724.mjs'),
  labs: () => import('./domains/platform.328c61d7fd2d.mjs'),
  release: () => import('./domains/release.e0b7b989fbba.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.a6fc813574c6.mjs'),
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
