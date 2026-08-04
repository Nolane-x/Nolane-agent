export function createDiffViewportModel({ overscan = 6 } = {}) {
  let hunks = Object.freeze([]); let offset = 0; let limit = 50; let destroyed = false;
  const extra = Math.max(0, Number(overscan) || 0);
  const assertAlive = () => { if (destroyed) throw new Error('Diff viewport is destroyed'); };
  return Object.freeze({
    update(items = []) { assertAlive(); hunks = Object.freeze(items.map((item) => Object.freeze({ ...item, id: String(item.id) }))); },
    setWindow(value = {}) { assertAlive(); offset = Math.max(0, Number(value.offset) || 0); limit = Math.max(1, Number(value.limit) || 50); },
    snapshot() { const start = Math.max(0, offset - extra); const end = Math.min(hunks.length, offset + limit); return Object.freeze({ total: hunks.length, offset, limit, overscan: extra, visible: Object.freeze(hunks.slice(start, end)), virtualized: hunks.length > limit, destroyed }); },
    destroy() { hunks = Object.freeze([]); destroyed = true; },
  });
}
