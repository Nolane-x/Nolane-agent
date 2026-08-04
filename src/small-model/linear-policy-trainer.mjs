import { encodeState, validateDimensions } from './hashed-feature-encoder.mjs';
import { deepFreeze } from './shared.mjs';

function hiddenScan(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (/(?:chain.?of.?thought|hidden.?reasoning|reasoning.?trace|private.?scratchpad)/i.test(key) && !(key === 'hiddenChainOfThoughtStored' && child === false)) throw new TypeError(`Hidden reasoning is forbidden at ${path}.${key}`);
    hiddenScan(child, `${path}.${key}`);
  }
}
function finite(value, label, { min = -Infinity, max = Infinity } = {}) { const number = Number(value); if (!Number.isFinite(number) || number < min || number > max) throw new TypeError(`${label} is invalid`); return number; }
function dot(weights, vector, bias) { let value = bias; for (let index = 0; index < vector.length; index += 1) value += weights[index] * vector[index]; return value; }
function probabilities(model, state) {
  const vector = encodeState(state, { dimensions: model.dimensions });
  const logits = model.weights.map((weights, index) => dot(weights, vector, model.biases[index]));
  const max = Math.max(...logits); const exps = logits.map((value) => Math.exp(value - max)); const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map((value) => value / total);
}
function orderedIndices(length, seed, epoch) {
  return Array.from({ length }, (_, index) => index).sort((a, b) => {
    const left = `${seed}:${epoch}:${a}`; const right = `${seed}:${epoch}:${b}`;
    let lh = 2166136261, rh = 2166136261;
    for (const char of left) { lh ^= char.charCodeAt(0); lh = Math.imul(lh, 16777619); }
    for (const char of right) { rh ^= char.charCodeAt(0); rh = Math.imul(rh, 16777619); }
    return (lh >>> 0) - (rh >>> 0) || a - b;
  });
}
function normalizeExamples(examples) {
  if (!Array.isArray(examples)) throw new TypeError('training examples must be an array');
  for (const item of examples) hiddenScan(item);
  if (examples.length < 2) throw new TypeError('training requires at least two examples');
  return examples.map((item, index) => {
    if (!item?.state || typeof item.state !== 'object') throw new TypeError(`example ${index} state is required`);
    const label = String(item.action?.type ?? item.label ?? '').trim(); if (!label) throw new TypeError(`example ${index} action label is required`);
    return { state: item.state, label };
  });
}

export function trainLinearPolicy({ examples, dimensions = 256, epochs = 120, learningRate = 0.12, l2 = 0.0001, seed = 'nolane-linear-policy-v1' } = {}) {
  const values = normalizeExamples(examples); const size = validateDimensions(dimensions);
  const epochCount = Number(epochs); if (!Number.isSafeInteger(epochCount) || epochCount < 1 || epochCount > 10_000) throw new TypeError('epochs must be an integer between 1 and 10000');
  const rate = finite(learningRate, 'learningRate', { min: 0.000001, max: 10 }); const penalty = finite(l2, 'l2', { min: 0, max: 1 });
  const labels = [...new Set(values.map((item) => item.label))].sort(); if (labels.length < 2) throw new Error('training requires at least two labels');
  const labelIndex = new Map(labels.map((label, index) => [label, index]));
  const weights = labels.map(() => new Float64Array(size)); const biases = labels.map(() => 0); const vectors = values.map((item) => encodeState(item.state, { dimensions: size }));
  const lossHistory = [];
  for (let epoch = 0; epoch < epochCount; epoch += 1) {
    let totalLoss = 0;
    for (const itemIndex of orderedIndices(values.length, seed, epoch)) {
      const vector = vectors[itemIndex]; const target = labelIndex.get(values[itemIndex].label);
      const logits = weights.map((row, index) => dot(row, vector, biases[index])); const max = Math.max(...logits);
      const exps = logits.map((value) => Math.exp(value - max)); const denominator = exps.reduce((sum, value) => sum + value, 0); const probs = exps.map((value) => value / denominator);
      totalLoss += -Math.log(Math.max(1e-12, probs[target]));
      for (let classIndex = 0; classIndex < labels.length; classIndex += 1) {
        const error = probs[classIndex] - (classIndex === target ? 1 : 0);
        const row = weights[classIndex];
        for (let feature = 0; feature < size; feature += 1) row[feature] -= rate * (error * vector[feature] + penalty * row[feature]);
        biases[classIndex] -= rate * error;
      }
    }
    lossHistory.push(Number((totalLoss / values.length).toFixed(10)));
  }
  const round = (value) => Number(value.toFixed(10));
  return deepFreeze({
    schema: 'nolane.small-model.linear-policy.v1', labels, dimensions: size,
    weights: weights.map((row) => Object.freeze([...row].map(round))), biases: Object.freeze(biases.map(round)),
    training: { examples: values.length, epochs: epochCount, learningRate: rate, l2: penalty, seed: String(seed), lossHistory: Object.freeze(lossHistory) },
  });
}

export function predictLinearPolicy(model, state) {
  const probs = probabilities(model, state); const ranking = model.labels.map((label, index) => ({ label, probability: probs[index] })).sort((a, b) => b.probability - a.probability || a.label.localeCompare(b.label));
  return deepFreeze({ label: ranking[0].label, confidence: ranking[0].probability, ranking });
}

export function scoreLinearPolicy(model, examples) {
  const values = normalizeExamples(examples); let correct = 0; const confusion = {};
  for (const item of values) { const predicted = predictLinearPolicy(model, item.state).label; if (predicted === item.label) correct += 1; const key = `${item.label}->${predicted}`; confusion[key] = (confusion[key] ?? 0) + 1; }
  return deepFreeze({ total: values.length, correct, accuracy: correct / values.length, confusion });
}
