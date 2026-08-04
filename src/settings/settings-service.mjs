import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { LayeredSettings } from './layered-settings.mjs';
import { createSettingsCatalog, validateSettingsPatch } from './settings-catalog.mjs';

const SECRET_KEY = /(api[-_]?key|access[-_]?token|refresh[-_]?token|password|secret|credential)/i;

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  return value;
}

function rejectSecrets(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (SECRET_KEY.test(key)) throw new Error(`Secret setting ${full} must use the credential vault`);
    rejectSecrets(child, full);
  }
}

function flattenPaths(value, prefix = '', output = new Set()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) { if (prefix) output.add(prefix); return output; }
  for (const [key, child] of Object.entries(value)) flattenPaths(child, prefix ? `${prefix}.${key}` : key, output);
  return output;
}

function deleteAt(root, pathValue) {
  const parts = String(pathValue).split('.').filter(Boolean);
  if (!parts.length) return;
  const nodes = [root];
  let node = root;
  for (const part of parts.slice(0, -1)) {
    if (!node?.[part] || typeof node[part] !== 'object' || Array.isArray(node[part])) return;
    node = node[part]; nodes.push(node);
  }
  delete node[parts.at(-1)];
  for (let index = parts.length - 2; index >= 0; index -= 1) {
    const parent = nodes[index]; const key = parts[index];
    if (parent?.[key] && typeof parent[key] === 'object' && !Array.isArray(parent[key]) && Object.keys(parent[key]).length === 0) delete parent[key];
  }
}

function merge(base, patch) {
  const out = structuredClone(base ?? {});
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value === null) { delete out[key]; continue; }
    if (value && typeof value === 'object' && !Array.isArray(value) && out[key] && typeof out[key] === 'object' && !Array.isArray(out[key])) out[key] = merge(out[key], value);
    else out[key] = structuredClone(value);
  }
  return out;
}

async function readJson(file) {
  try { const value = JSON.parse(await readFile(file, 'utf8')); return object(value, `settings file ${file}`); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temp, file);
}

export class SettingsService {
  constructor({ dataDir, getProject, defaults = {}, lockedKeys = [], catalog = createSettingsCatalog() } = {}) {
    if (typeof getProject !== 'function') throw new TypeError('SettingsService getProject is required');
    this.dataDir = path.resolve(String(dataDir ?? '.'));
    this.getProject = getProject;
    this.defaults = structuredClone(object(defaults, 'defaults'));
    this.settingsCatalog = structuredClone(object(catalog, 'catalog'));
    this.defaultPaths = flattenPaths(this.defaults);
    this.layers = new LayeredSettings({ lockedKeys });
  }

  #files(projectId = null) {
    const user = path.join(this.dataDir, 'settings', 'user.json');
    if (!projectId) return { user, project: null, local: null };
    const project = this.getProject(String(projectId));
    if (!project) throw new Error(`Unknown project: ${projectId}`);
    return { user, project: path.join(project.workspaceRoot, '.forge', 'settings.json'), local: path.join(this.dataDir, 'settings', 'projects', `${project.id}.local.json`) };
  }

  catalog() { return structuredClone(this.settingsCatalog); }

  #validate(input, layer) {
    const definitions = new Map(this.settingsCatalog.categories.flatMap((category) => category.fields.map((item) => [item.path, item])));
    const errors = validateSettingsPatch(input, this.settingsCatalog).filter((error) => {
      if (error.code === 'unknown-setting' && this.defaultPaths.has(error.path)) return false;
      return true;
    });
    for (const pathValue of flattenPaths(input)) {
      const definition = definitions.get(pathValue);
      if (definition && !definition.scope.includes(layer)) errors.push(Object.freeze({ path: pathValue, code: 'invalid-scope', message: `Setting ${pathValue} cannot be stored in ${layer}` }));
    }
    if (errors.length) {
      const error = Object.assign(new Error('Settings validation failed'), { statusCode: 400, code: 'settings_validation_failed', details: Object.freeze(errors.map((item) => Object.freeze({ ...item }))) });
      throw error;
    }
  }

  async effective(projectId = null) {
    const files = this.#files(projectId);
    return this.layers.resolve({ defaults: this.defaults, user: await readJson(files.user), project: files.project ? await readJson(files.project) : {}, local: files.local ? await readJson(files.local) : {} });
  }

  async layer(layer, projectId = null) {
    const files = this.#files(projectId);
    const file = files[layer];
    if (!file) throw new TypeError(`settings layer ${layer} requires a project`);
    return readJson(file);
  }

  async update({ layer, projectId = null, patch } = {}) {
    const cleanLayer = String(layer ?? '');
    if (!['user', 'project', 'local'].includes(cleanLayer)) throw new TypeError('settings layer must be user, project, or local');
    const input = object(patch, 'settings patch');
    rejectSecrets(input);
    this.#validate(input, cleanLayer);
    const files = this.#files(projectId);
    const file = files[cleanLayer];
    if (!file) throw new TypeError(`settings layer ${cleanLayer} requires a project`);
    const next = merge(await readJson(file), input);
    await atomicJson(file, next);
    return Object.freeze({ layer: cleanLayer, projectId: projectId == null ? null : String(projectId), value: Object.freeze(structuredClone(next)), effective: await this.effective(projectId) });
  }

  async reset({ layer, projectId = null, paths = null } = {}) {
    const cleanLayer = String(layer ?? '');
    if (!['user', 'project', 'local'].includes(cleanLayer)) throw new TypeError('settings layer must be user, project, or local');
    const files = this.#files(projectId);
    const file = files[cleanLayer];
    if (!file) throw new TypeError(`settings layer ${cleanLayer} requires a project`);
    const current = await readJson(file);
    const requested = paths == null ? null : [...new Set((Array.isArray(paths) ? paths : [paths]).map(String).map((item) => item.trim()).filter(Boolean))];
    const next = requested == null ? {} : structuredClone(current);
    if (requested) for (const pathValue of requested) deleteAt(next, pathValue);
    await atomicJson(file, next);
    return Object.freeze({ layer: cleanLayer, projectId: projectId == null ? null : String(projectId), resetPaths: requested == null ? null : Object.freeze(requested), value: Object.freeze(structuredClone(next)), effective: await this.effective(projectId) });
  }
}
