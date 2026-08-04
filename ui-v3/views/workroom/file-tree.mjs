let nodeIdentity = 0;
export function createFileTreeModel() {
  const nodes = new Map(); const keys = new Map();
  return Object.freeze({
    update(items = []) { for (const item of items) { if (!item?.id || !item.path) throw new Error('File tree node requires id and path'); const id = String(item.id); nodes.set(id, Object.freeze({ ...(nodes.get(id) ?? {}), ...item, id })); if (!keys.has(id)) keys.set(id, Object.freeze({ id, sequence: ++nodeIdentity })); } },
    remove(id) { nodes.delete(String(id)); keys.delete(String(id)); },
    snapshot({ offset = 0, limit = 200 } = {}) { const values = [...nodes.values()]; const start = Math.max(0, Number(offset) || 0); const count = Math.max(1, Number(limit) || 200); return Object.freeze({ nodes: Object.freeze(values.slice(start, start + count)), total: values.length, nodeKeys: new Map(keys), virtualized: values.length > count }); },
  });
}
