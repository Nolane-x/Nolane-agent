import { canonicalStringify } from './shared.mjs';
const ALLOWED = new Set(['goal','criteriaOpen','evidenceIds','repoFocus','lastEffect','allowedActions','budget','taskType','uncertainty']);
export function serializeTypedModelState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new TypeError('Typed state object is required');
  const projected = Object.fromEntries(Object.entries(state).filter(([key]) => ALLOWED.has(key)));
  return canonicalStringify(projected);
}
