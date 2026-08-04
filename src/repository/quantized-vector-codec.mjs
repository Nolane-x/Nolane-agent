export const QUANTIZED_VECTOR_REVISION = 'symmetric-int8-v1';

export function encodeQuantizedVector(vector) {
  if ((!Array.isArray(vector) && !ArrayBuffer.isView(vector)) || vector.length === 0) throw new TypeError('vector must be a non-empty array');
  const values = Array.from(vector, (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new TypeError('vector values must be finite numbers');
    return number;
  });
  const maxAbs = Math.max(...values.map(Math.abs));
  const scale = maxAbs > 0 ? maxAbs / 127 : 1;
  const bytes = Buffer.alloc(values.length);
  for (let index = 0; index < values.length; index += 1) bytes.writeInt8(Math.max(-127, Math.min(127, Math.round(values[index] / scale))), index);
  return Object.freeze({ revision: QUANTIZED_VECTOR_REVISION, dimensions: values.length, scale, bytes });
}

export function decodeQuantizedVector({ revision = QUANTIZED_VECTOR_REVISION, dimensions, scale, bytes } = {}) {
  if (revision !== QUANTIZED_VECTOR_REVISION) throw new TypeError(`unsupported vector revision: ${revision}`);
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes ?? []);
  const size = Number(dimensions);
  if (!Number.isInteger(size) || size <= 0 || buffer.length !== size) throw new TypeError('quantized vector dimensions do not match payload bytes');
  const factor = Number(scale);
  if (!Number.isFinite(factor) || factor <= 0) throw new TypeError('quantized vector scale must be positive');
  return Array.from({ length: size }, (_, index) => buffer.readInt8(index) * factor);
}
