const DEFAULTS = Object.freeze({
  language: 'system', primaryUse: 'chat', explanationDepth: 'balanced', responseStyle: 'direct', askBeforeAmbiguousChanges: true,
  experience: 'everyday', defaultIntent: 'ask', theme: 'system', accent: 'violet', density: 'comfortable', motion: 'system',
  memoryMode: 'approved', notifications: { desktop: true, taskCompletion: true, approvals: true, errors: true }, telemetry: false
});

function setAt(root, path, value) {
  const next = structuredClone(root ?? {}); const parts = String(path).split('.'); let node = next;
  for (const part of parts.slice(0, -1)) node = node[part] ??= {};
  node[parts.at(-1)] = value; return next;
}

export function createOnboardingController({ api } = {}) {
  if (!api) throw new TypeError('api is required');
  let state = { status: 'idle', required: true, step: 0, answers: structuredClone(DEFAULTS), error: null, saving: false, completed: false };
  const snapshot = () => Object.freeze(structuredClone(state));
  return Object.freeze({
    snapshot,
    async load() {
      state = { ...state, status: 'loading', error: null };
      try {
        const result = await api.get('/api/onboarding/status');
        state = { ...state, status: 'ready', required: Boolean(result.required), step: Number(result.state?.currentStep) || 0, answers: { ...structuredClone(DEFAULTS), ...(result.state?.draft ?? {}), notifications: { ...DEFAULTS.notifications, ...(result.state?.draft?.notifications ?? {}) } }, completed: result.state?.completed === true };
      } catch (error) { state = { ...state, status: 'error', error: String(error?.message ?? error) }; }
      return snapshot();
    },
    set(path, value) { state = { ...state, answers: setAt(state.answers, path, value), error: null }; return snapshot(); },
    async persist() { try { await api.post('/api/onboarding/progress', { currentStep: state.step, answers: state.answers }); } catch (error) { state = { ...state, error: String(error?.message ?? error) }; } return snapshot(); },
    async next() { if (state.step >= 3) return snapshot(); state = { ...state, saving: true }; try { const next = state.step + 1; await api.post('/api/onboarding/progress', { currentStep: next, answers: state.answers }); state = { ...state, step: next, saving: false }; } catch (error) { state = { ...state, saving: false, error: String(error?.message ?? error) }; } return snapshot(); },
    async back() { const next = Math.max(0, state.step - 1); state = { ...state, step: next, saving: true }; try { await api.post('/api/onboarding/progress', { currentStep: next, answers: state.answers }); state = { ...state, saving: false }; } catch (error) { state = { ...state, saving: false, error: String(error?.message ?? error) }; } return snapshot(); },
    async complete() { state = { ...state, saving: true, error: null }; try { const result = await api.post('/api/onboarding/complete', { answers: state.answers, source: 'guided' }); state = { ...state, saving: false, completed: true, required: false, profile: result.profile }; } catch (error) { state = { ...state, saving: false, error: String(error?.message ?? error) }; } return snapshot(); },
    async recommended() { state = { ...state, saving: true, error: null }; try { const result = await api.post('/api/onboarding/recommended', { primaryUse: state.answers.primaryUse }); state = { ...state, saving: false, completed: true, required: false, profile: result.profile }; } catch (error) { state = { ...state, saving: false, error: String(error?.message ?? error) }; } return snapshot(); },
    async skip() { state = { ...state, saving: true, error: null }; try { const result = await api.post('/api/onboarding/skip', {}); state = { ...state, saving: false, completed: true, required: false, profile: result.profile }; } catch (error) { state = { ...state, saving: false, error: String(error?.message ?? error) }; } return snapshot(); }
  });
}
