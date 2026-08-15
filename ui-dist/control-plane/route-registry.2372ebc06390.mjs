const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.301139495082.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.efb0a513d3d5.mjs'),
  operations: () => import('./domains/operations.9d9d3066c17d.mjs'),
  runtime: () => import('./domains/runtime.12321d509980.mjs'),
  'context-memory': () => import('./domains/context-memory.b23d1e4fa701.mjs'),
  evidence: () => import('./domains/evidence.7c81f782fbfd.mjs'),
  intelligence: () => import('./domains/intelligence.b7f93d99fd33.mjs'),
  'trust-security': () => import('./domains/trust-security.1f31c79f2167.mjs'),
  governance: () => import('./domains/governance.669193f25c17.mjs'),
  extensions: () => import('./domains/extensions.960fd67ae3ff.mjs'),
  autonomy: () => import('./domains/autonomy.5c8c6dc5912e.mjs'),
  labs: () => import('./domains/platform.414a146d2d5f.mjs'),
  release: () => import('./domains/release.69c6aeba61a7.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.4b5ed6ac30d4.mjs'),
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
