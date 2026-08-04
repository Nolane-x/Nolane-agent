import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { signed, strings, text } from '../construction/construction-utils.mjs';

const SHA256 = /^[a-f0-9]{64}$/i;
function equal(left, right) { return canonicalSha256(left) === canonicalSha256(right); }
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`); return value; }

export class CausalInterventionLab {
  async run({ interventionId, baselineState, intervention, heldConstantVariables = [], execute } = {}) {
    const id = text(interventionId, 'interventionId', 256);
    const baseline = structuredClone(object(baselineState, 'baselineState'));
    const variable = text(intervention?.variable, 'intervention.variable', 256);
    if (!(variable in baseline)) throw new Error(`intervention variable is not present in baseline: ${variable}`);
    const constants = strings(heldConstantVariables, 'heldConstantVariables', 256, 256).sort();
    if (constants.includes(variable)) throw new Error('intervention variable cannot also be held constant');
    for (const constant of constants) if (!(constant in baseline)) throw new Error(`held constant is not present in baseline: ${constant}`);
    if (typeof execute !== 'function') throw new TypeError('execute is required');

    const sandboxState = structuredClone(baseline);
    sandboxState[variable] = structuredClone(intervention.value);
    const changedVariables = Object.keys({ ...baseline, ...sandboxState }).filter((key) => !equal(baseline[key], sandboxState[key])).sort();
    if (changedVariables.length !== 1 || changedVariables[0] !== variable) throw new Error('causal intervention must change exactly one variable');

    const execution = await execute(structuredClone(sandboxState));
    if (!execution || typeof execution !== 'object') throw new TypeError('execute must return an observation');
    if (!SHA256.test(String(execution.receiptSha256 ?? ''))) throw new TypeError('execution receipt must be SHA-256');
    const observedState = object(execution.observedState, 'execution.observedState');
    const heldConstantsVerified = [];
    for (const constant of constants) {
      if (!equal(observedState[constant], baseline[constant])) throw new Error(`held constant changed: ${constant}`);
      heldConstantsVerified.push(constant);
    }
    const effect = { baselineOutcome: null, interventionOutcome: execution.outcome ?? null };
    return signed({
      schema: 'forge.causal-intervention-proof.v1', interventionId: id, status: 'pass', variable,
      baselineStateSha256: canonicalSha256(baseline), sandboxStateSha256: canonicalSha256(sandboxState),
      changedVariables, heldConstantsVerified, executionReceiptSha256: String(execution.receiptSha256).toLowerCase(), effect,
      claims: { productionStateMutated: false, variablesOtherThanInterventionChanged: false, observationIsProductionEvidence: false },
    });
  }
}
