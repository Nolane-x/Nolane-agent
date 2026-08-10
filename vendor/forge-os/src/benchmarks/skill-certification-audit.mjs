import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalSha256 } from '../core/canonical-json.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = (file) => readFile(file, 'utf8').then(JSON.parse);
async function exists(file) { try { await access(file); return true; } catch { return false; } }
async function scenarioCount(directory) {
  const file = path.join(directory, 'evaluators/cases.json');
  if (!await exists(file)) return 0;
  const value = await readJson(file);
  return Array.isArray(value) ? value.length : Array.isArray(value?.cases) ? value.cases.length : 0;
}
async function hasRedBaseline(directory) {
  return (await Promise.all([
    'evaluators/baseline.json',
    'evaluators/red-baseline.json',
    'red-baseline.json',
    'baseline-red.json',
  ].map((name) => exists(path.join(directory, name))))).some(Boolean);
}
function blocker(code, count, detail) { return Object.freeze({ code, count, detail }); }

export async function runSkillCertificationAudit({ root = ROOT } = {}) {
  const catalog = await readJson(path.join(root, 'skills-v2/catalog.json'));
  const records = [];
  for (const entry of catalog) {
    const directory = path.join(root, entry.path);
    const manifest = await readJson(path.join(directory, 'manifest.json'));
    const cases = await scenarioCount(directory);
    const redBaseline = await hasRedBaseline(directory);
    records.push(Object.freeze({
      id: manifest.id,
      maturity: manifest.maturity,
      kernelLevel: manifest.kernelLevel ?? null,
      publicScenarios: cases,
      redBaseline,
      evaluatorBindings: manifest.verification?.evaluatorIds?.length ?? 0,
      independentReviewDeclared: manifest.verification?.independentReview === true,
      compatibleModelFamiliesDeclared: manifest.quality?.compatibleModels?.length ?? 0,
      knownLimitations: manifest.quality?.knownLimitations ?? [],
    }));
  }
  records.sort((a, b) => a.id.localeCompare(b.id));

  // Package-local evidence is intentionally the only evidence counted here. A label,
  // benchmark ID, or declared compatible model is not a completed holdout/model run.
  const stableRecords = records.filter((item) => item.maturity === 'stable');
  const certifiedRecords = records.filter((item) => item.maturity === 'certified');
  const l0 = records.filter((item) => item.kernelLevel === 'L0');
  const stableScenarioDeficits = stableRecords
    .filter((item) => item.publicScenarios < 20)
    .map((item) => ({ id: item.id, observed: item.publicScenarios, required: 20 }));
  const l0ScenarioDeficits = l0
    .filter((item) => item.publicScenarios < 50)
    .map((item) => ({ id: item.id, observed: item.publicScenarios, required: 50 }));

  // The source archive contains a holdout-manifest helper, but no package-bound hidden
  // holdout run receipts, paired multi-model run receipts, human certification receipts,
  // or production-expiry attestations for these 128 technique packages.
  const evidenceQualifiedStable = records.filter((item) =>
    item.publicScenarios >= 20
    && item.redBaseline
    && item.evaluatorBindings > 0
    && false // hidden holdout + positive confidence receipt is absent from the package
  );
  const evidenceQualifiedCertified = records.filter((item) =>
    item.publicScenarios >= 20
    && item.redBaseline
    && item.evaluatorBindings > 0
    && false // independent maintainer + production evidence + expiry receipt is absent
  );

  const blockers = [
    blocker('stable-public-scenarios-insufficient', stableScenarioDeficits.length, 'Stable requires at least 20 scenarios including holdout and transfer evidence.'),
    blocker('l0-fifty-scenario-threshold-unmet', l0ScenarioDeficits.length, 'Every L0 kernel technique requires at least 50 scenarios.'),
    blocker('hidden-holdout-missing', records.length, 'No package-bound hidden holdout run receipts were found.'),
    blocker('multi-model-paired-runs-missing', records.length, 'Declared model compatibility is not a paired multi-model evaluation receipt.'),
    blocker('independent-certification-review-missing', records.length, 'No independent maintainer/domain certification receipt is packaged.'),
    blocker('production-evidence-and-expiry-missing', records.length, 'No production evidence plus certification expiry policy receipt is packaged.'),
    blocker('ten-thousand-paired-runs-missing', 1, 'The release does not contain evidence of the 10,000 paired runs required for a production-grade 1,024-skill claim.'),
  ].filter((item) => item.count > 0);

  const payload = {
    schemaVersion: 1,
    auditId: 'forgeos-v06-final-skill-certification',
    criteriaProfile: 'forgeos-skill-intelligence-blueprint-revision-2',
    inventory: {
      totalTechniques: records.length,
      declaredCandidate: records.filter((item) => item.maturity === 'candidate').length,
      declaredValidated: records.filter((item) => item.maturity === 'validated').length,
      declaredStable: stableRecords.length,
      declaredCertified: certifiedRecords.length,
    },
    packageEvidence: {
      withRedBaseline: records.filter((item) => item.redBaseline).length,
      withEvaluatorBinding: records.filter((item) => item.evaluatorBindings > 0).length,
      stableWithAtLeastTwentyPublicScenarios: stableRecords.filter((item) => item.publicScenarios >= 20).length,
      stableScenarioDeficits,
      hiddenHoldoutRunReceipts: 0,
      multiModelPairedRunReceipts: 0,
      independentCertificationReceipts: 0,
      productionEvidenceReceipts: 0,
      pairedRunCountProven: 0,
    },
    evidenceQualified: {
      stable: evidenceQualifiedStable.length,
      certified: evidenceQualifiedCertified.length,
    },
    kernel: {
      l0Total: l0.length,
      l0MeetingFiftyScenarioThreshold: l0.filter((item) => item.publicScenarios >= 50).length,
      l0ScenarioDeficits,
      allL0Certified: l0.length > 0 && l0.every((item) => evidenceQualifiedCertified.some((candidate) => candidate.id === item.id)),
    },
    claims: {
      allKernelStableOrCertified: false,
      allProceduralSkillsProductionGrade: false,
      oneThousandTwentyFourProceduralSkillsProductionGrade: false,
      tenThousandPairedRunsCompleted: false,
      runtimeHardeningCanBePublishedWithExplicitClaimsBoundary: true,
    },
    blockers,
    records,
  };
  return Object.freeze({ ...payload, reportSha256: canonicalSha256(payload) });
}
