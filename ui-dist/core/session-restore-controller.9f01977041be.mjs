function freeze(value) { return Object.freeze(structuredClone(value)); }

export function createSessionRestoreController({ api, debounceMs = 300 } = {}) {
  if (!api?.get || !api?.patch || !api?.put || !api?.delete) throw new TypeError('Session restore controller requires a complete API client');
  let state = { status: 'idle', restore: null, drafts: {}, error: null };
  let restoreTimer = null;
  const draftTimers = new Map();
  let pendingRestore = null;
  const pendingDrafts = new Map();
  let chain = Promise.resolve();

  const snapshot = () => freeze(state);
  const run = (operation) => {
    chain = chain.then(operation, operation).catch((error) => {
      state = { ...state, status: 'error', error: String(error?.message ?? error) };
      return null;
    });
    return chain;
  };

  const persistRestore = (patch) => run(async () => {
    const restore = await api.patch('/api/session/restore', patch);
    state = { ...state, status: 'ready', restore, error: null };
    return restore;
  });

  const persistDraft = (scope, draft) => run(async () => {
    const saved = await api.put('/api/session/draft', { scope, draft });
    state = { ...state, status: 'ready', drafts: { ...state.drafts, [scope]: saved }, error: null };
    return saved;
  });

  return Object.freeze({
    snapshot,
    async load() {
      state = { ...state, status: 'loading', error: null };
      const [restoreResult, draftResult] = await Promise.allSettled([
        api.get('/api/session/restore'),
        api.get('/api/session/draft?scope=home')
      ]);
      state = {
        status: restoreResult.status === 'fulfilled' || draftResult.status === 'fulfilled' ? 'ready' : 'error',
        restore: restoreResult.status === 'fulfilled' ? restoreResult.value : null,
        drafts: { home: draftResult.status === 'fulfilled' ? draftResult.value?.draft ?? null : null },
        error: restoreResult.status === 'rejected' && draftResult.status === 'rejected' ? String(restoreResult.reason?.message ?? restoreResult.reason) : null
      };
      return snapshot();
    },
    scheduleRestore(patch) {
      pendingRestore = structuredClone(patch);
      clearTimeout(restoreTimer);
      restoreTimer = setTimeout(() => {
        restoreTimer = null;
        const value = pendingRestore;
        pendingRestore = null;
        if (value) persistRestore(value);
      }, Math.max(0, Number(debounceMs) || 0));
    },
    scheduleDraft(scope = 'home', draft = {}) {
      pendingDrafts.set(scope, structuredClone(draft));
      clearTimeout(draftTimers.get(scope));
      draftTimers.set(scope, setTimeout(() => {
        draftTimers.delete(scope);
        const value = pendingDrafts.get(scope);
        pendingDrafts.delete(scope);
        if (value) persistDraft(scope, value);
      }, Math.max(0, Number(debounceMs) || 0)));
    },
    async clearDraft(scope = 'home') {
      clearTimeout(draftTimers.get(scope));
      draftTimers.delete(scope);
      pendingDrafts.delete(scope);
      await run(() => api.delete(`/api/session/draft?scope=${encodeURIComponent(scope)}`));
      state = { ...state, drafts: { ...state.drafts, [scope]: null }, error: null };
      return snapshot();
    },
    async flush({ restorePatch = null, drafts = [] } = {}) {
      clearTimeout(restoreTimer); restoreTimer = null;
      for (const timer of draftTimers.values()) clearTimeout(timer);
      draftTimers.clear();
      const restoreValue = restorePatch ?? pendingRestore;
      pendingRestore = null;
      const draftValues = drafts.length ? drafts : [...pendingDrafts].map(([scope, draft]) => ({ scope, draft }));
      pendingDrafts.clear();
      if (restoreValue) await persistRestore(restoreValue);
      for (const item of draftValues) await persistDraft(item.scope ?? 'home', item.draft ?? {});
      await chain;
      return snapshot();
    },
    destroy() {
      clearTimeout(restoreTimer);
      pendingRestore = null;
      for (const timer of draftTimers.values()) clearTimeout(timer);
      draftTimers.clear();
      pendingDrafts.clear();
    }
  });
}
