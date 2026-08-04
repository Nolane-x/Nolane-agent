import { clone, deepFreeze } from './shared.mjs';
const KINDS = new Set(['localization','tool-policy','planning','recovery','verification']);
const HIDDEN = /(?:chain.?of.?thought|hidden.?reasoning|reasoning.?trace|private.?scratchpad)/i;
function scan(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (HIDDEN.test(key)) throw new TypeError(`Hidden reasoning is forbidden at ${path}.${key}`);
    scan(child, `${path}.${key}`);
  }
}
export function validateTrajectoryEpisode(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Trajectory episode is required');
  scan(input);
  for (const key of ['id','kind','state','action','expectedEffect','actualEffect','verifier','cost']) if (input[key] === undefined) throw new TypeError(`Trajectory requires ${key}`);
  if (!KINDS.has(input.kind)) throw new TypeError('Trajectory kind is unsupported');
  if (!input.state || typeof input.state !== 'object' || Array.isArray(input.state)) throw new TypeError('Trajectory state must be typed public state');
  if (!input.action?.type) throw new TypeError('Trajectory action type is required');
  if (input.verifier?.rewardHacking === true) throw new Error('Trajectory rejected for reward hacking');
  if (input.verifier?.valid !== true) throw new Error('Trajectory requires a valid verifier outcome');
  const changed = input.actualEffect?.changed === true || Number(input.actualEffect?.criterionDelta ?? 0) !== 0 || Number(input.actualEffect?.informationGain ?? 0) > 0;
  if (!changed) throw new Error('Trajectory action produced no verified effect');
  return deepFreeze(clone(input));
}
