const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.5379d86cfc2a.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.afd989f11254.mjs'),
  operations: () => import('./domains/operations.ac3fc9b66aab.mjs'),
  runtime: () => import('./domains/runtime.11f896c023c0.mjs'),
  'context-memory': () => import('./domains/context-memory.cdaf14ebe0cd.mjs'),
  evidence: () => import('./domains/evidence.46f49a259d77.mjs'),
  intelligence: () => import('./domains/intelligence.ff7b46327834.mjs'),
  'trust-security': () => import('./domains/trust-security.feb02f1e5dc0.mjs'),
  governance: () => import('./domains/governance.795e5a3b8356.mjs'),
  extensions: () => import('./domains/extensions.e4aefd6a569b.mjs'),
  autonomy: () => import('./domains/autonomy.ec3290a5b36b.mjs'),
  labs: () => import('./domains/platform.5314e6eabfc6.mjs'),
  release: () => import('./domains/release.d1070290d11b.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.aad1505c1564.mjs'),
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
