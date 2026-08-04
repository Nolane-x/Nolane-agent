function freeze(value) {
  if (value && typeof value === 'object' && Object.isFrozen(value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) value[key] = freeze(entry);
    return Object.freeze(value);
  }
  return value;
}

function array(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.length > 0) : [];
}

export function auditEvidenceBindings({ requirements = [], policy = {} } = {}) {
  if (!Array.isArray(requirements)) throw new TypeError('requirements must be an array');
  const maxRequirementsPerTest = Number(policy.maxRequirementsPerTest ?? 25);
  if (!Number.isSafeInteger(maxRequirementsPerTest) || maxRequirementsPerTest < 1) throw new TypeError('maxRequirementsPerTest must be a positive integer');
  const violations = [];
  const testOwners = new Map();
  const verified = requirements.filter((requirement) => requirement?.status === 'verified' || requirement?.status === 'verified_source_test');
  for (const requirement of verified) {
    const acceptance = requirement.acceptance ?? {};
    const productionEntryPoints = array(acceptance.productionEntryPoints);
    const primary = acceptance.productionEntrypoint ?? productionEntryPoints[0] ?? null;
    const tests = array(acceptance.testPaths);
    const negatives = array(acceptance.negativeTestPaths);
    const positiveAssertions = array(acceptance.positiveAssertions);
    const negativeAssertions = array(acceptance.negativeAssertions);
    const id = String(requirement.id ?? 'unknown');

    if (!primary || String(primary).startsWith('docs/') || (productionEntryPoints.length > 0 && productionEntryPoints.every((entry) => entry.startsWith('docs/')))) {
      violations.push({ requirementId: id, code: 'documentation-production-entrypoint', path: primary, message: 'Documentation or measurement output cannot be the primary production entrypoint.' });
    }
    if (tests.length === 0) violations.push({ requirementId: id, code: 'missing-positive-test', message: 'Verified requirement has no direct test path.' });
    if (positiveAssertions.length === 0) violations.push({ requirementId: id, code: 'missing-positive-assertion', message: 'Verified requirement has no assertion-level positive binding.' });
    if (negatives.length === 0) violations.push({ requirementId: id, code: 'missing-negative-test', message: 'Verified requirement has no explicit negative test path.' });
    if (negativeAssertions.length === 0) violations.push({ requirementId: id, code: 'missing-negative-assertion', message: 'Verified requirement has no assertion-level negative binding.' });
    for (const testPath of tests) {
      const owners = testOwners.get(testPath) ?? [];
      owners.push(id);
      testOwners.set(testPath, owners);
    }
  }
  const overBroadEvidence = [...testOwners.entries()]
    .filter(([, owners]) => owners.length > maxRequirementsPerTest)
    .map(([testPath, owners]) => ({ path: testPath, requirements: owners.length, requirementIds: owners.sort(), limit: maxRequirementsPerTest }))
    .sort((a, b) => b.requirements - a.requirements || a.path.localeCompare(b.path));
  return freeze({
    schema: 'nolane.forensics.evidence-quality-audit.v1',
    policy: { maxRequirementsPerTest },
    requirementsTotal: requirements.length,
    verifiedRequirements: verified.length,
    violations: violations.sort((a, b) => a.requirementId.localeCompare(b.requirementId) || a.code.localeCompare(b.code)),
    overBroadEvidence,
    certifiable: violations.length === 0 && overBroadEvidence.length === 0,
    summary: {
      documentationProductionEntrypoints: violations.filter((item) => item.code === 'documentation-production-entrypoint').length,
      missingPositiveTests: violations.filter((item) => item.code === 'missing-positive-test').length,
      missingPositiveAssertions: violations.filter((item) => item.code === 'missing-positive-assertion').length,
      missingNegativeTests: violations.filter((item) => item.code === 'missing-negative-test').length,
      missingNegativeAssertions: violations.filter((item) => item.code === 'missing-negative-assertion').length,
      overBroadTestFiles: overBroadEvidence.length,
    },
  });
}
