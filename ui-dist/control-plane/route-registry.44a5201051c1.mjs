const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.a31382e6122f.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.fa998f18496a.mjs'),
  operations: () => import('./domains/operations.fa0e3c2171b0.mjs'),
  runtime: () => import('./domains/runtime.42b721e89c33.mjs'),
  'context-memory': () => import('./domains/context-memory.55a50a251818.mjs'),
  evidence: () => import('./domains/evidence.225cc8c5ae2d.mjs'),
  intelligence: () => import('./domains/intelligence.eac5c286c2eb.mjs'),
  'trust-security': () => import('./domains/trust-security.5937ab06bd1a.mjs'),
  governance: () => import('./domains/governance.69e64601a1aa.mjs'),
  extensions: () => import('./domains/extensions.f2ae0bb82e34.mjs'),
  autonomy: () => import('./domains/autonomy.31df1a973051.mjs'),
  labs: () => import('./domains/platform.b2093b4b6132.mjs'),
  release: () => import('./domains/release.a869c9273900.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.6db0168ec2e6.mjs'),
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
