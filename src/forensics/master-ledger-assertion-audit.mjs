import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { validateRequirementAssertionBindings } from './requirement-assertion-binding.mjs';

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  for (const key of Object.keys(value)) value[key] = freeze(value[key]);
  return Object.freeze(value);
}
function paths(value) { return [...new Set((Array.isArray(value) ? value : value ? [value] : []).map((item) => String(item).replaceAll('\\', '/')).filter(Boolean))]; }
function isDocumentation(path) { return path === 'docs' || path.startsWith('docs/') || /\.(?:md|mdx|rst)$/i.test(path); }
function isExternal(requirement) { return /external/i.test(String(requirement?.status ?? '')) || (requirement?.acceptance?.externalConditions?.length ?? 0) > 0; }

export function auditMasterLedgerAssertions({ requirements = [], existingPaths = new Set(), sha256ByPath = new Map(), testIndex = new Map(), maxRequirementsPerTest = 25 } = {}) {
  if (!Array.isArray(requirements)) throw new TypeError('requirements must be an array');
  if (!(existingPaths instanceof Set) || !(sha256ByPath instanceof Map) || !(testIndex instanceof Map)) throw new TypeError('existingPaths, sha256ByPath and testIndex must be Set/Map values');
  if (!Number.isSafeInteger(maxRequirementsPerTest) || maxRequirementsPerTest < 1) throw new TypeError('maxRequirementsPerTest must be positive');

  const testOwners = new Map();
  for (const requirement of requirements) {
    for (const testPath of paths(requirement?.acceptance?.testPaths ?? requirement?.acceptance?.exactTest)) {
      const owners = testOwners.get(testPath) ?? new Set(); owners.add(String(requirement.id)); testOwners.set(testPath, owners);
    }
  }
  const overBroad = new Map([...testOwners].filter(([, owners]) => owners.size > maxRequirementsPerTest));

  const records = requirements.map((requirement) => {
    const requirementId = String(requirement?.id ?? '').trim();
    const acceptance = requirement?.acceptance ?? {};
    const productionEntryPoints = paths(acceptance.productionEntryPoints ?? acceptance.productionEntrypoint ?? acceptance.entrypoint);
    const testPaths = paths(acceptance.testPaths ?? acceptance.exactTest);
    const blockers = []; const warnings = [];
    if (!requirementId) blockers.push('requirement-id-missing');
    if (productionEntryPoints.length === 0) blockers.push('production-entrypoint-missing');
    const usableProduction = [];
    for (const entrypoint of productionEntryPoints) {
      if (!existingPaths.has(entrypoint)) { warnings.push(`missing-production-entrypoint:${entrypoint}`); continue; }
      if (isDocumentation(entrypoint)) { warnings.push(`documentation-production-entrypoint:${entrypoint}`); continue; }
      const expected = acceptance.evidenceHashes?.[entrypoint] ?? acceptance.evidence?.entrypointSha256;
      if (expected && sha256ByPath.get(entrypoint) && sha256ByPath.get(entrypoint) !== expected) { warnings.push(`stale-production-hash:${entrypoint}`); continue; }
      usableProduction.push(entrypoint);
    }
    if (productionEntryPoints.length > 0 && productionEntryPoints.every(isDocumentation)) blockers.push('documentation-only-production-entrypoint');
    if (usableProduction.length === 0 && productionEntryPoints.length > 0 && !blockers.includes('documentation-only-production-entrypoint')) blockers.push('fresh-production-entrypoint-missing');
    if (testPaths.length === 0) blockers.push('test-path-missing');

    const dedicatedTestPaths = []; let anyNamed = false; let anyPositive = false; let anyNegative = false;
    let explicitAssertionBindings = null;
    if (Array.isArray(acceptance.assertionBindings) && acceptance.assertionBindings.length > 0) {
      try {
        explicitAssertionBindings = validateRequirementAssertionBindings({ requirementId, bindings: acceptance.assertionBindings, testIndex });
        anyNamed = true; anyPositive = true; anyNegative = true;
        dedicatedTestPaths.push(...explicitAssertionBindings.bindings.map((item) => item.testPath));
      } catch (error) {
        blockers.push(`explicit-assertion-binding-invalid:${String(error?.message ?? error)}`);
      }
    }
    for (const testPath of testPaths) {
      if (!existingPaths.has(testPath)) { warnings.push(`missing-test-path:${testPath}`); continue; }
      const indexed = testIndex.get(testPath);
      if (!indexed) { warnings.push(`test-not-indexed:${testPath}`); continue; }
      const explicitlyBound = explicitAssertionBindings?.bindings.some((item) => item.testPath === testPath) === true;
      anyNamed ||= indexed.namedTests.length > 0;
      anyPositive ||= indexed.hasPositiveEvidence === true;
      anyNegative ||= indexed.hasNegativeEvidence === true;
      const expected = acceptance.evidenceHashes?.[testPath] ?? acceptance.evidence?.exactTestSha256;
      if (expected && indexed.sourceSha256 !== expected) { warnings.push(`stale-test-hash:${testPath}`); continue; }
      if (!explicitlyBound && overBroad.has(testPath)) { warnings.push(`over-broad-test-evidence:${testPath}`); continue; }
      if (!explicitlyBound && indexed.namedTests.length > 0 && indexed.hasPositiveEvidence === true && indexed.hasNegativeEvidence === true) dedicatedTestPaths.push(testPath);
    }
    if (!anyNamed) blockers.push('named-test-missing');
    if (!anyPositive) blockers.push('positive-assertion-missing');
    if (!anyNegative) blockers.push('negative-assertion-missing');
    if (testPaths.length > 0 && dedicatedTestPaths.length === 0) blockers.push('dedicated-test-evidence-missing');
    const external = isExternal(requirement);
    const uniqueBlockers = [...new Set(blockers)].sort();
    const uniqueWarnings = [...new Set(warnings)].sort();
    const assertionStatus = external ? 'external-unverified' : uniqueBlockers.length === 0 ? 'verified' : 'unbound';
    return freeze({
      schema: 'nolane.forensics.master-ledger-assertion-record.v3', requirementId, originalStatus: String(requirement?.status ?? 'unknown'),
      assertionStatus, external, productionEntryPoints, usableProductionEntryPoints: usableProduction.sort(), testPaths,
      dedicatedTestPaths: [...new Set(dedicatedTestPaths)].sort(), explicitAssertionBindings, blockers: uniqueBlockers, warnings: uniqueWarnings,
      historicalEvidenceAliases: acceptance.historicalEvidenceAliases ?? [],
    });
  }).sort((a, b) => a.requirementId.localeCompare(b.requirementId));

  const count = (status) => records.filter((item) => item.assertionStatus === status).length;
  const blockerCounts = {}; const warningCounts = {};
  for (const record of records) {
    for (const blocker of record.blockers) blockerCounts[blocker.split(':')[0]] = (blockerCounts[blocker.split(':')[0]] ?? 0) + 1;
    for (const warning of record.warnings) warningCounts[warning.split(':')[0]] = (warningCounts[warning.split(':')[0]] ?? 0) + 1;
  }
  const summary = {
    requirementsTotal: records.length,
    assertionVerified: count('verified'),
    assertionUnbound: count('unbound'),
    externalUnverified: count('external-unverified'),
    overBroadTestFiles: overBroad.size,
    documentationOnlyEntrypoints: records.filter((item) => item.blockers.includes('documentation-only-production-entrypoint')).length,
    missingPositiveAssertions: records.filter((item) => item.blockers.includes('positive-assertion-missing')).length,
    missingNegativeAssertions: records.filter((item) => item.blockers.includes('negative-assertion-missing')).length,
    blockerCounts, warningCounts,
  };
  const overBroadEvidence = [...overBroad.entries()].map(([testPath, owners]) => ({ testPath, requirements: owners.size, requirementIds: [...owners].sort(), limit: maxRequirementsPerTest })).sort((a, b) => b.requirements - a.requirements || a.testPath.localeCompare(b.testPath));
  const certifiable = summary.assertionUnbound === 0 && summary.externalUnverified === 0 && summary.overBroadTestFiles === 0;
  const base = { schema: 'nolane.forensics.master-ledger-assertion-audit.v3', policy: { maxRequirementsPerTest, fileExistenceIsProof: false, requirementStatusMutated: false, oneDedicatedFreshTestIsSufficient: true, explicitNamedBindingsOverrideOwnerCount: true, warningsRemainVisible: true }, summary, overBroadEvidence, records, certifiable };
  return freeze({ ...base, receiptSha256: canonicalSha256(base) });
}
