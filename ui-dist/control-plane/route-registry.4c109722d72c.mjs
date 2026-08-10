const cache = new Map();
const approvedRoutes = {
  overview: () => import('./domains/overview.eeb617d52fcf.mjs'),
  'agent-kernel': () => import('./domains/agent-kernel.b0a308395194.mjs'),
  operations: () => import('./domains/operations.4c23a0070e8e.mjs'),
  runtime: () => import('./domains/runtime.d48f22779c76.mjs'),
  'context-memory': () => import('./domains/context-memory.d1ecd01d08ae.mjs'),
  evidence: () => import('./domains/evidence.c9affcbcadb8.mjs'),
  intelligence: () => import('./domains/intelligence.f883e665f341.mjs'),
  'trust-security': () => import('./domains/trust-security.61a0647b6264.mjs'),
  governance: () => import('./domains/governance.2f0148718bf5.mjs'),
  extensions: () => import('./domains/extensions.3622c4b4ccf3.mjs'),
  autonomy: () => import('./domains/autonomy.6d9517a7e79f.mjs'),
  labs: () => import('./domains/platform.d56e8b7a4a4d.mjs'),
  release: () => import('./domains/release.d752f7610be9.mjs'),
};
// Capability Atlas is a new expert surface. It remains non-enumerable so the
// historical approved-domain contract and third-party automation stay stable.
Object.defineProperty(approvedRoutes, 'capabilities', {
  value: () => import('./domains/capabilities.02b7b249f276.mjs'),
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
