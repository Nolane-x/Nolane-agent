import { assertNoPrivateFields, finite, signed, text } from './cognition-utils.mjs';

const SUBSYSTEMS = Object.freeze(['perception', 'context', 'memory', 'causalModel', 'planning', 'execution', 'verification', 'goal']);
const TEMPLATES = Object.freeze({
  'missing-binary': { execution: 0.84, context: 0.04, planning: 0.03, perception: 0.02, memory: 0.02, causalModel: 0.02, verification: 0.02, goal: 0.01 },
  'environment-failure': { execution: 0.72, context: 0.08, planning: 0.05, perception: 0.05, memory: 0.03, causalModel: 0.03, verification: 0.03, goal: 0.01 },
  'stale-symbol-memory': { memory: 0.55, context: 0.32, perception: 0.04, causalModel: 0.03, planning: 0.02, execution: 0.02, verification: 0.01, goal: 0.01 },
  'criteria-unmet': { causalModel: 0.48, goal: 0.28, verification: 0.12, context: 0.05, planning: 0.04, execution: 0.01, memory: 0.01, perception: 0.01 },
  timeout: { execution: 0.45, planning: 0.18, context: 0.12, causalModel: 0.08, verification: 0.06, memory: 0.04, perception: 0.04, goal: 0.03 },
  default: { causalModel: 0.22, execution: 0.22, context: 0.14, planning: 0.14, memory: 0.08, verification: 0.08, perception: 0.07, goal: 0.05 },
});

function normalize(template) {
  const total = SUBSYSTEMS.reduce((sum, key) => sum + Number(template[key] ?? 0), 0);
  return Object.fromEntries(SUBSYSTEMS.map((key) => [key, total > 0 ? Number(template[key] ?? 0) / total : 1 / SUBSYSTEMS.length]));
}

export class StructuredErrorRouter {
  constructor({ ownerThreshold = 0.2 } = {}) {
    this.ownerThreshold = finite(ownerThreshold, 'ownerThreshold', { min: 0, max: 1 });
  }

  route(errorEvent = {}) {
    assertNoPrivateFields(errorEvent);
    const category = text(errorEvent.category ?? 'default', 'category', 128);
    let template = TEMPLATES[category] ?? TEMPLATES.default;
    if (errorEvent.code === 'ENOENT') template = TEMPLATES['missing-binary'];
    if (category === 'criteria-unmet' && errorEvent.testsPassed !== true) template = { ...TEMPLATES.default, verification: 0.22, causalModel: 0.2 };
    const errorPosterior = normalize(template);
    const ranked = [...SUBSYSTEMS].sort((a, b) => errorPosterior[b] - errorPosterior[a] || a.localeCompare(b));
    const primarySubsystem = ranked[0];
    const ownerMask = ranked.filter((key) => errorPosterior[key] >= this.ownerThreshold);
    return signed({
      schema: 'forge.structured-error-route.v1',
      category,
      errorCode: String(errorEvent.code ?? '').slice(0, 128) || null,
      primarySubsystem,
      errorPosterior,
      ownerMask,
      claims: { scalarErrorReplaced: true, unrelatedSubsystemsMasked: true, rawPayloadStored: false },
    });
  }
}
