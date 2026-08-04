import { signed, strings, text } from '../construction/construction-utils.mjs';

const ORDER = Object.freeze([
  'parse-type',
  'targeted',
  'contract',
  'integration',
  'browser-journey',
  'api-journey',
  'mutation-probe',
  'performance',
  'security',
  'independent-review',
  'full-suite',
]);
const RISKS = new Set(['low', 'medium', 'high', 'critical']);

function findingKinds(value) {
  if (!Array.isArray(value)) throw new TypeError('semanticFindings must be an array');
  return new Set(value.map((item) => text(item?.kind ?? item, 'semantic finding kind', 128)));
}

function stage(kind, reason, criterionIds, evidenceKinds = []) {
  return Object.freeze({ kind, required: true, reason, criterionIds, evidenceKinds });
}

export class VerificationPyramidPlanner {
  plan({ risk = 'low', changedSymbols = [], semanticFindings = [], impactedTests = [], historicalFailures = [], criterionIds = [], runtimeSurfaces = [] } = {}) {
    const normalizedRisk = text(risk, 'risk', 32);
    if (!RISKS.has(normalizedRisk)) throw new TypeError(`Unsupported risk: ${normalizedRisk}`);
    const symbols = strings(changedSymbols, 'changedSymbols', 10_000, 512);
    const tests = strings(impactedTests, 'impactedTests', 10_000, 512);
    const historical = strings(historicalFailures, 'historicalFailures', 10_000, 512);
    const criteria = strings(criterionIds, 'criterionIds', 10_000, 512);
    const surfaces = new Set(strings(runtimeSurfaces, 'runtimeSurfaces', 128, 128));
    const findings = findingKinds(semanticFindings);
    const selected = new Map();
    const add = (kind, reason, evidenceKinds = []) => selected.set(kind, stage(kind, reason, criteria, evidenceKinds));

    add('parse-type', symbols.length ? 'changed source requires parse and type evidence' : 'source integrity requires parse and type evidence', ['parse', 'type']);
    if (tests.length || symbols.length) add('targeted', tests.length ? 'directly impacted tests are available' : 'changed symbols require targeted verification', ['targeted-test']);

    const publicContract = findings.has('breaking-public-api') || findings.has('public-api-change') || findings.has('schema-change') || findings.has('dependency-change');
    const wide = normalizedRisk === 'high' || normalizedRisk === 'critical' || publicContract;
    const security = findings.has('permission-expansion') || findings.has('security-critical-scope') || findings.has('auth-change') || findings.has('secret-flow-change');
    const hot = findings.has('hot-path-change') || findings.has('resource-budget-change') || findings.has('performance-critical-scope');
    const mutation = findings.has('test-integrity-weakened') || findings.has('boundary-change') || findings.has('validation-change') || publicContract || normalizedRisk === 'critical';

    if (publicContract) add('contract', 'public interface, schema, or dependency contract changed', ['contract-test', 'compatibility']);
    if (wide) add('integration', 'wide semantic impact requires integration evidence', ['integration-test']);
    if (surfaces.has('browser') || surfaces.has('ui')) add('browser-journey', 'runtime behavior is visible through a browser surface', ['browser-journey']);
    if (surfaces.has('api')) add('api-journey', 'runtime behavior is visible through an API surface', ['api-journey']);
    if (mutation) add('mutation-probe', 'branch, validation, contract, or test-strength risk requires mutation evidence', ['mutation-probe']);
    if (hot) add('performance', 'hot path or resource budget changed', ['performance']);
    if (security) add('security', 'security-sensitive input, permission, auth, secret, shell, or network behavior changed', ['security-scan']);
    if (wide || security || normalizedRisk === 'critical') add('independent-review', 'high-risk change requires independent adversarial review', ['independent-review']);
    if (wide || historical.length) add('full-suite', historical.length ? 'historical regressions require broad verification' : 'high-risk change requires broad verification', ['full-suite']);

    const stages = ORDER.filter((kind) => selected.has(kind)).map((kind) => selected.get(kind));
    const omissions = ORDER.filter((kind) => !selected.has(kind)).map((kind) => Object.freeze({ kind, required: false, reason: `not required for ${normalizedRisk} risk and current semantic evidence` }));
    return signed({
      schema: 'forge.verification-pyramid-plan.v1',
      risk: normalizedRisk,
      changedSymbols: symbols,
      impactedTests: tests,
      historicalFailures: historical,
      criterionIds: criteria,
      runtimeSurfaces: [...surfaces].sort(),
      semanticFindingKinds: [...findings].sort(),
      stages,
      omissions,
      claims: { commandsExecuted: false, greenSuiteAloneSufficient: false, riskAdaptive: true },
    });
  }
}
