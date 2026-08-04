import { boundedClone, finite, signed, text } from './cognition-utils.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const SUPPORTED_OPERATORS = new Set(['equals', 'approx', 'includes']);

function receipt(value, label) {
  const output = String(value ?? '').trim().toLowerCase();
  if (!SHA256.test(output)) throw new TypeError(`${label} must be SHA-256`);
  return output;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sameValue(left, right) {
  return JSON.stringify(boundedClone(left)) === JSON.stringify(boundedClone(right));
}

function readPath(value, path) {
  return path.split('.').reduce((current, segment) => {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    return current[segment];
  }, value);
}

function collectAssertions(value, prefix = '', output = [], limits = {}) {
  const maxAssertions = limits.maxAssertions ?? 512;
  const maxDepth = limits.maxDepth ?? 8;
  const depth = prefix ? prefix.split('.').length : 0;
  if (depth > maxDepth) throw new RangeError(`expectedEffect exceeds maximum depth: ${maxDepth}`);
  if (output.length >= maxAssertions) throw new RangeError(`effect assertion capacity exceeded: ${maxAssertions}`);

  if (isPlainObject(value) && Object.hasOwn(value, '$op')) {
    const operator = String(value.$op ?? '').trim().toLowerCase();
    if (!SUPPORTED_OPERATORS.has(operator)) throw new TypeError(`unsupported effect operator: ${operator || '<empty>'}`);
    if (!prefix) throw new TypeError('effect operator must be attached to a named path');
    if (operator === 'approx') {
      const expected = finite(value.$value, `${prefix}.$value`, { min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY });
      const tolerance = finite(value.$tolerance, `${prefix}.$tolerance`, { min: 0 });
      output.push({ path: prefix, operator, expected, tolerance });
      return output;
    }
    if (operator === 'includes') {
      if (!Array.isArray(value.$value) || value.$value.length === 0 || value.$value.length > 256) throw new TypeError(`${prefix}.$value must contain 1-256 items`);
      output.push({ path: prefix, operator, expected: boundedClone(value.$value) });
      return output;
    }
    output.push({ path: prefix, operator, expected: boundedClone(value.$value) });
    return output;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    for (const [key, child] of entries) {
      const segment = text(key, 'effect path segment', 128);
      collectAssertions(child, prefix ? `${prefix}.${segment}` : segment, output, limits);
    }
    return output;
  }

  if (!prefix) return output;
  output.push({ path: prefix, operator: 'equals', expected: boundedClone(value) });
  return output;
}

function normalizeProbes(probes, { maxProbes, maxProbePaths }) {
  if (!Array.isArray(probes) || probes.length > maxProbes) throw new TypeError(`probes must contain 0-${maxProbes} items`);
  const seen = new Set();
  return probes.map((probe, index) => {
    const probeId = text(probe?.probeId, `probes[${index}].probeId`, 256);
    if (seen.has(probeId)) throw new TypeError(`duplicate effect probe: ${probeId}`);
    seen.add(probeId);
    if (!Array.isArray(probe?.paths) || probe.paths.length === 0 || probe.paths.length > maxProbePaths) throw new TypeError(`probe ${probeId} paths must contain 1-${maxProbePaths} items`);
    return Object.freeze({
      probeId,
      independent: probe.independent === true,
      receiptSha256: receipt(probe.receiptSha256, `probe ${probeId} receiptSha256`),
      paths: Object.freeze([...new Set(probe.paths.map((path) => text(path, `probe ${probeId} path`, 512)))].sort()),
    });
  });
}

function match(assertion, actual) {
  if (assertion.operator === 'equals') return sameValue(actual, assertion.expected);
  if (assertion.operator === 'approx') return Number.isFinite(Number(actual)) && Math.abs(Number(actual) - assertion.expected) <= assertion.tolerance;
  if (assertion.operator === 'includes') return Array.isArray(actual) && assertion.expected.every((expected) => actual.some((candidate) => sameValue(candidate, expected)));
  return false;
}

export class ToolEffectVerifier {
  constructor({ maxAssertions = 512, maxProbes = 256, maxProbePaths = 512, maxDepth = 8 } = {}) {
    this.maxAssertions = Math.max(1, Math.min(10_000, Math.floor(Number(maxAssertions) || 512)));
    this.maxProbes = Math.max(1, Math.min(10_000, Math.floor(Number(maxProbes) || 256)));
    this.maxProbePaths = Math.max(1, Math.min(10_000, Math.floor(Number(maxProbePaths) || 512)));
    this.maxDepth = Math.max(1, Math.min(32, Math.floor(Number(maxDepth) || 8)));
  }

  verify(input = {}) {
    const expectedEffect = boundedClone(input.expectedEffect ?? {}, { maxDepth: this.maxDepth, maxArray: 512, maxKeys: 1_024 });
    const actualEffect = boundedClone(input.actualEffect ?? {}, { maxDepth: this.maxDepth, maxArray: 512, maxKeys: 1_024 });
    const declarations = collectAssertions(expectedEffect, '', [], { maxAssertions: this.maxAssertions, maxDepth: this.maxDepth });
    if (declarations.length === 0) return signed({
      schema: 'forge.tool-effect-verification.v1',
      status: 'not_applicable',
      declaredSuccess: input.declaredSuccess === true,
      toolRunReceiptSha256: null,
      assertions: [], mismatchedPaths: [], uncoveredPaths: [], independentProbeReceipts: [],
      claims: { selfReportAcceptedAsEvidence: false, independentEvidenceRequired: true, executableEffectOperatorsAllowed: false },
    });

    const toolRunReceiptSha256 = receipt(input.toolRunReceiptSha256, 'toolRunReceiptSha256');
    const probes = normalizeProbes(input.probes ?? [], { maxProbes: this.maxProbes, maxProbePaths: this.maxProbePaths });
    const assertions = declarations.map((declaration) => {
      const actual = readPath(actualEffect, declaration.path);
      const coveredByProbeIds = probes
        .filter((probe) => probe.independent && (probe.paths.includes(declaration.path) || probe.paths.includes('*')))
        .map((probe) => probe.probeId)
        .sort();
      return Object.freeze({
        path: declaration.path,
        operator: declaration.operator,
        expected: declaration.expected,
        ...(declaration.operator === 'approx' ? { tolerance: declaration.tolerance } : {}),
        actual: actual === undefined ? null : boundedClone(actual),
        matched: match(declaration, actual),
        coveredByProbeIds: Object.freeze(coveredByProbeIds),
      });
    });
    const mismatchedPaths = assertions.filter((item) => !item.matched).map((item) => item.path).sort();
    const uncoveredPaths = assertions.filter((item) => item.coveredByProbeIds.length === 0).map((item) => item.path).sort();
    const status = mismatchedPaths.length > 0 ? 'false_success' : uncoveredPaths.length > 0 ? 'inconclusive' : 'verified';
    const independentProbeReceipts = [...new Set(probes.filter((probe) => probe.independent).map((probe) => probe.receiptSha256))].sort();
    return signed({
      schema: 'forge.tool-effect-verification.v1', status,
      declaredSuccess: input.declaredSuccess === true,
      toolRunReceiptSha256, assertions, mismatchedPaths, uncoveredPaths, independentProbeReceipts,
      claims: { selfReportAcceptedAsEvidence: false, independentEvidenceRequired: true, executableEffectOperatorsAllowed: false },
    });
  }
}
