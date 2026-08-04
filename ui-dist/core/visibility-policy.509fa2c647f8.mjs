export function createVisibilityPolicy() {
  const surfaces = new Map();
  return Object.freeze({
    register(id, lifecycle = {}) {
      const key = String(id ?? '').trim(); if (!key) throw new Error('Visibility surface requires id');
      if (surfaces.has(key)) throw new Error(`Duplicate visibility surface: ${key}`);
      surfaces.set(key, { visible: true, lifecycle });
      return () => surfaces.delete(key);
    },
    setVisible(id, visible) {
      const entry = surfaces.get(String(id)); if (!entry) return false;
      const next = Boolean(visible); if (entry.visible === next) return true;
      entry.visible = next; if (next) entry.lifecycle.resume?.(); else entry.lifecycle.suspend?.(); return true;
    },
    suspendAll() { for (const [id] of surfaces) this.setVisible(id, false); },
    snapshot() { return Object.freeze([...surfaces].map(([id, entry]) => Object.freeze({ id, visible: entry.visible }))); },
  });
}
