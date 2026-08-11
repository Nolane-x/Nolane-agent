const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.5569841e1e89.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.cf27baae84f9.mjs'),
  operations: () => import('./domains/operations.4907c47fa793.mjs'),
  runtime: () => import('./domains/runtime.8417344a5085.mjs'),
  'context-memory': () => import('./domains/context-memory.b9117dfa91ec.mjs'),
  evidence: () => import('./domains/evidence.3335a0a2ecec.mjs'),
  intelligence: () => import('./domains/intelligence.d8df0e71dabd.mjs'),
  'trust-security': () => import('./domains/trust-security.6187855bd7c3.mjs'),
  governance: () => import('./domains/governance.c89a75a39caa.mjs'),
  extensions: () => import('./domains/extensions.80d348f20fb9.mjs'),
  autonomy: () => import('./domains/autonomy.eec4aa1733a7.mjs'),
  labs: () => import('./domains/platform.4820dd09c07c.mjs'),
  release: () => import('./domains/release.a204bbac3714.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.3e9fed44367d.mjs'),
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
