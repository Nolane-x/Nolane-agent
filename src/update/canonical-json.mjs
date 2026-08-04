function normalize(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new TypeError('canonical JSON does not support non-finite numbers'); return Object.is(value, -0) ? 0 : value; }
  if (Array.isArray(value)) return value.map((item) => normalize(item));
  if (value && typeof value === 'object') {
    const output = {};
    for (const key of Object.keys(value).sort()) { if (value[key] === undefined) throw new TypeError(`canonical JSON does not support undefined at ${key}`); output[key] = normalize(value[key]); }
    return output;
  }
  throw new TypeError(`canonical JSON does not support ${typeof value}`);
}
export function canonicalJson(value) { return JSON.stringify(normalize(value)); }
