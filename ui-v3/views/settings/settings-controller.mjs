import { normalizeExperience } from '../../core/experience-policy.mjs';
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

export function createSettingsController({ api, projectId = null } = {}) {
  if (!api) throw new TypeError('api is required');
  let state = {
    status: 'idle', catalog: null, value: {}, draft: {}, provenance: {}, warnings: [], errors: [], query: '',
    activeCategory: 'general', experience: 'everyday', saving: false, dirty: false, layer: 'user', models: { models: [] },
    providers: [], action: null, statusMessage: 'Settings are ready.', modelComparison: { selected: [], result: null }, modelDossiers: {},
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
