export function createPlanArtifactRenderer() {
  let last = null;
  return Object.freeze({
    render(value = {}) {
      if (!String(value.outcome ?? '').trim()) throw new Error('Plan artifact requires outcome');
      if (!Array.isArray(value.steps) || value.steps.length === 0) throw new Error('Plan artifact requires steps');
      last = Object.freeze({ id: String(value.id), outcome: String(value.outcome), steps: Object.freeze(value.steps.map(String)), risk: String(value.risk ?? 'unknown'), assumptions: Object.freeze((value.assumptions ?? []).map(String)) });
      return last;
    },
    snapshot() { return last; },
    destroy() { last = null; },
  });
}
export const createRenderer = createPlanArtifactRenderer;
