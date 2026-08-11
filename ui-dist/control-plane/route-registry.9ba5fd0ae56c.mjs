const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.982cd2087173.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.7c05745efdad.mjs'),
  operations: () => import('./domains/operations.ec2fe2548615.mjs'),
  runtime: () => import('./domains/runtime.7a9c2b2c9b50.mjs'),
  'context-memory': () => import('./domains/context-memory.430b0b828ff7.mjs'),
  evidence: () => import('./domains/evidence.344994e62efa.mjs'),
  intelligence: () => import('./domains/intelligence.b8dbab2b1f6c.mjs'),
  'trust-security': () => import('./domains/trust-security.dfede1a996f1.mjs'),
  governance: () => import('./domains/governance.1a6ce2a22882.mjs'),
  extensions: () => import('./domains/extensions.cf756a3560bd.mjs'),
  autonomy: () => import('./domains/autonomy.e438b92aade3.mjs'),
  labs: () => import('./domains/platform.97e7e74d9ea8.mjs'),
  release: () => import('./domains/release.3375ff893534.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.5bc251bd45a3.mjs'),
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
