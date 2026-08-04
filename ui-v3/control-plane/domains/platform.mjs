const freezeList = (items) => Object.freeze(items.map((item) => Object.freeze({ ...item })));
const count = (value) => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function buildFoundationView(foundation = {}) {
  const status = foundation.status && typeof foundation.status === 'object' ? foundation.status : foundation;
  const foundationReady = status.foundationReady === true;
  const trainedModel = status.trainedModel === true;
  const claims = status.claims ?? {};
  const nonClaims = [];
  if (claims.autonomousSelfImprovement !== true) nonClaims.push('autonomous-self-improvement');
  if (claims.competitorSuperiority !== true) nonClaims.push('competitor-superiority');
  if (claims.frontierParity !== true) nonClaims.push('frontier-parity');
  if (!trainedModel) nonClaims.push('trained-model');
  return Object.freeze({
    foundationReady,
    trainedModel,
    label: foundationReady ? (trainedModel ? 'Foundation ready · Trained model registered' : 'Foundation ready · No trained model') : 'Foundation unavailable',
    subsystems: Object.freeze({
      distillationSteps: count(foundation.distillation?.steps),
      recursiveRuns: count(foundation.recursive?.runs),
      symbolicSolvers: count(foundation.symbolic?.solvers),
      memories: count(foundation.plasticity?.memories),
      curriculumTasks: count(foundation.curriculum?.tasks),
      verifierProbes: count(foundation.verifierRedTeam?.probes),
      scientificBenchmarks: count(foundation.scientificBenchmarks?.receipts),
      astCodemods: count(foundation.alpha5Operations?.astCodemods),
      smtProofs: count(foundation.alpha5Operations?.smtProofs),
      datalogEvaluations: count(foundation.alpha5Operations?.datalogEvaluations),
      distilledPolicies: count(foundation.policyDistillation?.policies),
      adaptationContexts: count(foundation.adaptationPolicy?.contexts),
      latentExperts: count(foundation.latentMemory?.experts),
    }),
    nonClaims: Object.freeze(nonClaims.sort()),
  });
}

export function buildPlatformView({ providers = [], models = [], skills = [], plugins = [], experiments = [], release = {}, autonomy = {}, foundation = {} } = {}) {
  return Object.freeze({
    extensions: Object.freeze({ providers: freezeList(providers), models: freezeList(models), skills: freezeList(skills), plugins: freezeList(plugins) }),
    autonomy: Object.freeze({ presets: Object.freeze(['ask', 'plan', 'build', 'verify']), budgets: Object.freeze({ ...(autonomy.budgets ?? {}) }) }),
    labs: Object.freeze({ experiments: freezeList(experiments), foundation: buildFoundationView(foundation) }),
    release: Object.freeze({ ...release, canPromote: Boolean(release.signed && release.integrityVerified && release.cleanRoomVerified) }),
  });
}

export function renderPlatformView(value, domain = 'extensions') {
  const title = domain === 'labs' ? 'Labs & Benchmarks' : domain === 'release' ? 'Release & Recovery' : domain === 'autonomy' ? 'Autonomy' : 'Extensions';
  if (domain === 'labs') {
    const foundation = value.labs.foundation;
    return `<section><h1>${title}</h1><p>${escapeHtml(foundation.label)}</p><p>${foundation.subsystems.distillationSteps} distillation steps · ${foundation.subsystems.recursiveRuns} recursive runs · ${foundation.subsystems.symbolicSolvers} symbolic solvers · ${foundation.subsystems.curriculumTasks} curriculum tasks · ${foundation.subsystems.scientificBenchmarks} scientific benchmarks · ${foundation.subsystems.astCodemods} AST codemods · ${foundation.subsystems.smtProofs} SMT proofs · ${foundation.subsystems.datalogEvaluations} Datalog evaluations</p><p>Non-claims: ${escapeHtml(foundation.nonClaims.join(', '))}</p></section>`;
  }
  return `<section><h1>${title}</h1><p>${value.extensions.providers.length} providers · ${value.extensions.skills.length} skills</p></section>`;
}
