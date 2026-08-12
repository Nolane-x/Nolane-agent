import { createMissionRequest } from '../../core/intent-presets.a5ad7725a6f6.mjs';
export function submitMissionComposer(form, context = {}) {
  const values = Object.fromEntries(new FormData(form));
  return createMissionRequest({ ...context, objective: values.objective, intent: values.intent ?? 'build' });
}
