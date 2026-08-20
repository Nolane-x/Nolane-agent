const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.91851e2d4eb9.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.80f8a07cceec.mjs'),
  operations: () => import('./domains/operations.2172c3b757f8.mjs'),
  runtime: () => import('./domains/runtime.19c8b19f81ea.mjs'),
  'context-memory': () => import('./domains/context-memory.3430d67ae339.mjs'),
  evidence: () => import('./domains/evidence.5840f0cb228a.mjs'),
  intelligence: () => import('./domains/intelligence.08c1fb73b4f2.mjs'),
  'trust-security': () => import('./domains/trust-security.ab94cc9be174.mjs'),
  governance: () => import('./domains/governance.cb77dd5d3cad.mjs'),
  extensions: () => import('./domains/extensions.ed7e78d8850d.mjs'),
  autonomy: () => import('./domains/autonomy.d34b207d93db.mjs'),
  labs: () => import('./domains/platform.c080d423c492.mjs'),
  release: () => import('./domains/release.753d8f2c4f1d.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.4b598caf2386.mjs'),
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
