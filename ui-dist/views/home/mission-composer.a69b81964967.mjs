import { createMissionRequest } from '../../core/intent-presets.b8b6a1ae1be0.mjs';
export function submitMissionComposer(form, context = {}) {
  const values = Object.fromEntries(new FormData(form));
  return createMissionRequest({ ...context, objective: values.objective, intent: values.intent ?? 'build' });
}
