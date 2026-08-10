import { createHash } from 'node:crypto';

function canonicalize(value, path = '$', stack = new WeakSet()) {
  if (value === null) return 'null';
  const type = typeof value;
  if (type === 'string' || type === 'boolean') return JSON.stringify(value);
  if (type === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`Non-finite number at ${path}`);
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (type === 'bigint' || type === 'undefined' || type === 'function' || type === 'symbol') {
    throw new TypeError(`Non-JSON value at ${path}`);
  }
  if (stack.has(value)) throw new TypeError(`Cyclic value at ${path}`);
  stack.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((item, index) => canonicalize(item, `${path}[${index}]`, stack)).join(',')}]`;
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new TypeError(`Non-plain object at ${path}`);
    const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], `${path}.${key}`, stack)}`).join(',')}}`;
  } finally {
    stack.delete(value);
  }
}

export function canonicalStringify(value) {
  return canonicalize(value);
}

export function canonicalSha256(value) {
  return createHash('sha256').update(canonicalStringify(value)).digest('hex');
}
