import { normalizeExperience } from '../../core/experience-policy.eaa3fcde7cad.mjs';
function at(root, path) { return String(path).split('.').reduce((value, key) => value?.[key], root); }
function setAt(root, path, value) { const next = structuredClone(root ?? {}); const parts = String(path).split('.'); let node = next; for (const part of parts.slice(0,-1)) node = node[part] ??= {}; node[parts.at(-1)] = value; return next; }
function visible(catalog, experience, query) {
  const needle = String(query ?? '').trim().toLowerCase();
  return (catalog?.categories ?? [])
    .filter((category) => ['research','expert'].includes(experience) || category.level !== 'research')
    .map((category) => ({ ...category, fields: (category.fields ?? []).filter((field) => (['research','expert'].includes(experience) || field.level !== 'research') && (!needle || `${category.title} ${category.description ?? ''} ${field.title} ${field.description ?? ''} ${field.path} ${(field.aliases ?? []).join(' ')}`.toLowerCase().includes(needle))) }))
    .filter((category) => !needle || category.fields.length || `${category.title} ${category.description ?? ''}`.toLowerCase().includes(needle));
}
function normalizeProviders(payload) { return Array.isArray(payload) ? payload : Array.isArray(payload?.providers) ? payload.providers : []; }
function normalizeModels(payload) { return payload && typeof payload === 'object' && Array.isArray(payload.models) ? payload : { models: [] }; }
function errorEntry(error) { return { message: String(error?.message ?? error ?? 'Unknown error'), status: error?.status ?? null, details: error?.payload?.details ?? null }; }
function bounded(value, limit) { const text = String(value ?? '').trim(); return text ? text.slice(0, limit) : null; }
function trustedAuthUrl(value) {
  try { const url = new URL(String(value ?? '')); return url.protocol === 'https:' ? url.toString() : null; }
  catch { return null; }
}
function providerLoginReceipt(providerId, type, result = {}) {
  return Object.freeze({
    providerId: String(providerId),
    type: String(type),
    loginId: bounded(result.loginId, 200),
    authUrl: trustedAuthUrl(result.authUrl ?? result.verificationUrl),
    userCode: bounded(result.userCode ?? result.deviceCode, 80),
    launched: result.launched === true,
  });
}

export function createSettingsController({ api, projectId = null } = {}) {
  if (!api) throw new TypeError('api is required');
  let state = {
    status: 'idle', catalog: null, value: {}, draft: {}, provenance: {}, warnings: [], errors: [], query: '',
    activeCategory: 'general', experience: 'everyday', saving: false, dirty: false, layer: 'user', models: { models: [] },
    providers: [], providerLogin: null, action: null, statusMessage: 'Settings are ready.', modelComparison: { selected: [], result: null }, modelDossiers: {},
  };
  const snapshot = () => Object.freeze({ ...structuredClone(state), visibleCategories: visible(state.catalog, state.experience, state.query) });
  const mergeProfiles = (payload) => {
    const next = payload?.profiles ?? payload;
    if (next?.models) state.models = normalizeModels(next);
    else if (payload?.profile) {
      const current = state.models?.models ?? [];
      const profile = payload.profile;
      state.models = { ...state.models, models: [...current.filter((entry) => entry.key !== profile.key), profile] };
    }
  };
  const apiObject = {
    snapshot,
    async load() {
      state.status = 'loading'; state.statusMessage = 'Loading settings…';
      try {
        const suffix = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
        const [catalog, effective, models, providers] = await Promise.all([
          api.get('/api/settings/catalog'),
          api.get(`/api/settings/effective${suffix}`),
          api.get('/api/model-profiles').catch(() => ({ models: [] })),
          api.get('/api/provider-connections').catch(() => []),
        ]);
        const value = effective.value ?? {};
        state = { ...state, status: 'ready', catalog, value, draft: structuredClone(value), provenance: effective.provenance ?? {}, warnings: effective.warnings ?? [], errors: [], experience: normalizeExperience(value?.experience?.level ?? 'everyday'), models: normalizeModels(models), providers: normalizeProviders(providers), dirty: false, statusMessage: 'Settings loaded.' };
      } catch (error) { state = { ...state, status: 'error', errors: [errorEntry(error)], statusMessage: 'Settings failed to load.' }; }
      return snapshot();
    },
    search(query) { state.query = String(query ?? ''); return snapshot(); },
    selectCategory(id) { state.activeCategory = String(id); return snapshot(); },
    setLayer(layer) { if (!['user','project','local'].includes(layer)) throw new Error('Unknown settings layer'); if (layer !== 'user' && !projectId) throw new Error('Project and local settings require a project'); state.layer = layer; return snapshot(); },
    setExperience(level) { const compatibleLevel = level === 'research' ? 'expert' : level === 'standard' ? 'workspace' : level; const normalized = normalizeExperience(compatibleLevel); state.experience = normalized; state.draft = setAt(state.draft, 'experience.level', normalized); state.dirty = true; state.statusMessage = `${normalized[0].toUpperCase()+normalized.slice(1)} experience selected.`; return snapshot(); },
    set(path, value) { state.draft = setAt(state.draft, path, value); state.dirty = true; state.errors = []; state.statusMessage = 'Unsaved changes.'; return snapshot(); },
    get(path) { return at(state.draft, path); },
    async save({ layer = state.layer } = {}) {
      state.saving = true; state.action = 'save'; state.statusMessage = 'Saving settings…';
      try {
        const result = await api.put('/api/settings', { layer, projectId, patch: state.draft });
        const value = result.effective?.value ?? result.value ?? state.draft;
        state = { ...state, saving: false, action: null, value, draft: structuredClone(value), provenance: result.effective?.provenance ?? state.provenance, warnings: result.effective?.warnings ?? state.warnings, errors: [], experience: normalizeExperience(value?.experience?.level ?? state.experience), dirty: false, statusMessage: `Settings saved to ${layer} scope.` };
      } catch (error) { state = { ...state, saving: false, action: null, errors: [errorEntry(error)], statusMessage: 'Settings were not saved.' }; }
      return snapshot();
    },
    async reset({ layer = state.layer, paths = null } = {}) {
      state.action = 'reset'; state.statusMessage = 'Resetting settings…';
      try {
        const result = await api.post('/api/settings/reset', { layer, projectId, paths });
        const value = result.effective?.value ?? {};
        state = { ...state, action: null, value, draft: structuredClone(value), provenance: result.effective?.provenance ?? {}, warnings: result.effective?.warnings ?? [], errors: [], experience: normalizeExperience(value?.experience?.level ?? 'everyday'), dirty: false, statusMessage: paths == null ? `All ${layer} overrides reset.` : 'Selected settings reset.' };
      } catch (error) { state = { ...state, action: null, errors: [errorEntry(error)], statusMessage: 'Settings reset failed.' }; }
      return snapshot();
    },

    toggleModelComparison(modelId) {
      const id = String(modelId ?? '');
      const selected = new Set(state.modelComparison?.selected ?? []);
      if (selected.has(id)) selected.delete(id); else if (selected.size < 5) selected.add(id);
      state.modelComparison = { selected: [...selected], result: null };
      state.statusMessage = `${selected.size} model deployment${selected.size === 1 ? '' : 's'} selected.`;
      return snapshot();
    },
    clearModelComparison() { state.modelComparison = { selected: [], result: null }; state.statusMessage = 'Model comparison cleared.'; return snapshot(); },
    async compareModels(request = {}) {
      const selected = state.modelComparison?.selected ?? [];
      if (selected.length < 2) throw new Error('Select at least two model deployments');
      state.action = 'compare-models'; state.statusMessage = 'Comparing model deployments…';
      try {
        const result = await api.post('/api/model-intelligence/compare', { modelIds: selected, request });
        state = { ...state, action: null, modelComparison: { selected, result }, errors: [], statusMessage: `Compared ${result.rows?.length ?? selected.length} model deployments.` };
      } catch (error) { state = { ...state, action: null, errors: [errorEntry(error)], statusMessage: 'Model comparison failed.' }; }
      return snapshot();
    },
    async inspectModel(modelId) {
      const id = String(modelId ?? '');
      state.action = `dossier:${id}`; state.statusMessage = `Loading canonical dossier for ${id}…`;
      try {
        const dossier = await api.get(`/api/model-management/dossier?modelId=${encodeURIComponent(id)}`);
        state = { ...state, action: null, modelDossiers: { ...state.modelDossiers, [id]: dossier }, errors: [], statusMessage: `Canonical dossier loaded for ${id}.` };
      } catch (error) { state = { ...state, action: null, errors: [errorEntry(error)], statusMessage: `Dossier failed for ${id}.` }; }
      return snapshot();
    },
    async startProviderLogin(providerId, type) {
      const id = String(providerId ?? '').trim();
      const loginType = String(type ?? '').trim();
      state.action = `provider-login:${id}`; state.statusMessage = `Opening account login for ${id}…`;
      try {
        const result = await api.post(`/api/provider-connections/${encodeURIComponent(id)}/login`, { type: loginType });
        state = { ...state, action: null, providerLogin: providerLoginReceipt(id, loginType, result), errors: [], statusMessage: `Continue sign-in for ${id} in the browser.` };
      } catch (error) { state = { ...state, action: null, providerLogin: null, errors: [errorEntry(error)], statusMessage: `Provider sign-in failed for ${id}.` }; }
      return snapshot();
    },
    async refreshProviders() {
      state.action = 'refresh-providers'; state.statusMessage = 'Refreshing provider accounts…';
      try {
        await api.post('/api/provider-connections/refresh', {});
        const providers = await api.get('/api/provider-connections');
        state = { ...state, action: null, providers: normalizeProviders(providers), errors: [], statusMessage: 'Provider account status refreshed.' };
      } catch (error) { state = { ...state, action: null, errors: [errorEntry(error)], statusMessage: 'Provider account refresh failed.' }; }
      return snapshot();
    },
    async logoutProvider(providerId) {
      const id = String(providerId ?? '').trim();
      state.action = `provider-logout:${id}`; state.statusMessage = `Signing out of ${id}…`;
      try {
        await api.post(`/api/provider-connections/${encodeURIComponent(id)}/logout`, {});
        const providers = await api.get('/api/provider-connections').catch(() => state.providers);
        state = { ...state, action: null, providers: normalizeProviders(providers), providerLogin: null, errors: [], statusMessage: `Signed out of ${id}.` };
      } catch (error) { state = { ...state, action: null, errors: [errorEntry(error)], statusMessage: `Provider sign-out failed for ${id}.` }; }
      return snapshot();
    },
    async configureProvider({ id, kind, model, baseUrl = '', apiKey = '' } = {}) {
      const providerId = String(id ?? '').trim() || String(kind ?? 'provider');
      state.action = `configure:${providerId}`; state.statusMessage = `Configuring provider ${providerId}…`;
      try {
        const payload = {
          id: String(id ?? '').trim(),
          kind: String(kind ?? '').trim(),
          model: String(model ?? '').trim(),
          ...(String(baseUrl ?? '').trim() ? { baseUrl: String(baseUrl).trim() } : {}),
          ...(String(apiKey ?? '') ? { apiKey: String(apiKey) } : {}),
          testConnection: true,
        };
        await api.post('/api/provider-connections/configure', payload);
        const [providers, models] = await Promise.all([
          api.get('/api/provider-connections').catch(() => state.providers),
          api.get('/api/model-profiles').catch(() => state.models),
        ]);
        state = { ...state, action: null, providers: normalizeProviders(providers), models: normalizeModels(models), errors: [], statusMessage: `Provider ${providerId} configured.` };
      } catch (error) {
        state = { ...state, action: null, errors: [errorEntry(error)], statusMessage: `Provider ${providerId} was not configured.` };
      }
      return snapshot();
    },
    async verifyProvider(providerId) {
      const id = String(providerId ?? '').trim();
      state.action = `provider-verify:${id}`; state.statusMessage = `Verifying ${id} through its governed CLI path…`;
      try {
        await api.post(`/api/provider-connections/${encodeURIComponent(id)}/test`, {});
        const providers = await api.get('/api/provider-connections').catch(() => state.providers);
        state = { ...state, action: null, providers: normalizeProviders(providers), errors: [], statusMessage: `Provider ${id} is ready.` };
      } catch (error) { state = { ...state, action: null, errors: [errorEntry(error)], statusMessage: `Provider verification failed for ${id}.` }; }
      return snapshot();
    },
    async selectProviderModel(providerId, modelId, { testConnection = true } = {}) {
      const cleanProvider = String(providerId ?? '').trim();
      const cleanModel = String(modelId ?? '').trim();
      state.action = `select-model:${cleanProvider}/${cleanModel}`; state.statusMessage = `Selecting ${cleanModel} for ${cleanProvider}…`;
      try {
        await api.post('/api/provider-connections/select-model', { providerId: cleanProvider, modelId: cleanModel, testConnection });
        const [providers, models] = await Promise.all([
          api.get('/api/provider-connections').catch(() => state.providers),
          api.get('/api/model-profiles').catch(() => state.models),
        ]);
        state = { ...state, action: null, providers: normalizeProviders(providers), models: normalizeModels(models), errors: [], statusMessage: `Selected ${cleanModel} for ${cleanProvider}.` };
      } catch (error) {
        state = { ...state, action: null, errors: [errorEntry(error)], statusMessage: `Model ${cleanModel || 'selection'} was not applied.` };
      }
      return snapshot();
    },
    async discoverModels(providerId) {
      state.action = `discover:${providerId}`; state.statusMessage = `Discovering models for ${providerId}…`;
      try {
        const result = await api.post('/api/model-profiles/discover', { providerId });
        mergeProfiles(result);
        const latest = await api.get('/api/model-profiles').catch(() => null);
        if (latest) state.models = normalizeModels(latest);
        state = { ...state, action: null, errors: [], statusMessage: `Model discovery completed for ${providerId}.` };
      } catch (error) { state = { ...state, action: null, errors: [errorEntry(error)], statusMessage: `Model discovery failed for ${providerId}.` }; }
      return snapshot();
    },
    async addModel(providerId, modelId, displayName = '') {
      const cleanProvider = String(providerId ?? '').trim();
      const cleanModel = String(modelId ?? '').trim();
      state.action = `add-model:${cleanProvider}/${cleanModel}`;
      state.statusMessage = `Adding model ${cleanModel}…`;
      try {
        const result = await api.post('/api/model-profiles', { providerId: cleanProvider, modelId: cleanModel, ...(String(displayName ?? '').trim() ? { displayName: String(displayName).trim() } : {}) });
        mergeProfiles(result);
        const latest = await api.get('/api/model-profiles').catch(() => null);
        if (latest) state.models = normalizeModels(latest);
        state = { ...state, action: null, errors: [], statusMessage: `Model ${cleanModel} added to ${cleanProvider}.` };
      } catch (error) { state = { ...state, action: null, errors: [errorEntry(error)], statusMessage: `Model ${cleanModel || 'entry'} was not added.` }; }
      return snapshot();
    },
    async probeModel(providerId, modelId, probes = ['text','tools','structuredOutput','streaming']) {
      state.action = `probe:${providerId}/${modelId}`; state.statusMessage = `Probing ${modelId}…`;
      try {
        const result = await api.post('/api/model-profiles/probe', { providerId, modelId, probes });
        mergeProfiles(result);
        const latest = await api.get('/api/model-profiles').catch(() => null);
        if (latest) state.models = normalizeModels(latest);
        state = { ...state, action: null, errors: [], statusMessage: `Capability probe completed for ${modelId}.` };
      } catch (error) { state = { ...state, action: null, errors: [errorEntry(error)], statusMessage: `Capability probe failed for ${modelId}.` }; }
      return snapshot();
    },
  };
  return Object.freeze(apiObject);
}
