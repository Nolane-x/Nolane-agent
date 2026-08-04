import { deepFreeze } from '../config.mjs';

const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);

function validateTree(value, path = '') {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach((item, index) => validateTree(item, `${path}[${index}]`)); return; }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN.has(key)) throw new TypeError(`prototype key is forbidden at ${path || '<root>'}.${key}`);
    validateTree(child, path ? `${path}.${key}` : key);
  }
}

function matches(pattern, key) {
  if (pattern.endsWith('.*')) return key === pattern.slice(0, -2) || key.startsWith(`${pattern.slice(0, -2)}.`);
  return pattern === key;
}

function isObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function setAt(root, parts, value) {
  let node = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!isObject(node[key])) node[key] = {};
    node = node[key];
  }
  const leaf = parts.at(-1);
  if (value === undefined) delete node[leaf]; else node[leaf] = value;
}

export class LayeredSettings {
  constructor({ lockedKeys = [] } = {}) { this.lockedKeys = Object.freeze([...new Set(lockedKeys.map(String))]); }

  resolve({ defaults = {}, user = {}, project = {}, local = {} } = {}) {
    for (const layer of [defaults, user, project, local]) validateTree(layer);
    const value = {}; const provenance = {}; const warnings = [];
    const apply = (input, layer, prefix = '') => {
      for (const [key, child] of Object.entries(input)) {
        const full = prefix ? `${prefix}.${key}` : key;
        if (isObject(child)) { apply(child, layer, full); continue; }
        const locked = (layer === 'project' || layer === 'local') && this.lockedKeys.some((pattern) => matches(pattern, full));
        if (locked) { warnings.push(Object.freeze({ layer, key: full, reason: 'locked-setting' })); continue; }
        setAt(value, full.split('.'), child === null ? undefined : structuredClone(child));
        if (child === null) delete provenance[full]; else provenance[full] = layer;
      }
    };
    apply(defaults, 'defaults'); apply(user, 'user'); apply(project, 'project'); apply(local, 'local');
    return deepFreeze({ value, provenance, warnings });
  }
}
