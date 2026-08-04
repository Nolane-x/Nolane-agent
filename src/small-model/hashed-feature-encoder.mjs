const HIDDEN = /(?:chain.?of.?thought|hidden.?reasoning|reasoning.?trace|private.?scratchpad)/i;

function validateDimensions(value) {
  const dimensions = Number(value);
  if (!Number.isSafeInteger(dimensions) || dimensions < 16 || dimensions > 65_536 || (dimensions & (dimensions - 1)) !== 0) throw new TypeError('dimensions must be a power of two between 16 and 65536');
  return dimensions;
}
function hash32(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
  return hash >>> 0;
}
function addToken(vector, token, value = 1) {
  const hash = hash32(token); const index = 1 + (hash % (vector.length - 1)); const sign = (hash & 0x80000000) === 0 ? 1 : -1;
  vector[index] += sign * Number(value);
}
function walk(value, prefix, vector) {
  if (value === null || value === undefined) { addToken(vector, `${prefix}=null`); return; }
  if (Array.isArray(value)) { addToken(vector, `${prefix}.length`, Math.min(10, value.length) / 10); value.forEach((item, index) => walk(item, `${prefix}[${Math.min(index, 4)}]`, vector)); return; }
  if (typeof value === 'object') {
    for (const key of Object.keys(value).sort()) {
      if (HIDDEN.test(key)) throw new TypeError(`Hidden reasoning is forbidden at ${prefix}.${key}`);
      walk(value[key], prefix ? `${prefix}.${key}` : key, vector);
    }
    return;
  }
  if (typeof value === 'boolean') { addToken(vector, `${prefix}=${value}`); return; }
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new TypeError(`${prefix} must be finite`); addToken(vector, `${prefix}:number`, Math.sign(value) * Math.log1p(Math.abs(value))); return; }
  const text = String(value).trim().toLowerCase(); addToken(vector, `${prefix}=${text}`);
  for (const token of text.split(/[^a-z0-9_.:/-]+/).filter((item) => item.length >= 2).slice(0, 64)) addToken(vector, `${prefix}:token=${token}`, 0.5);
}

export function encodeState(state, { dimensions = 256, normalize = true } = {}) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new TypeError('state must be a typed object');
  const size = validateDimensions(dimensions); const vector = new Float64Array(size); vector[0] = 1;
  walk(state, 'state', vector);
  if (normalize) {
    let norm = 0; for (let index = 1; index < vector.length; index += 1) norm += vector[index] ** 2;
    norm = Math.sqrt(norm); if (norm > 0) for (let index = 1; index < vector.length; index += 1) vector[index] /= norm;
  }
  return vector;
}

export { validateDimensions };
