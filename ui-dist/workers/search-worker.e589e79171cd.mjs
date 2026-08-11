export function createSearchWorkerJob({ items = [], query = '', limit = 100 } = {}) {
  let cancelled = false; let completed = false;
  return Object.freeze({
    cancel() { cancelled = true; },
    async run() { if (cancelled) return Object.freeze([]); const terms = String(query).toLocaleLowerCase().split(/\s+/).filter(Boolean); const ranked = items.map((item) => { const text = String(item.text ?? item.label ?? '').toLocaleLowerCase(); const score = terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0); return { item, score }; }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || String(a.item.id).localeCompare(String(b.item.id))).slice(0, Math.max(1, Number(limit) || 100)).map(({ item }) => Object.freeze({ ...item, id: String(item.id) })); completed = true; return Object.freeze(ranked); },
    snapshot() { return Object.freeze({ cancelled, completed, query: String(query), total: items.length }); },
  });
}
