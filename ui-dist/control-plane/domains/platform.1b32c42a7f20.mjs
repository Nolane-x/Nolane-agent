import { t } from '../../core/i18n.0e5a2126d9bc.mjs';
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

export function renderPlatformView(value, domain = 'extensions', { language = 'en' } = {}) {
  const title = t(`control.domain.${domain}`, language);
  if (domain === 'labs') {
    const foundation = value.labs.foundation;
    const steps = language === 'vi' ? 'bước distillation' : 'distillation steps';
    const runs = language === 'vi' ? 'lần chạy đệ quy' : 'recursive runs';
    const solvers = language === 'vi' ? 'bộ giải symbolic' : 'symbolic solvers';
    const tasks = language === 'vi' ? 'tác vụ curriculum' : 'curriculum tasks';
    const benchmarks = language === 'vi' ? 'benchmark khoa học' : 'scientific benchmarks';
    const codemods = language === 'vi' ? 'AST codemod' : 'AST codemods';
    const proofs = language === 'vi' ? 'bằng chứng SMT' : 'SMT proofs';
    const datalog = language === 'vi' ? 'đánh giá Datalog' : 'Datalog evaluations';
    return `<section><h1>${escapeHtml(title)}</h1><p>${escapeHtml(language === 'vi' ? (foundation.foundationReady ? (foundation.trainedModel ? 'Nền tảng sẵn sàng · Đã đăng ký model đã huấn luyện' : 'Nền tảng sẵn sàng · Chưa có model đã huấn luyện') : 'Nền tảng không khả dụng') : foundation.label)}</p><p>${foundation.subsystems.distillationSteps} ${steps} · ${foundation.subsystems.recursiveRuns} ${runs} · ${foundation.subsystems.symbolicSolvers} ${solvers} · ${foundation.subsystems.curriculumTasks} ${tasks} · ${foundation.subsystems.scientificBenchmarks} ${benchmarks} · ${foundation.subsystems.astCodemods} ${codemods} · ${foundation.subsystems.smtProofs} ${proofs} · ${foundation.subsystems.datalogEvaluations} ${datalog}</p><p>${language === 'vi' ? 'Non-claim' : 'Non-claims'}: ${escapeHtml(foundation.nonClaims.join(', '))}</p></section>`;
  }
  return `<section><h1>${escapeHtml(title)}</h1><p>${value.extensions.providers.length} ${t('control.providers', language)} · ${value.extensions.skills.length} ${t('common.skill', language)}</p></section>`;
}
