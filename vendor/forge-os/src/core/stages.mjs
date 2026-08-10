import { STAGES } from './constants.mjs';
export { STAGES };

export function nextStage(stage) {
  const index = STAGES.indexOf(stage);
  if (index === -1) throw new Error(`Unknown stage: ${stage}`);
  return index === STAGES.length - 1 ? null : STAGES[index + 1];
}

export function assertTransition(from, to) {
  const expected = nextStage(from);
  if (expected !== to) throw new Error(`Illegal transition from ${from} to ${to}; expected ${expected ?? 'terminal'}`);
  return true;
}
