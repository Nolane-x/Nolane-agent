function allowed(skill, context) {
  const c = skill.contract;
  if (!c || ['quarantined','deprecated'].includes(c.status)) return false;
  if (context.assurance && !c.assurance.includes(context.assurance)) return false;
  if (context.domain && context.domain !== 'all' && !(c.domains.includes('all') || c.domains.includes(context.domain))) return false;
  return true;
}

export function reachableArtifacts(catalog, initial = []) {
  const reachable = new Set(initial);
  let changed = true;
  while (changed) {
    changed = false;
    for (const skill of catalog) {
      const c = skill.contract;
      if (!c || ['quarantined','deprecated'].includes(c.status)) continue;
      if ((c.consumes ?? []).every((input) => reachable.has(input))) {
        for (const output of c.produces ?? []) if (!reachable.has(output)) { reachable.add(output); changed = true; }
      }
    }
  }
  return reachable;
}

export function planToArtifact(catalog, target, available = [], context = {}) {
  const initiallyAvailable = new Set(available);
  const producers = new Map();
  for (const skill of catalog.filter((item) => allowed(item, context))) {
    for (const output of skill.contract.produces ?? []) {
      if (!producers.has(output)) producers.set(output, []);
      producers.get(output).push(skill);
    }
  }
  for (const list of producers.values()) list.sort((a, b) => {
    const stable = Number(b.contract.status === 'stable') - Number(a.contract.status === 'stable');
    return stable || (a.contract.context?.estimatedTokens ?? 0) - (b.contract.context?.estimatedTokens ?? 0) || a.name.localeCompare(b.name);
  });
  const memo = new Map();
  const visiting = new Set();

  function solve(output) {
    if (initiallyAvailable.has(output)) return { steps: [], artifacts: new Set([output]), cost: 0 };
    if (memo.has(output)) return memo.get(output);
    if (visiting.has(output)) return null;
    visiting.add(output);
    let best = null;
    for (const skill of producers.get(output) ?? []) {
      const subplans = [];
      let possible = true;
      for (const input of skill.contract.consumes ?? []) {
        const subplan = solve(input);
        if (!subplan) { possible = false; break; }
        subplans.push(subplan);
      }
      if (!possible) continue;
      const byName = new Map();
      for (const subplan of subplans) for (const step of subplan.steps) byName.set(step.skill, step);
      const step = { skill: skill.name, consumes: [...skill.contract.consumes], optionalConsumes: [...(skill.contract.optionalConsumes ?? [])], produces: [...skill.contract.produces], target: output, estimatedTokens: skill.contract.context?.estimatedTokens ?? 0 };
      byName.set(skill.name, step);
      const steps = [...byName.values()];
      const cost = steps.reduce((sum, item) => sum + item.estimatedTokens, 0) + steps.length * 10_000 - Number(skill.contract.status === 'stable') * 1_000;
      if (!best || cost < best.cost || (cost === best.cost && steps.map((item) => item.skill).join('|') < best.steps.map((item) => item.skill).join('|'))) {
        best = { steps, artifacts: new Set([...subplans.flatMap((plan) => [...plan.artifacts]), ...skill.contract.produces]), cost };
      }
    }
    visiting.delete(output);
    memo.set(output, best);
    return best;
  }

  const result = solve(target);
  if (!result) throw new Error(`No typed skill path can produce ${target} from [${[...initiallyAvailable].join(', ')}]`);
  return { target, available: [...initiallyAvailable], steps: result.steps, estimatedTokens: result.steps.reduce((sum, step) => sum + step.estimatedTokens, 0) };
}
