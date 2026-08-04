const FILTERS = new Set(['all', 'needs-attention', 'risky', 'generated']);
const ORDER = Object.freeze(['added', 'modified', 'deleted', 'renamed']);
export function createChangeNavigatorModel() {
  const files = new Map(); let filter = 'all';
  return Object.freeze({
    update(items = []) { for (const item of items) { if (!item?.id || !item?.path) throw new Error('Changed file requires id and path'); const change = ORDER.includes(item.change) ? item.change : 'modified'; files.set(String(item.id), Object.freeze({ decision: 'pending', risk: 'unknown', generated: false, ...item, id: String(item.id), path: String(item.path), change })); } },
    setFilter(value) { if (!FILTERS.has(value)) throw new Error(`Unknown change filter: ${value}`); filter = value; },
    snapshot() {
      let visible = [...files.values()];
      if (filter === 'needs-attention') visible = visible.filter((item) => item.decision === 'pending' && ['high', 'medium'].includes(item.risk));
      if (filter === 'risky') visible = visible.filter((item) => item.risk === 'high');
      if (filter === 'generated') visible = visible.filter((item) => item.generated === true);
      visible.sort((a, b) => ORDER.indexOf(a.change) - ORDER.indexOf(b.change) || a.path.localeCompare(b.path));
      const groups = ORDER.map((change) => ({ change, count: visible.filter((item) => item.change === change).length })).filter((item) => item.count > 0).map(Object.freeze);
      return Object.freeze({ filter, files: Object.freeze(visible), groups: Object.freeze(groups), total: files.size });
    },
  });
}
