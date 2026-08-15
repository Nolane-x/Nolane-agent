import { createMissionRequest } from '../../core/intent-presets.89a52165c648.mjs';
export function submitMissionComposer(form, context = {}) {
  const values = Object.fromEntries(new FormData(form));
  return createMissionRequest({ ...context, objective: values.objective, intent: values.intent ?? 'build' });
}
