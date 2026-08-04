export function createUiStore(initialState = {}) {
  let state = Object.freeze(structuredClone(initialState));
  const listeners = new Set();
  return Object.freeze({
    getState: () => state,
    dispatch(action) {
      if (!action || typeof action.type !== 'string') throw new TypeError('UI action requires a type');
      const reducer = action.reduce;
      const next = typeof reducer === 'function' ? reducer(state) : { ...state, ...(action.patch ?? {}) };
      state = Object.freeze(next);
      for (const listener of listeners) listener(state, action);
      return state;
    },
    select(selector, listener) {
      let previous = selector(state);
      const wrapped = (next, action) => {
        const value = selector(next);
        if (Object.is(value, previous)) return;
        const old = previous; previous = value; listener(value, old, action);
      };
      listeners.add(wrapped);
      return () => listeners.delete(wrapped);
    },
  });
}
