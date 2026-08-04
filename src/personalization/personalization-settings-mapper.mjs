import { PERSONALIZATION_SETTING_PATHS, PERSONALIZATION_RUNTIME_PATHS } from './personalization-profile-schema.mjs';

const ALLOWED = new Set(PERSONALIZATION_SETTING_PATHS);
const RUNTIME = new Set(PERSONALIZATION_RUNTIME_PATHS);

function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }

export function getAt(root, path) {
  return String(path).split('.').reduce((value, key) => value?.[key], root);
}

export function setAt(root, path, value) {
  const parts = String(path).split('.');
  let node = root;
  for (const key of parts.slice(0, -1)) node = node[key] ??= {};
  node[parts.at(-1)] = structuredClone(value);
  return root;
}

export function flattenSettings(value, prefix = '', output = new Map()) {
  if (!object(value)) {
    if (prefix) output.set(prefix, structuredClone(value));
    return output;
  }
  for (const [key, child] of Object.entries(value)) flattenSettings(child, prefix ? `${prefix}.${key}` : key, output);
  return output;
}

export function projectPersonalizationSettings(settings = {}) {
  const output = {};
  for (const path of PERSONALIZATION_SETTING_PATHS) {
    const value = getAt(settings, path);
    if (value !== undefined) setAt(output, path, value);
  }
  return output;
}

export function importPersonalizationPreferences(preferences = {}) {
  const patch = {};
  const accepted = [];
  const unknown = {};
  for (const [path, value] of flattenSettings(preferences)) {
    if (ALLOWED.has(path)) {
      setAt(patch, path, value);
      accepted.push(path);
    } else {
      setAt(unknown, path, value);
    }
  }
  return Object.freeze({ patch, accepted: Object.freeze(accepted.sort()), unknown });
}

export function compilePersonalizationContext(settings = {}) {
  const values = {};
  for (const path of RUNTIME) {
    const value = getAt(settings, path);
    if (value !== undefined) setAt(values, path, value);
  }
  return Object.freeze(values);
}
