import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { CONSTRUCTION_SAFETY_COMPLETION_REQUIREMENT_IDS } from '../../scripts/measure-construction-safety-completion.mjs';
import { expectedFrontierAuditCounts } from './frontier-audit-counts.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const releaseAtLeastFour = (version) => Number(String(version).split('.')[0]) >= 4;
const REQUIRED_FILES = Object.freeze([
  'src/construction/construction-contract-runtime.mjs',
  'src/construction/semantic-change-safety-runtime.mjs',
  'src/verification/independent-verification-runtime.mjs',
  'src/cognition/causal-intervention-lab.mjs',
  'src/world-model/counterfactual-change-runtime.mjs',
  'src/construction/construction-control-plane.mjs',
  'src/verification/verification-control-plane.mjs',
  'src/cognition/cognitive-kernel.mjs',
  'src/runtime/world-development-plane.mjs',
  'tests/construction-contract-runtime.test.mjs',
  'tests/semantic-change-safety-runtime.test.mjs',
  'tests/independent-verification-runtime.test.mjs',
  'tests/causal-counterfactual-runtime.test.mjs',
  'tests/construction-safety-completion-integration.test.mjs',
  'tests/construction-safety-completion-release-gate.test.mjs',
  'scripts/measure-construction-safety-completion.mjs',
  'scripts/verify-construction-safety-completion.mjs',
]);

function exact(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function statusMap(audit) { return new Map((audit?.sections ?? []).flatMap((section) => section.items ?? []).map((item) => [String(item.id), String(item.status)])); }
async function readText(root, relative, failures) {
  try { return await readFile(path.join(root, relative), 'utf8'); }
  catch { failures.push(`missing ${relative}`); return ''; }
}
async function requireFile(root, relative, failures) {
  try { await access(path.join(root, relative)); }
  catch { failures.push(`missing ${relative}`); }
}
function allTrue(object, label, failures) {
  if (!object || typeof object !== 'object') { failures.push(`${label} missing`); return; }
  for (const [key, value] of Object.entries(object)) if (value !== true) failures.push(`${label}.${key} is not true`);
}

function verifyMeasurement(measurement, version, failures) {
  if (measurement?.schema !== 'forge.studio.construction-safety-completion-measurement.v1') failures.push('measurement schema invalid');
  if (measurement?.version !== version) failures.push('measurement version mismatch');
  if (!exact(measurement?.promotedRequirementIds, CONSTRUCTION_SAFETY_COMPLETION_REQUIREMENT_IDS)) failures.push('measurement promoted requirement ids mismatch');
  allTrue(measurement?.construction, 'construction', failures);
  allTrue(measurement?.changeSafety, 'changeSafety', failures);
  allTrue(measurement?.verification, 'verification', failures);
  allTrue(measurement?.counterfactual, 'counterfactual', failures);
  for (const [key, value] of Object.entries(measurement?.boundaries ?? {})) if (value !== false) failures.push(`inflated boundary claim: ${key}`);
  const unsigned = { ...measurement };
  delete unsigned.receiptSha256;
  if (!SHA256.test(String(measurement?.receiptSha256 ?? '')) || canonicalSha256(unsigned) !== measurement.receiptSha256) failures.push('measurement receipt invalid');
}

function verifyAudit(previous, current, version, failures) {
  const expected = expectedFrontierAuditCounts(version);
  if (current?.totalItems !== 1150) failures.push('audit total must remain 1150');
  if (!exact(current?.summary, expected)) failures.push(`audit counts mismatch: ${JSON.stringify(current?.summary)} != ${JSON.stringify(expected)}`);
  if (!releaseAtLeastFour(version) && current?.summary?.external_gate !== previous?.summary?.external_gate) failures.push('external gate count changed');
  const before = statusMap(previous); const after = statusMap(current);
  const initialConstructionSafetyRelease = String(version).startsWith('3.4.');
  if (initialConstructionSafetyRelease) {
    const changed = [...after].filter(([id, status]) => before.get(id) !== status).map(([id]) => id).sort();
    const promoted = [...CONSTRUCTION_SAFETY_COMPLETION_REQUIREMENT_IDS].sort();
    if (!exact(changed, promoted)) failures.push(`audit changed ids mismatch: ${JSON.stringify(changed)}`);
  }
  for (const id of CONSTRUCTION_SAFETY_COMPLETION_REQUIREMENT_IDS) {
    if (initialConstructionSafetyRelease && before.get(id) !== 'partial') failures.push(`${id} was not partial in 3.3.0`);
    if (!initialConstructionSafetyRelease && before.get(id) !== 'verified_source_test') failures.push(`Construction Safety Completion baseline guarantee missing for ${id}`);
    if (after.get(id) !== 'verified_source_test') failures.push(`Construction Safety Completion guarantee regressed for ${id}`);
    const item = (current.sections ?? []).flatMap((section) => section.items ?? []).find((entry) => entry.id === id);
    if (!item?.evidence?.some((entry) => String(entry).includes('construction-safety-completion-measurement'))) failures.push(`${id} lacks Construction Safety Completion measurement evidence`);
  }
}

function verifyNonClaims(limitations, appSource, failures) {
  const requiredPhrases = [
    '63 external gate',
    'không tuyên bố vượt',
    'mô phỏng và can thiệp nhân quả không phải bằng chứng production',
    'hidden regression được mã hóa',
    'candidate worktree không tự động merge',
  ];
  for (const phrase of requiredPhrases) if (!limitations.toLowerCase().includes(phrase.toLowerCase())) failures.push(`missing limitation non-claim: ${phrase}`);
  for (const moduleName of ['construction-contract-runtime','semantic-change-safety-runtime','independent-verification-runtime','causal-intervention-lab','counterfactual-change-runtime']) {
    if (appSource.includes(moduleName)) failures.push(`src/app.mjs directly imports lazy runtime: ${moduleName}`);
  }
}

export async function verifyConstructionSafetyCompletion({ rootDirectory = process.cwd(), version = '3.4.0', outputFile = 'release/construction-safety-completion-report.json' } = {}) {
  const root = path.resolve(rootDirectory);
  const failures = [];
  for (const relative of REQUIRED_FILES) await requireFile(root, relative, failures);
  let measurement = null; let previous = null; let current = null;
  try { measurement = JSON.parse(await readText(root, `docs/construction-safety-completion-measurement-${version}.json`, failures)); } catch { failures.push('measurement JSON invalid'); }
  const initialConstructionSafetyRelease = String(version).startsWith('3.4.');
  const baselineVersion = initialConstructionSafetyRelease ? '3.3.0' : '3.4.0';
  try { previous = JSON.parse(await readText(root, `docs/feature-audit-${baselineVersion}.json`, failures)); } catch { failures.push(`${baselineVersion} audit JSON invalid`); }
  try { current = JSON.parse(await readText(root, `docs/feature-audit-${version}.json`, failures)); } catch { failures.push(`${version} audit JSON invalid`); }
  const limitations = await readText(root, `docs/LIMITATIONS-${version}.md`, failures);
  const appSource = await readText(root, 'src/app.mjs', failures);
  if (measurement) verifyMeasurement(measurement, version, failures);
  if (previous && current) verifyAudit(previous, current, version, failures);
  verifyNonClaims(limitations, appSource, failures);

  const boundaries = {
    externalGateCountChanged: !releaseAtLeastFour(version) && current?.summary?.external_gate !== previous?.summary?.external_gate,
    comparativeSuperiorityClaimed: !limitations.toLowerCase().includes('không tuyên bố vượt'),
    simulationClaimedAsObserved: !limitations.toLowerCase().includes('mô phỏng và can thiệp nhân quả không phải bằng chứng production'),
    selfReviewAccepted: measurement?.boundaries?.selfReviewAccepted !== false,
    hiddenExpectedExposed: measurement?.boundaries?.hiddenExpectedExposed !== false,
  };
  const base = {
    schema: 'forge.studio.construction-safety-completion-verification.v1',
    version: String(version),
    status: failures.length ? 'fail' : 'pass',
    promotedRequirementIds: CONSTRUCTION_SAFETY_COMPLETION_REQUIREMENT_IDS,
    auditCounts: current?.summary ?? null,
    measurementReceiptSha256: measurement?.receiptSha256 ?? null,
    boundaries,
    failures,
  };
  const report = { ...base, receiptSha256: canonicalSha256(base) };
  const target = path.resolve(root, outputFile);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(report, null, 2)}\n`);
  if (failures.length) {
    const error = new Error(`Construction Safety Completion verification failed:\n- ${failures.join('\n- ')}`);
    error.report = report;
    throw error;
  }
  return Object.freeze(report);
}
