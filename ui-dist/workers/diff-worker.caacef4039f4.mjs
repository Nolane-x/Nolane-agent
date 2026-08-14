export function chunkDiffHunks(hunks = [], { chunkSize = 100 } = {}) {
  const size = Math.max(1, Number(chunkSize) || 100); const chunks = [];
  for (let index = 0; index < hunks.length; index += size) chunks.push(Object.freeze(hunks.slice(index, index + size).map((item) => Object.freeze({ ...item }))));
  return Object.freeze(chunks);
}
export function createDiffWorkerJob({ hunks = [], chunkSize = 100 } = {}) {
  let cancelled = false; let yielded = 0; const chunks = chunkDiffHunks(hunks, { chunkSize });
  return Object.freeze({
    cancel() { cancelled = true; },
    async *run() { for (const chunk of chunks) { if (cancelled) return; yielded += chunk.length; yield Object.freeze({ hunks: chunk, yielded, total: hunks.length }); await Promise.resolve(); } },
    snapshot() { return Object.freeze({ cancelled, yielded, total: hunks.length }); },
  });
}
