import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

function text(value, label, max = 256) {
  const output = String(value ?? '').trim();
  if (!output) throw new TypeError(`${label} is required`);
  if (output.length > max) throw new TypeError(`${label} exceeds ${max} characters`);
  return output;
}
function unit(value, label) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new TypeError(`${label} must be between 0 and 1`);
  return number;
}
function cost(value, label) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) throw new TypeError(`${label} must be a finite non-negative number`);
  return number;
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }

export class EpistemicActionSelector {
  constructor({ weights = {} } = {}) {
    this.weights = Object.freeze({
      taskUtility: Number(weights.taskUtility ?? 1),
      informationGain: Number(weights.informationGain ?? 1),
      tokenCost: Number(weights.tokenCost ?? 1 / 10_000),
      ramCost: Number(weights.ramCost ?? 1 / 1_000),
      timeCost: Number(weights.timeCost ?? 1 / 10_000),
      irreversibilityRisk: Number(weights.irreversibilityRisk ?? 1),
    });
    for (const [key, value] of Object.entries(this.weights)) if (!Number.isFinite(value) || value < 0) throw new TypeError(`weights.${key} must be finite and non-negative`);
  }

  select({ actions, uncertainty = 0, uncertaintyFloor = 0, irreversibilityLimit = 1 } = {}) {
    if (!Array.isArray(actions) || actions.length === 0 || actions.length > 128) throw new TypeError('actions must contain 1 to 128 items');
    const claimedUncertainty = unit(uncertainty, 'uncertainty');
    const evidenceUncertaintyFloor = unit(uncertaintyFloor, 'uncertaintyFloor');
    const uncertaintyValue = Math.max(claimedUncertainty, evidenceUncertaintyFloor);
    const limit = unit(irreversibilityLimit, 'irreversibilityLimit');
    const ids = new Set();
    const ranked = actions.map((action, index) => {
      const id = text(action?.id, `actions[${index}].id`);
      if (ids.has(id)) throw new TypeError(`duplicate action id: ${id}`);
      ids.add(id);
      const irreversibility = unit(action?.irreversibility, `actions[${index}].irreversibility`);
      const eligible = irreversibility <= limit;
      const breakdown = {
        taskUtility: unit(action?.taskUtility, `actions[${index}].taskUtility`) * this.weights.taskUtility,
        informationGain: unit(action?.informationGain, `actions[${index}].informationGain`) * this.weights.informationGain,
        tokenCost: cost(action?.tokenCost, `actions[${index}].tokenCost`) * this.weights.tokenCost,
        ramCost: cost(action?.ramMbSeconds, `actions[${index}].ramMbSeconds`) * this.weights.ramCost,
        timeCost: cost(action?.timeMs, `actions[${index}].timeMs`) * this.weights.timeCost,
        irreversibilityRisk: irreversibility * this.weights.irreversibilityRisk * Math.max(uncertaintyValue, 0.1),
      };
      const score = breakdown.taskUtility + breakdown.informationGain - breakdown.tokenCost - breakdown.ramCost - breakdown.timeCost - breakdown.irreversibilityRisk;
      return { id, kind: text(action?.kind ?? 'action', `actions[${index}].kind`), eligible, score, breakdown, rejectedReason: eligible ? null : 'irreversibility-exceeds-limit' };
    }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || a.id.localeCompare(b.id));
    const selected = ranked.find((item) => item.eligible) ?? null;
    return signed({
      schema: 'forge.epistemic-action-selection.v1',
      uncertainty: uncertaintyValue,
      claimedUncertainty,
      uncertaintyFloor: evidenceUncertaintyFloor,
      irreversibilityLimit: limit,
      selected,
      ranked,
      claims: { selectedByInformationGainAndCost: true, irreversibleActionsCanBeRejected: true, uncertaintyFloorApplied: evidenceUncertaintyFloor > claimedUncertainty },
    });
  }
}
