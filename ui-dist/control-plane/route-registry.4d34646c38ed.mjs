const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.2cc18b915bf9.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.e7adc514e99c.mjs'),
  operations: () => import('./domains/operations.2d528f9a4de7.mjs'),
  runtime: () => import('./domains/runtime.4ca1de5b3834.mjs'),
  'context-memory': () => import('./domains/context-memory.805c737b690e.mjs'),
  evidence: () => import('./domains/evidence.951b48fbab17.mjs'),
  intelligence: () => import('./domains/intelligence.331dfe080fbc.mjs'),
  'trust-security': () => import('./domains/trust-security.f5dc32ed24f2.mjs'),
  governance: () => import('./domains/governance.fab3f64ea777.mjs'),
  extensions: () => import('./domains/extensions.e6e765583f5d.mjs'),
  autonomy: () => import('./domains/autonomy.0d4d559d003f.mjs'),
  labs: () => import('./domains/platform.e1c050d1f45f.mjs'),
  release: () => import('./domains/release.4a1bc728cebf.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.95e6ae995843.mjs'),
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
