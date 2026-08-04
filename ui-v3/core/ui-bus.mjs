export function createUiBus() {
  const listeners = new Map();
  return Object.freeze({
    on(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
      return () => listeners.get(type)?.delete(listener);
    },
    emit(type, detail) {
      for (const listener of listeners.get(type) ?? []) listener(detail);
    },
    clear() { listeners.clear(); },
  });
}
