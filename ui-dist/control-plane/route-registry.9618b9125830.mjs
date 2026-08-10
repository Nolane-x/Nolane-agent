const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.ee4affaeee88.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.17943e70e97a.mjs'),
  operations: () => import('./domains/operations.9867eea5d981.mjs'),
  runtime: () => import('./domains/runtime.e284022b065e.mjs'),
  'context-memory': () => import('./domains/context-memory.023206c4dfad.mjs'),
  evidence: () => import('./domains/evidence.39c0d2c4dfbf.mjs'),
  intelligence: () => import('./domains/intelligence.6dd953478605.mjs'),
  'trust-security': () => import('./domains/trust-security.13b2da762134.mjs'),
  governance: () => import('./domains/governance.bcc28c43def7.mjs'),
  extensions: () => import('./domains/extensions.ac43c179bb17.mjs'),
  autonomy: () => import('./domains/autonomy.5a33edca72da.mjs'),
  labs: () => import('./domains/platform.7529f8f03291.mjs'),
  release: () => import('./domains/release.2184555618e3.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.1c4b9025d937.mjs'),
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
