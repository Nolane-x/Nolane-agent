import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const CREDENTIAL_REF = /^(vault|env|keychain|credential|secret):[A-Za-z0-9._:@/-]+$/;
const SECRET_SUFFIX = /(?:secret|password|token|api[_-]?key|private[_-]?key)$/i;
const isSecretKey = (key) => SECRET_SUFFIX.test(String(key).replace(/s$/i, (suffix) => suffix));

function sanitize(value, depth = 0) {
  if (depth > 12) throw new Error('configuration exceeds maximum depth');
  if (Array.isArray(value)) return value.map((entry) => sanitize(entry, depth + 1));
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (!value || typeof value !== 'object') throw new Error('configuration values must be JSON-compatible');
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) continue;
    if (isSecretKey(key)) throw new Error(`raw secret field is forbidden: ${key}`);
    out[key] = sanitize(entry, depth + 1);
  }
  return out;
}

function encode(state) {
  const payload = JSON.stringify(state);
  return `${JSON.stringify({ schema: 'nolane.agent.profile-configuration-store.v1', checksum: sha256(payload), payload: state }, null, 2)}\n`;
}
function decode(raw) {
  const parsed = JSON.parse(raw);
  if (parsed.schema !== 'nolane.agent.profile-configuration-store.v1') throw new Error('invalid profile configuration schema');
  if (sha256(JSON.stringify(parsed.payload)) !== parsed.checksum) throw new Error('profile configuration checksum mismatch');
  return parsed.payload;
}

export class ProfileConfigurationRuntime {
  constructor({ file, clock = () => Date.now() } = {}) {
    if (!file) throw new TypeError('file is required');
    this.file = path.resolve(file); this.clock = clock; this.state = { profiles: [] }; this.writeChain = Promise.resolve();
  }
  async open() { await mkdir(path.dirname(this.file), { recursive: true }); try { this.state = decode(await readFile(this.file, 'utf8')); } catch (error) { if (error?.code !== 'ENOENT') throw error; await this.#persist(); } return this.snapshot(); }
  async createProfile({ id, name, settings = {}, credentialRefs = {} } = {}) {
    const profileId = String(id ?? '').trim(); if (!profileId || !name) throw new Error('profile id and name are required');
    if (this.state.profiles.some((entry) => entry.id === profileId)) throw new Error(`profile already exists: ${profileId}`);
    const profile = { id: profileId, name: String(name), version: 1, settings: sanitize(settings), credentialRefs: this.#credentialRefs(credentialRefs), createdAt: this.clock(), updatedAt: this.clock() };
    await this.#mutate((draft) => draft.profiles.push(profile)); return Object.freeze(structuredClone(profile));
  }
  getProfile(id) { const found = this.state.profiles.find((entry) => entry.id === String(id)); return found ? Object.freeze(structuredClone(found)) : null; }
  listProfiles() { return Object.freeze(this.state.profiles.map((entry) => Object.freeze(structuredClone(entry))).sort((a, b) => a.id.localeCompare(b.id))); }
  async updateProfile(id, { expectedVersion, settings = {}, credentialRefs = {} } = {}) {
    let result;
    await this.#mutate((draft) => { const profile = draft.profiles.find((entry) => entry.id === String(id)); if (!profile) throw new Error(`unknown profile: ${id}`); if (Number(expectedVersion) !== profile.version) throw new Error(`profile version conflict: expected ${expectedVersion}, actual ${profile.version}`); profile.version += 1; profile.settings = { ...profile.settings, ...sanitize(settings) }; profile.credentialRefs = { ...profile.credentialRefs, ...this.#credentialRefs(credentialRefs) }; profile.updatedAt = this.clock(); result = structuredClone(profile); });
    return Object.freeze(result);
  }
  async renameProfile(id, { name, expectedVersion } = {}) { if (!String(name ?? '').trim()) throw new Error('profile name is required'); let result; await this.#mutate((draft) => { const profile = draft.profiles.find((entry) => entry.id === String(id)); if (!profile) throw new Error(`unknown profile: ${id}`); if (Number(expectedVersion) !== profile.version) throw new Error(`profile version conflict: expected ${expectedVersion}, actual ${profile.version}`); profile.name = String(name).trim(); profile.version += 1; profile.updatedAt = this.clock(); result = structuredClone(profile); }); return Object.freeze(result); }
  async deleteProfile(id, { expectedVersion } = {}) { let removed = null; await this.#mutate((draft) => { const index = draft.profiles.findIndex((entry) => entry.id === String(id)); if (index < 0) throw new Error(`unknown profile: ${id}`); if (Number(expectedVersion) !== draft.profiles[index].version) throw new Error(`profile version conflict: expected ${expectedVersion}, actual ${draft.profiles[index].version}`); removed = draft.profiles.splice(index, 1)[0]; }); return Object.freeze({ deleted: true, id: removed.id, version: removed.version }); }
  exportProfile(id) { const profile = this.getProfile(id); if (!profile) throw new Error(`unknown profile: ${id}`); const payload = { schema: 'nolane.agent.profile-export.v1', profile }; return Object.freeze({ ...payload, receiptSha256: sha256(JSON.stringify(payload)) }); }
  snapshot() { return Object.freeze({ schema: 'nolane.agent.profile-configuration-runtime-snapshot.v1', profiles: this.state.profiles.length, credentialReferences: this.state.profiles.reduce((sum, profile) => sum + Object.keys(profile.credentialRefs).length, 0) }); }
  #credentialRefs(input) { const out = {}; for (const [key, value] of Object.entries(input ?? {})) { if (!CREDENTIAL_REF.test(String(value))) throw new Error(`credential reference is invalid for ${key}`); out[key] = String(value); } return out; }
  async #mutate(mutator) { this.writeChain = this.writeChain.catch(() => {}).then(async () => { const draft = structuredClone(this.state); mutator(draft); this.state = draft; await this.#persist(); }); return this.writeChain; }
  async #persist() { await mkdir(path.dirname(this.file), { recursive: true }); const temp = `${this.file}.tmp-${process.pid}-${Date.now()}`; await writeFile(temp, encode(this.state), { mode: 0o600 }); await rename(temp, this.file); }
}
