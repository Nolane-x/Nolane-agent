const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.8438f5aa7b70.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.e037f3e0da86.mjs'),
  operations: () => import('./domains/operations.13bd9fa5b048.mjs'),
  runtime: () => import('./domains/runtime.36f31fc38543.mjs'),
  'context-memory': () => import('./domains/context-memory.561e261d7924.mjs'),
  evidence: () => import('./domains/evidence.9bf226d33fe8.mjs'),
  intelligence: () => import('./domains/intelligence.b789a4f02372.mjs'),
  'trust-security': () => import('./domains/trust-security.aa147726417f.mjs'),
  governance: () => import('./domains/governance.84e4fd639748.mjs'),
  extensions: () => import('./domains/extensions.45ec2479cdc9.mjs'),
  autonomy: () => import('./domains/autonomy.0dc7d6321f90.mjs'),
  labs: () => import('./domains/platform.1fbec5e45635.mjs'),
  release: () => import('./domains/release.c175b4aae378.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.410209e3b5a1.mjs'),
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
