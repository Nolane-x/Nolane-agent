import { deepFreeze } from './shared.mjs';
function dominates(a, b) { return a.quality >= b.quality && a.cost <= b.cost && a.risk <= b.risk && (a.quality > b.quality || a.cost < b.cost || a.risk < b.risk); }
export function paretoRankCandidates(input) {
  if (!Array.isArray(input)) throw new TypeError('Candidates must be an array');
  const values = input.map((x) => ({ ...x, quality: Number(x.quality), cost: Number(x.cost), risk: Number(x.risk) }));
  return deepFreeze(values.map((candidate) => ({ ...candidate, pareto: !values.some((other) => other !== candidate && dominates(other, candidate)), tieBreakScore: candidate.quality - candidate.risk - candidate.cost * 0.001 })).sort((a,b) => Number(b.pareto)-Number(a.pareto) || b.tieBreakScore-a.tieBreakScore));
}
