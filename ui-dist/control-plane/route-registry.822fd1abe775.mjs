const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.af8ea6072be0.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.0c470f1136e5.mjs'),
  operations: () => import('./domains/operations.6120f23850c5.mjs'),
  runtime: () => import('./domains/runtime.e5ef936146f7.mjs'),
  'context-memory': () => import('./domains/context-memory.0d75fd329121.mjs'),
  evidence: () => import('./domains/evidence.3c5abfd25746.mjs'),
  intelligence: () => import('./domains/intelligence.1a86d4756956.mjs'),
  'trust-security': () => import('./domains/trust-security.9c77a66084c9.mjs'),
  governance: () => import('./domains/governance.47e6061a8ca4.mjs'),
  extensions: () => import('./domains/extensions.2f2c1712545c.mjs'),
  autonomy: () => import('./domains/autonomy.5e81047c185b.mjs'),
  labs: () => import('./domains/platform.1b32c42a7f20.mjs'),
  release: () => import('./domains/release.2bfaaa5b9831.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.82279f318c21.mjs'),
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
