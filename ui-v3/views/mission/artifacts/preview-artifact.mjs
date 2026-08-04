const SHA256 = /^[a-f0-9]{64}$/i;
const STATUSES = new Set(['starting', 'loading', 'ready', 'app-error', 'disconnected']);
export function createPreviewArtifactRenderer() {
  let last = null; let polling = false;
  return Object.freeze({
    render(value = {}) {
      if (!STATUSES.has(value.status)) throw new Error(`Unknown preview status: ${value.status}`);
      if (value.status === 'ready' && !SHA256.test(value.snapshotSha256 ?? '')) throw new Error('Ready preview requires snapshot SHA256');
      if (value.status === 'ready' && !String(value.url ?? '').trim()) throw new Error('Ready preview requires URL');
      polling = ['starting', 'loading', 'ready'].includes(value.status);
      last = Object.freeze({ id: String(value.id), status: value.status, url: value.url ? String(value.url) : null, snapshotSha256: value.snapshotSha256?.toLowerCase?.() ?? null });
      return last;
    },
    suspend() { polling = false; },
    resume() { if (last && ['starting', 'loading', 'ready'].includes(last.status)) polling = true; },
    snapshot() { return Object.freeze({ value: last, polling }); },
    destroy() { polling = false; last = null; },
  });
}
export const createRenderer = createPreviewArtifactRenderer;
