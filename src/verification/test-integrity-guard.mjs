import { signed, text } from '../construction/construction-utils.mjs';

const HASH = /^[a-f0-9]{64}$/i;
const TEST_PATH = /(?:^|\/)(?:test|tests|__tests__)(?:\/|\.|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/i;

function validateReceipt(value, label) {
  const receipt = String(value ?? '');
  if (!HASH.test(receipt)) throw new TypeError(`${label} must be SHA-256`);
  return receipt.toLowerCase();
}

function finding({ category, severity = 'high', confidence = 0.95, path = null, line = 1, evidence, blocking = true }) {
  return Object.freeze({ category, severity, confidence, path, line, evidence: String(evidence).slice(0, 1_000), blocking });
}

function parseDiff(diff) {
  const entries = [];
  let path = null;
  let line = 0;
  for (const raw of String(diff ?? '').split(/\r?\n/)) {
    if (raw.startsWith('diff --git ')) {
      const match = raw.match(/^diff --git a\/(.+?) b\/(.+)$/);
      path = match?.[2] ?? null;
      line = 0;
      continue;
    }
    if (raw.startsWith('+++ b/')) { path = raw.slice(6); continue; }
    if (raw.startsWith('@@')) {
      const match = raw.match(/\+(\d+)/);
      line = Number(match?.[1] ?? 0);
      continue;
    }
    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      entries.push({ kind: 'add', path, line, text: raw.slice(1) });
      line += 1;
    } else if (raw.startsWith('-') && !raw.startsWith('---')) {
      entries.push({ kind: 'remove', path, line, text: raw.slice(1) });
    } else if (!raw.startsWith('\\')) line += 1;
  }
  return entries;
}

export class TestIntegrityGuard {
  assess({ diff = '', testRuns = [], mutationReceipt = null, sourceHash } = {}) {
    const hash = validateReceipt(sourceHash, 'sourceHash');
    if (!Array.isArray(testRuns)) throw new TypeError('testRuns must be an array');
    const entries = parseDiff(diff);
    const findings = [];
    const removed = entries.filter((item) => item.kind === 'remove' && TEST_PATH.test(item.path ?? ''));
    const added = entries.filter((item) => item.kind === 'add' && TEST_PATH.test(item.path ?? ''));

    for (const item of added) {
      if (/\b(?:test|it|describe)\.skip\s*\(/.test(item.text)) findings.push(finding({ category: 'test-skip', path: item.path, line: item.line, evidence: item.text }));
      if (/\b(?:test|it|describe)\.only\s*\(/.test(item.text)) findings.push(finding({ category: 'focused-test', path: item.path, line: item.line, evidence: item.text }));
      if (/\b(?:mock\.module|jest\.mock|vi\.mock|mock\.method)\s*\(/.test(item.text)) findings.push(finding({ category: 'broad-mock', severity: 'medium', confidence: 0.82, path: item.path, line: item.line, evidence: item.text }));
    }

    const removedStrictAssertions = removed.filter((item) => /\bassert\.(?:equal|strictEqual|deepEqual|throws|rejects|match)\s*\(/.test(item.text));
    const addedWeakAssertions = added.filter((item) => /\bassert\.(?:ok|truthy)\s*\(/.test(item.text) || /expect\([^)]*\)\.toBeTruthy\s*\(/.test(item.text));
    if (removedStrictAssertions.length && addedWeakAssertions.length) findings.push(finding({ category: 'assertion-weakened', evidence: `${removedStrictAssertions[0].text} -> ${addedWeakAssertions[0].text}`, path: addedWeakAssertions[0].path, line: addedWeakAssertions[0].line }));

    const removedNegative = removed.find((item) => /\b(?:throws|rejects|not\.|rejects |invalid|expired|unauthorized|forbidden|negative)\b/i.test(item.text));
    if (removedNegative) findings.push(finding({ category: 'negative-case-removed', evidence: removedNegative.text, path: removedNegative.path, line: removedNegative.line }));

    const removedTestDeclaration = removed.find((item) => /\b(?:test|it)\s*\(/.test(item.text));
    const addedReplacement = added.some((item) => /\b(?:test|it)(?:\.skip)?\s*\(/.test(item.text));
    if (removedTestDeclaration && !addedReplacement) findings.push(finding({ category: 'test-deleted', evidence: removedTestDeclaration.text, path: removedTestDeclaration.path, line: removedTestDeclaration.line }));

    const runsById = new Map();
    for (const run of testRuns) {
      const testId = text(run?.testId, 'testRun.testId', 512);
      const status = text(run?.status, 'testRun.status', 32);
      const receiptSha256 = validateReceipt(run?.receiptSha256, 'testRun.receiptSha256');
      const list = runsById.get(testId) ?? [];
      list.push({ testId, status, flaky: run?.flaky === true, receiptSha256 });
      runsById.set(testId, list);
    }
    for (const [testId, runs] of runsById) {
      if (runs.some((run) => run.flaky) && runs.filter((run) => run.status === 'pass').length < 2) findings.push(finding({ category: 'flaky-single-pass', severity: 'high', confidence: 1, evidence: `${testId} has only one passing flaky receipt`, blocking: true }));
      if (runs.some((run) => run.status !== 'pass')) findings.push(finding({ category: 'test-run-failed', severity: 'high', confidence: 1, evidence: `${testId} has a non-pass result`, blocking: true }));
    }

    let mutation = null;
    if (mutationReceipt) {
      mutation = Object.freeze({ status: text(mutationReceipt.status, 'mutationReceipt.status', 32), killed: Number(mutationReceipt.killed ?? 0), survived: Number(mutationReceipt.survived ?? 0), receiptSha256: validateReceipt(mutationReceipt.receiptSha256, 'mutationReceipt.receiptSha256') });
      if (mutation.status !== 'pass' || mutation.survived > 0) findings.push(finding({ category: 'mutation-survived', severity: 'high', confidence: 1, evidence: `survived=${mutation.survived}`, blocking: true }));
    }

    const unique = [...new Map(findings.map((item) => [`${item.category}:${item.path ?? ''}:${item.line}:${item.evidence}`, item])).values()];
    const blockingFindings = unique.filter((item) => item.blocking).length;
    const hasPassingEvidence = testRuns.length === 0 || [...runsById.values()].every((runs) => runs.some((run) => run.status === 'pass') && (!runs.some((run) => run.flaky) || runs.filter((run) => run.status === 'pass').length >= 2));
    return signed({
      schema: 'forge.test-integrity-assessment.v1',
      sourceHash: hash,
      findings: unique,
      blockingFindings,
      mutation,
      allowedAsCompletionEvidence: blockingFindings === 0 && hasPassingEvidence,
      claims: { testGreenAloneSufficient: false, rawTestOutputStored: false, ambiguousPatternsBlockAutomatically: false },
    });
  }
}
