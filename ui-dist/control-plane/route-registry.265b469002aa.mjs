const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.9de76ac7b437.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.67c994483caa.mjs'),
  operations: () => import('./domains/operations.69f3c462532b.mjs'),
  runtime: () => import('./domains/runtime.b59651de1649.mjs'),
  'context-memory': () => import('./domains/context-memory.689252106bdb.mjs'),
  evidence: () => import('./domains/evidence.1d5158e124d2.mjs'),
  intelligence: () => import('./domains/intelligence.12f943c6a6ec.mjs'),
  'trust-security': () => import('./domains/trust-security.6618e4c051b3.mjs'),
  governance: () => import('./domains/governance.604e19f4a284.mjs'),
  extensions: () => import('./domains/extensions.1b7b80729642.mjs'),
  autonomy: () => import('./domains/autonomy.ac2995a327a6.mjs'),
  labs: () => import('./domains/platform.9e4e4214af52.mjs'),
  release: () => import('./domains/release.4f76a48c966a.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.2a620d733d1a.mjs'),
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
