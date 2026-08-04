import { createHash } from 'node:crypto';

const TEST_NAME = /\b(?:test|it)\s*\(\s*(['"`])([^'"`\n]+)\1/g;
const ASSERTION = /\bassert\.(?:equal|deepEqual|strictEqual|ok|match|doesNotMatch|throws|rejects|notEqual|notDeepEqual|ifError)\s*\([^\n;]+/g;
const HIDDEN = /(?:chain.?of.?thought|hidden.?reasoning|private.?scratchpad|reasoning.?trace)/i;
const NEGATIVE_NAME = /\b(?:rejects?|refuses?|den(?:y|ies)|blocks?|fails?|invalid|missing|stale|unknown|unsafe|without|cannot|does not|doesn't|excludes?|forbids?|quarantines?|errors?|rollbacks?|cancels?|timeouts?|exhausts?|outside|escapes?|tampers?)\b/i;
const NEGATIVE_ASSERTION = /assert\.(?:doesNotMatch|throws|rejects|notEqual|notDeepEqual|ifError)|\b(?:false|null|undefined|denied|blocked|invalid|error|fail|missing|stale|quarantine|cancelled|timedOut)\b/i;

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function unique(values) { return [...new Set(values)]; }
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  for (const key of Object.keys(value)) value[key] = freeze(value[key]);
  return Object.freeze(value);
}

function indexedTests(text) {
  const matches = [...text.matchAll(TEST_NAME)];
  return matches.map((match, index) => {
    const name = match[2].trim();
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? text.length;
    const segment = text.slice(start, end);
    const assertions = unique([...segment.matchAll(ASSERTION)].map((item) => item[0].replace(/\s+/g, ' ').trim()));
    const negativeByName = NEGATIVE_NAME.test(name);
    const positiveAssertions = unique([
      ...assertions.filter((item) => !NEGATIVE_ASSERTION.test(item)),
      ...(negativeByName ? [] : [`named-test-pass:${name}`]),
    ]);
    const negativeAssertions = unique([
      ...assertions.filter((item) => NEGATIVE_ASSERTION.test(item)),
      ...(negativeByName ? [`named-test-negative:${name}`] : []),
    ]);
    return freeze({
      name,
      positiveAssertions,
      negativeAssertions,
      hasPositiveEvidence: positiveAssertions.length > 0,
      hasNegativeEvidence: negativeAssertions.length > 0,
    });
  });
}

export function indexTestSource({ path, source } = {}) {
  const testPath = String(path ?? '').replaceAll('\\', '/').trim();
  const text = String(source ?? '');
  if (!testPath) throw new TypeError('test path is required');
  const tests = indexedTests(text);
  const namedTests = tests.map((item) => item.name);
  const assertions = unique([...text.matchAll(ASSERTION)].map((match) => match[0].replace(/\s+/g, ' ').trim()));
  const positiveNames = tests.filter((item) => item.hasPositiveEvidence).map((item) => `named-test-pass:${item.name}`);
  const negativeNames = tests.filter((item) => item.hasNegativeEvidence).map((item) => `named-test-negative:${item.name}`);
  const positiveAssertions = unique([...assertions.filter((item) => !NEGATIVE_ASSERTION.test(item)), ...positiveNames]);
  const negativeAssertions = unique([...assertions.filter((item) => NEGATIVE_ASSERTION.test(item)), ...negativeNames]);
  return freeze({
    schema: 'nolane.forensics.test-assertion-index-entry.v2',
    path: testPath,
    sourceSha256: sha256(text),
    namedTests,
    tests,
    positiveAssertions,
    negativeAssertions,
    hasPositiveEvidence: namedTests.length > 0 && positiveAssertions.length > 0,
    hasNegativeEvidence: namedTests.length > 0 && negativeAssertions.length > 0,
  });
}

export function buildTestAssertionIndex(entries = []) {
  if (!Array.isArray(entries)) throw new TypeError('entries must be an array');
  const index = new Map();
  for (const entry of entries) {
    const value = indexTestSource(entry);
    if (index.has(value.path)) throw new Error(`Duplicate test path: ${value.path}`);
    index.set(value.path, value);
  }
  return index;
}
