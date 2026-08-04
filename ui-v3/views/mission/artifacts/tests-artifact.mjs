const SHA256 = /^[a-f0-9]{64}$/i;
export function createTestsArtifactRenderer() {
  let last = null;
  return Object.freeze({
    render(value = {}) {
      if (!SHA256.test(value.receiptSha256 ?? '')) throw new Error('Tests artifact requires receipt SHA256');
      const total = Number(value.total); const passed = Number(value.passed);
      if (!Number.isInteger(total) || total < 1 || !Number.isInteger(passed) || passed < 0 || passed > total) throw new Error('Tests artifact requires valid passed and total counts');
      last = Object.freeze({ id: String(value.id), passed, total, failed: total - passed, receiptSha256: value.receiptSha256.toLowerCase(), complete: passed === total });
      return last;
    },
    snapshot() { return last; },
    destroy() { last = null; },
  });
}
export const createRenderer = createTestsArtifactRenderer;
