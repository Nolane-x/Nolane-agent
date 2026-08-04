import path from 'node:path';
import { atomicWriteJson, readJson, redact, sha256 } from './native-runtime-utils.mjs';

const coded = (code, message) => Object.assign(new Error(message), { code });
const clone = (value) => structuredClone(value);
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
};
const stable = (value) => JSON.stringify(canonical(value));
const ensureReferenceOnly = (value, location = 'configuration') => {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (/(?:^|[_-])(secret|token|password|api[_-]?key)(?:$|[_-])/i.test(key) && !/ref$/i.test(key)) throw coded('RAW_CREDENTIAL_DENIED', `Raw credential field ${location}.${key} is denied`);
    ensureReferenceOnly(child, `${location}.${key}`);
  }
};

class SharedProductModelWave15 {
  constructor({ state, onChange }) { this.state = state; this.onChange = onChange; }
  apply({ type, payload = {}, expectedRevision } = {}) {
    if (!type) throw new TypeError('event type is required');
    if (expectedRevision !== undefined && expectedRevision !== this.state.product.revision) throw coded('PRODUCT_REVISION_CONFLICT', `Expected revision ${expectedRevision}, found ${this.state.product.revision}`);
    ensureReferenceOnly(payload, 'product-event');
    const product = this.state.product;
    const upsert = (collection, item) => { if (!item.id) throw new TypeError(`${type} payload id is required`); collection[String(item.id)] = redact(clone(item)); };
    switch (type) {
      case 'session.upsert': upsert(product.sessions, payload); break;
      case 'session.remove': delete product.sessions[String(payload.id)]; break;
      case 'command.register': upsert(product.commands, payload); break;
      case 'permission.update': upsert(product.permissions, payload); break;
      case 'provider.update': upsert(product.providers, payload); break;
      case 'profile.update': upsert(product.profiles, payload); break;
      case 'update.state': product.update = redact(clone(payload)); break;
      case 'tool.activity': upsert(product.toolActivity, payload); break;
      case 'delegation.update': upsert(product.delegations, payload); break;
      case 'runtime.health': product.runtimeHealth = redact(clone(payload)); break;
      case 'evidence.append': product.evidence.push(redact(clone(payload))); product.evidence = product.evidence.slice(-500); break;
      case 'error.reported': product.errors.push(redact(clone(payload))); product.errors = product.errors.slice(-100); break;
      default: throw coded('PRODUCT_EVENT_UNSUPPORTED', `Unsupported product event ${type}`);
    }
    product.revision += 1;
    const event = { revision: product.revision, type: String(type), payload: redact(clone(payload)) };
    product.eventHeadSha256 = sha256(`${product.eventHeadSha256 ?? ''}:${stable(event)}`);
    this.onChange?.();
    return clone(event);
  }
  snapshot() {
    const values = (record) => Object.values(record).sort((left, right) => String(left.id).localeCompare(String(right.id)));
    return {
      revision: this.state.product.revision,
      sessions: values(this.state.product.sessions), commands: values(this.state.product.commands), permissions: values(this.state.product.permissions),
      providers: values(this.state.product.providers), profiles: values(this.state.product.profiles), update: clone(this.state.product.update),
      toolActivity: values(this.state.product.toolActivity), delegations: values(this.state.product.delegations), runtimeHealth: clone(this.state.product.runtimeHealth),
      evidence: this.state.product.evidence.map(clone), errors: this.state.product.errors.map(clone), eventHeadSha256: this.state.product.eventHeadSha256,
    };
  }
}

class ConfigurationCoreWave15 {
  constructor({ state, onChange }) { this.state = state; this.onChange = onChange; }
  createProfile(input = {}) {
    if (!input.id || !input.name) throw new TypeError('profile id and name are required');
    const id = String(input.id); if (this.state.config.profiles[id]) throw coded('CONFIG_PROFILE_EXISTS', `Profile ${id} already exists`);
    ensureReferenceOnly(input, 'profile');
    if (input.credentialRef && !/^[a-z][a-z0-9+.-]*:/i.test(input.credentialRef)) throw coded('CREDENTIAL_REFERENCE_INVALID', 'credentialRef must use a reference scheme');
    const profile = { id, name: String(input.name), provider: input.provider ? String(input.provider) : null, model: input.model ? String(input.model) : null, credentialRef: input.credentialRef ? String(input.credentialRef) : null, toolset: [...new Set((input.toolset ?? []).map(String))], ssh: input.ssh ? redact(clone(input.ssh)) : null, version: 1 };
    this.state.config.profiles[id] = profile; this.onChange?.(); return clone(profile);
  }
  updateProfile({ id, expectedVersion, patch = {} } = {}) {
    const profile = this.state.config.profiles[String(id)]; if (!profile) throw coded('CONFIG_PROFILE_NOT_FOUND', `Profile ${id} not found`);
    if (expectedVersion !== profile.version) throw coded('CONFIG_VERSION_CONFLICT', `Expected profile version ${expectedVersion}, found ${profile.version}`);
    ensureReferenceOnly(patch, 'profile.patch');
    if (patch.credentialRef && !/^[a-z][a-z0-9+.-]*:/i.test(patch.credentialRef)) throw coded('CREDENTIAL_REFERENCE_INVALID', 'credentialRef must use a reference scheme');
    Object.assign(profile, redact(clone(patch)), { id: profile.id, version: profile.version + 1 }); this.onChange?.(); return clone(profile);
  }
  getProfile(id) { const profile = this.state.config.profiles[String(id)] ?? null; return profile ? clone(profile) : null; }
  listProfiles() { return Object.values(this.state.config.profiles).sort((a, b) => a.id.localeCompare(b.id)).map(clone); }
  deleteProfile({ id, routeSessionsTo = null } = {}) { const key = String(id); const profile = this.state.config.profiles[key]; if (!profile) return { deleted: false, id: key, routeSessionsTo }; delete this.state.config.profiles[key]; this.onChange?.(); return { deleted: true, id: key, routeSessionsTo: routeSessionsTo ? String(routeSessionsTo) : null, deletedVersion: profile.version }; }
  snapshot() { return { profiles: this.listProfiles(), revision: this.state.config.revision }; }
}

class BootstrapConnectionCoreWave15 {
  plan({ platform, backend, host = null, workspace, credentialRef = null } = {}) {
    if (!['win32', 'linux', 'darwin'].includes(String(platform)) || !['local', 'ssh'].includes(String(backend)) || typeof workspace !== 'string' || workspace.length < 1 || workspace.length > 4_096) throw coded('BOOTSTRAP_INPUT_INVALID', 'Bootstrap platform, backend or workspace is invalid');
    if (backend === 'ssh') {
      if (!credentialRef) throw coded('BOOTSTRAP_CREDENTIAL_REFERENCE_REQUIRED', 'SSH bootstrap requires a credential reference');
      if (!/^[A-Za-z0-9._-]+$/.test(String(host))) throw coded('BOOTSTRAP_INPUT_INVALID', 'SSH host is invalid');
    }
    const command = backend === 'ssh'
      ? { file: platform === 'win32' ? 'ssh.exe' : 'ssh', args: ['--', String(host), 'nolane-agent', 'bootstrap', '--workspace', workspace], shell: false }
      : { file: platform === 'win32' ? 'NolaneAgent.exe' : 'nolane-agent', args: ['bootstrap', '--workspace', workspace], shell: false };
    return { schema: 'nolane.bootstrap-plan.wave15.v1', platform: String(platform), backend: String(backend), host: host ? String(host) : null, workspace, credentialReferenceSha256: credentialRef ? sha256(String(credentialRef)) : null, command, receiptSha256: sha256(stable({ platform, backend, host, workspace, command })) };
  }
}

class ModelRegistryWave15 {
  constructor({ state, tier }) { this.state = state; this.tier = tier; }
  register(input = {}) { if (!input.id || !input.provider) throw new TypeError('model id and provider are required'); const model = { id: String(input.id), provider: String(input.provider), context: Number(input.context ?? 0), capabilities: [...new Set((input.capabilities ?? []).map(String))].sort(), tier: String(input.tier ?? 'community') }; this.state.models[model.id] = model; return clone(model); }
  search({ query = '', requiredCapabilities = [] } = {}) { const needle = String(query).toLowerCase(); const required = requiredCapabilities.map(String); return Object.values(this.state.models).filter((model) => `${model.id} ${model.provider}`.toLowerCase().includes(needle) && required.every((capability) => model.capabilities.includes(capability))).sort((a, b) => a.id.localeCompare(b.id)).map(clone); }
  select({ profileId, modelId } = {}) { const model = this.state.models[String(modelId)]; if (!model) throw coded('MODEL_NOT_FOUND', `Model ${modelId} not found`); const ranks = { community: 0, pro: 1, enterprise: 2 }; if ((ranks[this.tier] ?? 0) < (ranks[model.tier] ?? 0)) throw coded('ENTITLEMENT_REQUIRED', `${model.tier} entitlement required`); this.state.modelSelections[String(profileId)] = model.id; return { profileId: String(profileId), model: clone(model) }; }
  snapshot() { return { models: Object.values(this.state.models).sort((a, b) => a.id.localeCompare(b.id)).map(clone), selections: clone(this.state.modelSelections), entitlementTier: this.tier }; }
}

class ToolsetRegistryWave15 {
  constructor({ state }) { this.state = state; }
  define(input = {}) { if (!input.id) throw new TypeError('toolset id is required'); const toolset = { id: String(input.id), tools: [...new Set((input.tools ?? []).map(String))], permissions: [...new Set((input.permissions ?? []).map(String))].sort() }; this.state.toolsets[toolset.id] = toolset; return clone(toolset); }
  get(id) { const toolset = this.state.toolsets[String(id)]; if (!toolset) throw coded('TOOLSET_NOT_FOUND', `Toolset ${id} not found`); return clone(toolset); }
  snapshot() { return Object.values(this.state.toolsets).sort((a, b) => a.id.localeCompare(b.id)).map(clone); }
}

class UpdateLifecycleWave15 {
  constructor({ state, onChange }) { this.state = state; this.onChange = onChange; }
  stage({ version, verified, assetSha256 } = {}) { if (!verified) throw coded('UPDATE_UNVERIFIED', 'Only verified updates can be staged'); if (!version || !/^[a-f0-9]{64}$/.test(String(assetSha256))) throw coded('UPDATE_METADATA_INVALID', 'Update version and SHA-256 are required'); this.state.update = { state: 'staged', version: String(version), assetSha256: String(assetSha256), rebuildRequired: false, rebuildReason: null }; this.onChange?.(this.state.update); return this.snapshot(); }
  markRebuildRequired({ reason } = {}) { if (this.state.update.state !== 'staged') throw coded('UPDATE_STATE_CONFLICT', 'Update must be staged before rebuild'); this.state.update.rebuildRequired = true; this.state.update.rebuildReason = String(reason ?? 'native-module'); this.onChange?.(this.state.update); return this.snapshot(); }
  readyToRelaunch() { if (!['staged', 'rebuild-required'].includes(this.state.update.state) && this.state.update.state !== 'staged') throw coded('UPDATE_STATE_CONFLICT', 'Update is not staged'); this.state.update.state = 'ready-to-relaunch'; this.onChange?.(this.state.update); return this.snapshot(); }
  reset({ reason = 'rollback' } = {}) { this.state.update = { state: 'idle', version: null, assetSha256: null, rebuildRequired: false, rebuildReason: null, resetReason: String(reason) }; this.onChange?.(this.state.update); return this.snapshot(); }
  snapshot() { return clone(this.state.update); }
}

export class ProductConfigurationRuntimeWave15 {
  constructor({ file, entitlementTier = 'community' } = {}) {
    if (!file) throw new TypeError('file is required'); this.file = path.resolve(file); this.entitlementTier = entitlementTier;
    this.state = { schema: 'nolane.product-configuration.wave15.v1', product: { revision: 0, sessions: {}, commands: {}, permissions: {}, providers: {}, profiles: {}, update: { state: 'idle' }, toolActivity: {}, delegations: {}, runtimeHealth: { status: 'unknown' }, evidence: [], errors: [], eventHeadSha256: null }, config: { revision: 0, profiles: {} }, models: {}, modelSelections: {}, toolsets: {}, update: { state: 'idle', version: null, assetSha256: null, rebuildRequired: false, rebuildReason: null } };
    const changed = () => { this.state.config.revision += 1; };
    this.product = new SharedProductModelWave15({ state: this.state, onChange: changed });
    this.config = new ConfigurationCoreWave15({ state: this.state, onChange: changed });
    this.bootstrap = new BootstrapConnectionCoreWave15();
    this.models = new ModelRegistryWave15({ state: this.state, tier: entitlementTier });
    this.toolsets = new ToolsetRegistryWave15({ state: this.state });
    this.updates = new UpdateLifecycleWave15({ state: this.state, onChange: (update) => { this.product.apply({ type: 'update.state', payload: update }); } });
  }
  async open() { const stored = await readJson(this.file, null); if (stored) { if (stored.schema !== this.state.schema) throw coded('PRODUCT_CONFIG_STORE_INVALID', 'Product configuration schema is invalid'); Object.assign(this.state, stored); } return this.snapshot(); }
  async persist() { await atomicWriteJson(this.file, this.state); }
  project(surface) { if (!['electron', 'web', 'tui', 'cli', 'vscode'].includes(String(surface))) throw coded('PRODUCT_SURFACE_UNKNOWN', `Unknown product surface ${surface}`); const state = this.product.snapshot(); const stateReceiptSha256 = sha256(stable(state)); return { schema: 'nolane.product-projection.wave15.v1', surface: String(surface), state, stateReceiptSha256, capabilities: { sessions: true, commands: true, permissions: true, profiles: true, updates: true, toolActivity: true, delegation: true, runtimeHealth: true, evidence: true } }; }
  snapshot() { const snapshot = { schema: this.state.schema, product: this.product.snapshot(), configuration: this.config.snapshot(), models: this.models.snapshot(), toolsets: this.toolsets.snapshot(), update: this.updates.snapshot(), entitlementTier: this.entitlementTier }; return { ...snapshot, receiptSha256: sha256(stable(snapshot)) }; }
}
