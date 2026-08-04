const HIDDEN = /(?:chain.?of.?thought|hidden.?reasoning|private.?scratchpad|reasoning.?trace)/i;

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  for (const key of Object.keys(value)) value[key] = freeze(value[key]);
  return Object.freeze(value);
}

function scanHidden(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (HIDDEN.test(key)) throw new TypeError(`Hidden reasoning is forbidden at ${path}.${key}`);
    scanHidden(child, `${path}.${key}`);
  }
}

function names(value, label) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError(`${label} must contain at least one test name`);
  const normalized = [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
  if (normalized.length === 0) throw new TypeError(`${label} must contain at least one test name`);
  return normalized;
}

export function validateRequirementAssertionBindings({ requirementId, bindings, testIndex } = {}) {
  const id = String(requirementId ?? '').trim();
  if (!id) throw new TypeError('requirementId is required');
  if (!Array.isArray(bindings) || bindings.length === 0) throw new TypeError('bindings are required');
  if (!(testIndex instanceof Map)) throw new TypeError('testIndex must be a Map');
  scanHidden(bindings);

  const validated = bindings.map((binding, index) => {
    if (!binding || typeof binding !== 'object') throw new TypeError(`binding ${index} must be an object`);
    const testPath = String(binding.testPath ?? '').replaceAll('\\', '/').trim();
    if (!testPath) throw new TypeError(`binding ${index} requires testPath`);
    const indexed = testIndex.get(testPath);
    if (!indexed) throw new Error(`Test path is not indexed: ${testPath}`);
    const byName = new Map((indexed.tests ?? []).map((item) => [item.name, item]));
    const positiveNames = names(binding.positiveTestNames, 'positiveTestNames');
    const negativeNames = names(binding.negativeTestNames, 'negativeTestNames');
    const positiveTests = positiveNames.map((name) => {
      const item = byName.get(name);
      if (!item) throw new Error(`Unknown positive test name for ${testPath}: ${name}`);
      if (item.hasNegativeEvidence && !item.hasPositiveEvidence) throw new Error(`Positive test carries only negative evidence: ${name}`);
      if (!item.hasPositiveEvidence) throw new Error(`Positive test has no positive assertion evidence: ${name}`);
      return item;
    });
    const negativeTests = negativeNames.map((name) => {
      const item = byName.get(name);
      if (!item) throw new Error(`Unknown negative test name for ${testPath}: ${name}`);
      if (!item.hasNegativeEvidence) throw new Error(`Negative test has no negative assertion evidence: ${name}`);
      return item;
    });
    return {
      schema: 'nolane.forensics.requirement-assertion-binding-entry.v1',
      testPath,
      sourceSha256: indexed.sourceSha256,
      positiveTests: positiveTests.map((item) => ({ name: item.name, assertionCount: item.positiveAssertions.length })),
      negativeTests: negativeTests.map((item) => ({ name: item.name, assertionCount: item.negativeAssertions.length })),
    };
  });
  return freeze({ schema: 'nolane.forensics.requirement-assertion-binding.v1', requirementId: id, status: 'verified', bindings: validated });
}
