import { canonicalSha256, canonicalStringify, clone, deepFreeze } from './shared.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
function finiteArray(values, label, length) { if (!Array.isArray(values) || values.length !== length || values.some((value) => !Number.isFinite(Number(value)))) throw new TypeError(`${label} shape or values are invalid`); return values.map(Number); }
function validateModel(model) {
  if (!model || model.schema !== 'nolane.small-model.linear-policy.v1') throw new TypeError('linear policy model schema is required');
  const dimensions = Number(model.dimensions); if (!Number.isSafeInteger(dimensions) || dimensions < 1) throw new TypeError('model dimensions are invalid');
  if (!Array.isArray(model.labels) || model.labels.length < 2 || new Set(model.labels).size !== model.labels.length) throw new TypeError('model labels are invalid');
  if (!Array.isArray(model.weights) || model.weights.length !== model.labels.length) throw new TypeError('model weight shape is invalid');
  const weights = model.weights.map((row, index) => finiteArray(row, `weights[${index}]`, dimensions));
  const biases = finiteArray(model.biases, 'biases', model.labels.length);
  return { ...clone(model), labels: model.labels.map(String), dimensions, weights, biases };
}

export function createModelArtifact({ model, datasetReceiptSha256, trainingConfig = {}, specialist = 'tool-router' } = {}) {
  if (!SHA256.test(String(datasetReceiptSha256 ?? ''))) throw new TypeError('datasetReceiptSha256 must be a lowercase SHA-256');
  const normalizedModel = validateModel(model);
  const base = {
    schema: 'nolane.small-model.artifact.v1', product: 'Nolane Agent', specialist: String(specialist), runtime: 'nolane-linear-policy-js-v1',
    datasetReceiptSha256: String(datasetReceiptSha256), trainingConfig: clone(trainingConfig), model: normalizedModel,
    claims: { boundedSpecialistModel: true, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
  };
  return deepFreeze({ ...base, artifactSha256: canonicalSha256(base) });
}

export function serializeModelArtifact(artifact) {
  const loaded = loadModelArtifact(JSON.stringify(artifact));
  return canonicalStringify(loaded);
}

export function loadModelArtifact(bytes) {
  const value = typeof bytes === 'string' || bytes instanceof Uint8Array || Buffer.isBuffer(bytes) ? JSON.parse(Buffer.from(bytes).toString('utf8')) : clone(bytes);
  if (!value || value.schema !== 'nolane.small-model.artifact.v1') throw new TypeError('model artifact schema is invalid');
  if (!SHA256.test(String(value.artifactSha256 ?? ''))) throw new TypeError('model artifact hash is invalid');
  if (!SHA256.test(String(value.datasetReceiptSha256 ?? ''))) throw new TypeError('dataset receipt hash is invalid');
  const normalizedModel = validateModel(value.model);
  const { artifactSha256, ...storedBase } = value;
  const base = { ...storedBase, model: normalizedModel };
  const computed = canonicalSha256(base); if (computed !== artifactSha256) throw new Error('Model artifact hash mismatch');
  return deepFreeze({ ...base, artifactSha256 });
}
