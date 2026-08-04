export const PRODUCT = Object.freeze({
  name: 'ForgeOS',
  version: '0.6.1',
  license: 'MIT',
  protocolTargets: Object.freeze({ mcp: '2025-11-25', a2a: '1.0', jsonSchema: '2020-12' }),
});

export const STAGES = Object.freeze([
  'intent', 'discovery', 'research', 'divergence', 'synthesis', 'selection',
  'product-definition', 'ux-design', 'architecture', 'planning', 'implementation',
  'verification', 'release-readiness', 'released',
]);

export const ASSURANCE_LEVELS = Object.freeze(['A0', 'A1', 'A2', 'A3', 'A4']);
export const ARTIFACT_STATES = Object.freeze(['draft', 'review', 'verified', 'superseded', 'invalidated']);
export const SKILL_STATUSES = Object.freeze(['experimental', 'candidate', 'stable', 'deprecated', 'quarantined']);
export const GATE_STATUSES = Object.freeze(['pass', 'fail', 'blocked']);
export const CORE_PACKS = Object.freeze(['kernel','research','creativity','product','ux','architecture','planning','implementation','quality','security','operations','meta']);
export const DOMAIN_PACKS = Object.freeze(['saas','automation','developer-tools','browser-extensions','games','ai-products','data-platforms','mobile','desktop','ecommerce','enterprise','api-products','visual-design','interactive-3d','physical-products','physical-ai']);
