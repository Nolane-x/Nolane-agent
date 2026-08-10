const has = (array, value) => Array.isArray(array) && array.includes(value);
const fact = (context, key) => context.facts?.[key] === true;

export function eligibleSkills(catalog, context) {
  const artifacts = new Set(context.artifacts ?? []);
  const tools = new Set(context.tools ?? []);
  const channel = context.skillChannel ?? 'candidate';
  return catalog.filter((skill) => {
    const c = skill.contract;
    if (!c || ['quarantined','deprecated'].includes(c.status)) return false;
    if (channel === 'stable' && c.status !== 'stable') return false;
    if (!has(c.stages, context.stage)) return false;
    if (!has(c.assurance, context.assurance)) return false;
    if (!(has(c.domains, 'all') || context.domain === 'all' || has(c.domains, context.domain))) return false;
    if (!(c.consumes ?? []).every((item) => artifacts.has(item))) return false;
    if (!(c.preconditions ?? []).every((item) => fact(context, item))) return false;
    if (!(c.requiredTools ?? c.tools ?? []).every((item) => tools.has(item))) return false;
    return true;
  });
}

export function scoreSkill(skill, context) {
  const c = skill.contract;
  const reasons = [];
  let score = 0;
  if (c.stages.includes(context.stage)) { score += 30; reasons.push(`stage:${context.stage}`); }
  if (c.domains.includes(context.domain)) { score += 20; reasons.push(`domain:${context.domain}`); }
  else if (c.domains.includes('all')) { score += 8; reasons.push('domain:all'); }
  if (c.assurance.includes(context.assurance)) { score += 10; reasons.push(`assurance:${context.assurance}`); }
  for (const target of context.targets ?? []) {
    if (c.produces.includes(target)) { score += 60; reasons.push(`target:${target}`); }
  }
  const securityRisk = (context.findings ?? []).some((finding) => ['critical','high'].includes(finding.severity) && finding.status === 'open' && ['security','privacy','abuse'].includes(finding.category));
  if (securityRisk && (c.pack === 'security' || c.produces.includes('security-review') || c.produces.includes('threat-model'))) {
    score += 35; reasons.push('risk:security');
  }
  const utility = typeof context.utility?.[skill.name] === 'number' ? context.utility[skill.name] : context.utility?.[skill.name]?.score ?? 0.5;
  score += utility * 25;
  reasons.push(`utility:${utility.toFixed(2)}`);
  const estimatedTokens = Number(c.context?.estimatedTokens ?? 500);
  score -= Math.min(20, estimatedTokens / 500);
  reasons.push(`context:${estimatedTokens}`);
  const tools = new Set(context.tools ?? []);
  const optionalAvailable = (c.optionalTools ?? []).filter((tool) => tools.has(tool));
  score += optionalAvailable.length * 2;
  if (optionalAvailable.length) reasons.push(`optional-tools:${optionalAvailable.join(',')}`);
  const active = new Set(context.activeSkills ?? []);
  const conflicts = (c.conflicts ?? []).filter((name) => active.has(name));
  score -= conflicts.length * 40;
  if (conflicts.length) reasons.push(`conflicts:${conflicts.join(',')}`);
  return { name: skill.name, score: Math.round(score * 100) / 100, reasons, produces: [...c.produces], consumes: [...c.consumes], skill };
}

export function routeSkills(catalog, context, { limit = 6 } = {}) {
  return eligibleSkills(catalog, context)
    .map((skill) => scoreSkill(skill, context))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}
