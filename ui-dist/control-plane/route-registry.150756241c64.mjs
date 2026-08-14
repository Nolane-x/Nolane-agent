const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.56eeb97a8f8e.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.ae81fea62229.mjs'),
  operations: () => import('./domains/operations.bec74011622c.mjs'),
  runtime: () => import('./domains/runtime.6d0399042ab5.mjs'),
  'context-memory': () => import('./domains/context-memory.deae2f1b1e08.mjs'),
  evidence: () => import('./domains/evidence.c9b70e4d9e7b.mjs'),
  intelligence: () => import('./domains/intelligence.e38280fa2654.mjs'),
  'trust-security': () => import('./domains/trust-security.397f54a6f72d.mjs'),
  governance: () => import('./domains/governance.47d77028f483.mjs'),
  extensions: () => import('./domains/extensions.4d3310eeb059.mjs'),
  autonomy: () => import('./domains/autonomy.6dde25071662.mjs'),
  labs: () => import('./domains/platform.bd46f585390e.mjs'),
  release: () => import('./domains/release.864be4504bbd.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.eb29b1279090.mjs'),
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
