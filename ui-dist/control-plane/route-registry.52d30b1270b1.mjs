const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.88e8174ee93d.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.597298af3a2b.mjs'),
  operations: () => import('./domains/operations.d8674cbbcea9.mjs'),
  runtime: () => import('./domains/runtime.c12fd41f25e1.mjs'),
  'context-memory': () => import('./domains/context-memory.a4d5a51cf753.mjs'),
  evidence: () => import('./domains/evidence.748a6aac7df8.mjs'),
  intelligence: () => import('./domains/intelligence.b9b431bd3973.mjs'),
  'trust-security': () => import('./domains/trust-security.d1d8ff372c7c.mjs'),
  governance: () => import('./domains/governance.a1bc6ed9fc84.mjs'),
  extensions: () => import('./domains/extensions.c8f04933eba9.mjs'),
  autonomy: () => import('./domains/autonomy.220c8675fbf5.mjs'),
  labs: () => import('./domains/platform.15b6bd36c13b.mjs'),
  release: () => import('./domains/release.8819ef3c6f37.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.02b7f4095e1a.mjs'),
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
