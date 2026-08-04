function freeze(value) { return Object.freeze(structuredClone(value)); }

const EMPTY = Object.freeze({ schema: 'nolane.desktop-update-state.v1', state: 'idle', ready: false, version: null, error: null });

export function createUpdateStateController({ desktop = globalThis.nolaneDesktop, onChange = () => {}, beforeInstall = async () => {} } = {}) {
  let state = EMPTY;
  let unsubscribe = null;
  const snapshot = () => state;
  const set = (value) => { state = freeze({ ...EMPTY, ...(value ?? {}) }); onChange(state); return state; };
  const failureState = Object.freeze({ checkForUpdates: 'checkFailed', downloadAvailableUpdate: 'downloadFailed', installUpdateAndRestart: 'installFailed', installStagedUpdate: 'installFailed' });
  const invoke = async (method) => {
    if (typeof desktop?.[method] !== 'function') return state;
    try { return set(await desktop[method]()); }
    catch (error) { return set({ ...state, state: failureState[method] ?? state.state, error: String(error?.message ?? error) }); }
  };
  return Object.freeze({
    snapshot,
    async load() {
      if (!desktop) return state;
      unsubscribe?.();
      unsubscribe = typeof desktop.onUpdateState === 'function' ? desktop.onUpdateState((value) => set(value)) : null;
      if (typeof desktop.getUpdateState === 'function') return set(await desktop.getUpdateState());
      if (typeof desktop.getUpdateStatus === 'function') return set(await desktop.getUpdateStatus());
      return state;
    },
    check: () => invoke('checkForUpdates'),
    download: () => invoke('downloadAvailableUpdate'),
    defer: () => invoke('deferUpdate'),
    ignore: () => invoke('ignoreVersion'),
    async install() {
      try { await beforeInstall(); }
      catch (error) { return set({ ...state, state: 'installFailed', error: String(error?.message ?? error) }); }
      return invoke(typeof desktop?.installUpdateAndRestart === 'function' ? 'installUpdateAndRestart' : 'installStagedUpdate');
    },
    destroy() { unsubscribe?.(); unsubscribe = null; }
  });
}
