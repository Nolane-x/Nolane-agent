import crypto from 'node:crypto';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function normalizeSuffix(suffix) {
  const normalized = String(suffix ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9_]+$/.test(normalized)) throw new TypeError('environment suffix must contain only A-Z, 0-9 and underscore');
  return normalized;
}

export function createNolaneEnvironment(environment = process.env, { eventSink = () => {} } = {}) {
  const emitted = new Set();
  const read = (suffix, fallback = undefined) => {
    const normalized = normalizeSuffix(suffix);
    const canonicalName = `NOLANE_AGENT_${normalized}`;
    const legacyName = `FORGE_STUDIO_${normalized}`;
    if (environment[canonicalName] !== undefined && environment[canonicalName] !== '') return environment[canonicalName];
    if (environment[legacyName] !== undefined && environment[legacyName] !== '') {
      const key = `${canonicalName}:${legacyName}`;
      if (!emitted.has(key)) {
        emitted.add(key);
        const base = { schema: 'nolane.agent.environment-migration.v1', source: 'legacy', canonicalName, legacyName };
        eventSink(Object.freeze({ ...base, receiptSha256: sha256(JSON.stringify(base)) }));
      }
      return environment[legacyName];
    }
    return fallback;
  };
  const api = {
    get: read,
    has(suffix) { return read(suffix, undefined) !== undefined; },
    compatibilityView() {
      return new Proxy(environment, {
        get(target, property, receiver) {
          if (typeof property === 'string' && property.startsWith('FORGE_STUDIO_')) return read(property.slice('FORGE_STUDIO_'.length), undefined);
          return Reflect.get(target, property, receiver);
        },
        has(target, property) {
          if (typeof property === 'string' && property.startsWith('FORGE_STUDIO_')) return read(property.slice('FORGE_STUDIO_'.length), undefined) !== undefined;
          return Reflect.has(target, property);
        },
      });
    },
  };
  return Object.freeze(api);
}
