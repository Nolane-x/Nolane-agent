#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBindingCoverage, createAssertionBinding } from '../src/forensics/assertion-evidence-binding.mjs';
import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const NEGATIVE = /\b(reject|refuse|deny|block|fail|invalid|missing|stale|unknown|unsafe|without|cannot|does not|doesn't|not |no |throws|rejects|false)\b/i;
const ASSERTION = /\bassert\.(?:equal|deepEqual|strictEqual|ok|match|doesNotMatch|throws|rejects|notEqual|notDeepEqual|ifError)\s*\([^\n;]+/g;
const TEST_NAME = /\b(?:test|it)\s*\(\s*(['"`])([^'"`\n]+)\1/g;

async function exists(file) { try { await access(file); return true; } catch { return false; } }
function extractEvidence(source) {
  const names = [...source.matchAll(TEST_NAME)].map((match) => match[2].trim()).filter(Boolean);
  const assertions = [...source.matchAll(ASSERTION)].map((match) => match[0].replace(/\s+/g, ' ').trim());
  const positiveAssertions = assertions.filter((item) => !NEGATIVE.test(item));
  const negativeAssertions = assertions.filter((item) => NEGATIVE.test(item));
  const positiveNames = names.filter((item) => !NEGATIVE.test(item));
  const negativeNames = names.filter((item) => NEGATIVE.test(item));
  return {
    names,
    positiveAssertions: [...new Set([...positiveAssertions, ...positiveNames.map((name) => `named-test-pass:${name}`)])],
    negativeAssertions: [...new Set([...negativeAssertions, ...negativeNames.map((name) => `named-test-negative:${name}`)])],
  };
}

export async function generateAssertionEvidenceBindings({ root = process.cwd(), write = true } = {}) {
  const requirementsPath = path.join(root, 'requirements/nolane-agent-v5-requirements.json');
  const registry = JSON.parse(await readFile(requirementsPath, 'utf8'));
  const requirements = registry.requirements.filter((item) => /^(NOL-UI|NOL-AUDIT)-/.test(item.id));
  const bindings = [];
  for (const requirement of requirements) {
    const acceptance = requirement.acceptance ?? {};
    const entrypoint = String(acceptance.entrypoint ?? '').replaceAll('\\', '/');
    const testFile = String(acceptance.exactTest ?? '').replaceAll('\\', '/');
    if (!entrypoint || entrypoint.startsWith('docs/') || !testFile) continue;
    const entrypointPath = path.join(root, entrypoint); const testPath = path.join(root, testFile);
    if (!await exists(entrypointPath) || !await exists(testPath)) continue;
    const [entrypointBytes, testBytes] = await Promise.all([readFile(entrypointPath), readFile(testPath)]);
    const evidence = extractEvidence(testBytes.toString('utf8'));
    if (evidence.names.length === 0 || evidence.positiveAssertions.length === 0 || evidence.negativeAssertions.length === 0) continue;
    const replayReceipt = acceptance.replayReceiptSha256;
    if (!/^[a-f0-9]{64}$/.test(replayReceipt ?? '')) continue;
    bindings.push(createAssertionBinding({
      requirementId: requirement.id,
      productionEntrypoints: [entrypoint],
      productionEntrypointSha256: [sha256(entrypointBytes)],
      testFile,
      testFileSha256: sha256(testBytes),
      namedTests: evidence.names,
      positiveAssertions: evidence.positiveAssertions,
      negativeAssertions: evidence.negativeAssertions,
      receiptSha256: replayReceipt,
      environment: acceptance.evidence?.environment ?? 'node>=22.12',
      external: requirement.status === 'external_gate',
    }));
  }
  bindings.sort((a, b) => a.requirementId.localeCompare(b.requirementId));
  const coverage = buildBindingCoverage({ requirements, bindings, maxRequirementsPerTest: 25 });
  const base = { schema: 'nolane.forensics.assertion-evidence-binding-baseline.v1', requirementsScope: Object.freeze(['NOL-UI-*', 'NOL-AUDIT-*']), bindings, coverage };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  const outputJsonl = path.join(root, 'requirements/assertion-evidence-bindings.jsonl');
  const outputJson = path.join(root, 'docs/checkpoints/ASSERTION-EVIDENCE-BINDING-BASELINE.json');
  const outputMd = path.join(root, 'docs/checkpoints/ASSERTION-EVIDENCE-BINDING-BASELINE.md');
  if (write) {
    await mkdir(path.dirname(outputJsonl), { recursive: true }); await mkdir(path.dirname(outputJson), { recursive: true });
    await writeFile(outputJsonl, bindings.length ? `${bindings.map((item) => JSON.stringify(item)).join('\n')}\n` : '');
    await writeFile(outputJson, `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(outputMd, `# Assertion Evidence Binding Baseline\n\n- Requirements in scope: ${coverage.summary.requirementsTotal}\n- Bound: ${coverage.summary.requirementsBound}\n- Unbound: ${coverage.summary.requirementsUnbound}\n- Positive-bound: ${coverage.summary.requirementsPositiveBound}\n- Negative-bound: ${coverage.summary.requirementsNegativeBound}\n- Over-broad test files: ${coverage.summary.overBroadTestFiles}\n- Certifiable: **${coverage.certifiable}**\n- Receipt: \`${report.receiptSha256}\`\n\nUnbound requirements remain explicitly unverified at assertion level. File existence is not accepted as behavior proof.\n`);
  }
  return Object.freeze({ bindings: Object.freeze(bindings), coverage, receiptSha256: report.receiptSha256, outputJsonl, outputJson, outputMd });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) generateAssertionEvidenceBindings({}).then((result) => console.log(JSON.stringify({ bindings: result.bindings.length, summary: result.coverage.summary, receiptSha256: result.receiptSha256 }))).catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
