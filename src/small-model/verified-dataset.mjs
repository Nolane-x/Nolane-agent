import { canonicalSha256, clone, deepFreeze, boundedNumber } from './shared.mjs';

const HIDDEN = /(?:chain.?of.?thought|hidden.?reasoning|reasoning.?trace|private.?scratchpad)/i;
function scan(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (HIDDEN.test(key) && !(key === 'hiddenChainOfThoughtStored' && child === false)) throw new TypeError(`Hidden reasoning is forbidden at ${path}.${key}`);
    scan(child, `${path}.${key}`);
  }
}
function requiredString(value, label) { const result = String(value ?? '').trim(); if (!result) throw new TypeError(`${label} is required`); return result; }
function hashOrder(value, seed) { return canonicalSha256({ seed: String(seed), value: String(value) }); }

export function createVerifiedExample(input = {}) {
  scan(input);
  const id = requiredString(input.id, 'id');
  const taskId = requiredString(input.taskId, 'taskId');
  const repositoryId = requiredString(input.repositoryId, 'repositoryId');
  const scenarioGroup = requiredString(input.scenarioGroup ?? taskId, 'scenarioGroup');
  if (!input.state || typeof input.state !== 'object' || Array.isArray(input.state)) throw new TypeError('state must be a typed public object');
  const actionType = requiredString(input.action?.type, 'action.type');
  if (!input.actualEffect || typeof input.actualEffect !== 'object') throw new TypeError('actualEffect is required');
  const changed = input.actualEffect.changed === true || Number(input.actualEffect.criterionDelta ?? 0) !== 0 || Number(input.actualEffect.informationGain ?? 0) > 0;
  if (!changed) throw new Error('verified example requires an observed effect');
  if (input.verifier?.valid !== true) throw new Error('verified example requires a valid verifier');
  if (input.verifier?.independent !== true) throw new Error('verified example requires an independent verifier');
  if (!/^[a-f0-9]{64}$/.test(String(input.verifier?.receiptSha256 ?? ''))) throw new TypeError('verifier receiptSha256 is required');
  const base = {
    schema: 'nolane.small-model.verified-example.v1', id, taskId, repositoryId, scenarioGroup,
    state: clone(input.state), action: { ...clone(input.action), type: actionType },
    expectedEffect: clone(input.expectedEffect ?? {}), actualEffect: clone(input.actualEffect),
    verifier: clone(input.verifier), cost: clone(input.cost ?? {}), hiddenChainOfThoughtStored: false,
  };
  return deepFreeze({ ...base, exampleSha256: canonicalSha256(base) });
}

export function buildDeterministicSplit({ examples = [], seed = 'nolane', heldOutRatio = 0.2, validationRatio = 0.1, disjointBy = 'scenarioGroup' } = {}) {
  if (!Array.isArray(examples) || examples.length < 3) throw new TypeError('at least three examples are required');
  const held = boundedNumber(heldOutRatio, 'heldOutRatio', { min: 0.05, max: 0.45 });
  const validation = boundedNumber(validationRatio, 'validationRatio', { min: 0.05, max: 0.45 });
  if (held + validation >= 0.8) throw new TypeError('heldOutRatio + validationRatio must leave a training split');
  const normalized = examples.map(createVerifiedExample);
  const groups = new Map();
  for (const example of normalized) {
    const key = requiredString(example[disjointBy], disjointBy);
    const list = groups.get(key) ?? []; list.push(example); groups.set(key, list);
  }
  if (groups.size < 3) throw new Error(`disjoint split requires at least three ${disjointBy} groups`);
  const orderedGroups = [...groups.keys()].sort((a, b) => hashOrder(a, seed).localeCompare(hashOrder(b, seed)) || a.localeCompare(b));
  const heldCount = Math.max(1, Math.round(orderedGroups.length * held));
  const validationCount = Math.max(1, Math.round(orderedGroups.length * validation));
  const maxNonTrain = orderedGroups.length - 1;
  const actualHeld = Math.min(heldCount, maxNonTrain - 1);
  const actualValidation = Math.min(validationCount, maxNonTrain - actualHeld);
  const heldGroups = new Set(orderedGroups.slice(0, actualHeld));
  const validationGroups = new Set(orderedGroups.slice(actualHeld, actualHeld + actualValidation));
  const train = [], validationItems = [], heldOut = [];
  for (const example of normalized.sort((a, b) => a.id.localeCompare(b.id))) {
    const group = example[disjointBy];
    if (heldGroups.has(group)) heldOut.push(example);
    else if (validationGroups.has(group)) validationItems.push(example);
    else train.push(example);
  }
  const base = {
    schema: 'nolane.small-model.verified-dataset-split.v1', seed: String(seed), disjointBy,
    ratios: { heldOut: held, validation }, groups: { train: orderedGroups.length - actualHeld - actualValidation, validation: actualValidation, heldOut: actualHeld },
    train, validation: validationItems, heldOut,
  };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
