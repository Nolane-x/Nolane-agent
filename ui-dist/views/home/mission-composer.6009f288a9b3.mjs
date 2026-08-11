import { createMissionRequest } from '../../core/intent-presets.e55378f58f78.mjs';
export function submitMissionComposer(form, context = {}) {
  const values = Object.fromEntries(new FormData(form));
  return createMissionRequest({ ...context, objective: values.objective, intent: values.intent ?? 'build' });
}
