import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { expectedFrontierAuditCounts } from './frontier-audit-counts.mjs';
import { ADAPTIVE_LEARNING_TRUST_REQUIREMENT_IDS } from '../../scripts/measure-adaptive-learning-trust-fabric.mjs';

const SHA = /^[a-f0-9]{64}$/;
const releaseAtLeastFour = (version) => Number(String(version).split('.')[0]) >= 4;
async function source(root, relative, failures) { try { return await readFile(path.join(root, relative), 'utf8'); } catch { failures.push(`missing ${relative}`); return ''; } }
async function present(root, relative, failures) { try { await access(path.join(root, relative)); } catch { failures.push(`missing ${relative}`); } }
function exactArray(a, b) { return Array.isArray(a) && a.length === b.length && a.every((item, index) => item === b[index]); }
function statusMap(audit) { return new Map((audit?.sections ?? []).flatMap((section) => section.items ?? []).map((item) => [item.id, item.status])); }

export async function verifyAdaptiveLearningTrustFabric({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory); const releaseVersion = String(version ?? ''); const failures = [];
  const required = [
    'src/learning/task-feature-encoder.mjs','src/learning/held-out-policy-evaluator.mjs','src/learning/cohort-canary-governor.mjs','src/learning/strategy-policy-learner.mjs','src/learning/domain-trust-ledger.mjs','src/learning/model-switch-coordinator.mjs','src/learning/adaptive-learning-control-plane.mjs','src/development/teacher-challenge-lab.mjs',
    'tests/task-feature-held-out-evaluator.test.mjs','tests/cohort-canary-strategy-learning.test.mjs','tests/domain-trust-model-switch.test.mjs','tests/adaptive-learning-developmental-challenges.test.mjs','tests/adaptive-learning-trust-fabric-integration.test.mjs','tests/adaptive-learning-trust-fabric-release-gate.test.mjs',
  ];
  for (const file of required) await present(root, file, failures);
  const app = await source(root, 'src/app.mjs', failures);
  if (/AdaptiveLearningControlPlane|adaptive-learning-control-plane/.test(app)) failures.push('src/app.mjs must not construct AdaptiveLearningControlPlane directly');

  let measurement = null;
  try { measurement = JSON.parse(await source(root, `docs/adaptive-learning-trust-fabric-measurement-${releaseVersion}.json`, failures)); } catch { failures.push('measurement JSON invalid'); }
  if (measurement) {
    if (measurement.version !== releaseVersion) failures.push('measurement version mismatch');
    if (!exactArray(measurement.promotedRequirementIds, ADAPTIVE_LEARNING_TRUST_REQUIREMENT_IDS)) failures.push('measurement requirement ids mismatch');
    for (const [label, value] of [...Object.entries(measurement.routing ?? {}), ...Object.entries(measurement.trustAndDevelopment ?? {})]) if (value !== true) failures.push(`${label} not measured`);
    if (Object.values(measurement.boundaries ?? {}).some((value) => value !== false)) failures.push('measurement boundaries inflated');
    if (Object.values(measurement.privacy ?? {}).some((value) => value !== false)) failures.push('measurement privacy boundary violated');
    if (measurement.rootDirectoryUsedForClaims !== false) failures.push('environment path leaked into claims');
    const unsigned = { ...measurement }; delete unsigned.receiptSha256;
    if (!SHA.test(measurement.receiptSha256 ?? '') || canonicalSha256(unsigned) !== measurement.receiptSha256) failures.push('measurement receipt invalid');
  }

  let audit = null;
  try { audit = JSON.parse(await source(root, `docs/feature-audit-${releaseVersion}.json`, failures)); } catch { failures.push('audit JSON invalid'); }
  const expected = expectedFrontierAuditCounts(releaseVersion);
  if (!audit || audit.totalItems !== 1150 || JSON.stringify(audit.summary) !== JSON.stringify(expected)) failures.push('frontier audit transition mismatch');
  const statuses = statusMap(audit);
  for (const id of ADAPTIVE_LEARNING_TRUST_REQUIREMENT_IDS) if (statuses.get(id) !== 'verified_source_test') failures.push(`requirement not verified: ${id}`);
  if (!releaseAtLeastFour(releaseVersion) && (audit?.summary?.external_gate ?? -1) !== 63) failures.push('external gate count changed');

  const limitations = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  for (const phrase of ['does not change production routing automatically','does not use held-out tasks for tuning','does not certify long-term patch survival without delayed verified observations','does not expose teacher oracle to executor','does not claim benchmark superiority']) if (!limitations.includes(phrase)) failures.push(`missing limitation: ${phrase}`);

  const base = { schema: 'forge.studio.adaptive-learning-trust-fabric-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass', failures, promotedRequirementIds: ADAPTIVE_LEARNING_TRUST_REQUIREMENT_IDS, auditCounts: audit?.summary ?? null, boundaries: measurement?.boundaries ?? null, measurementReceiptSha256: measurement?.receiptSha256 ?? null };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { await mkdir(path.dirname(outputFile), { recursive: true }); await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) { const error = new Error(`Adaptive Learning Trust Fabric verification failed: ${failures.join('; ')}`); error.report = report; throw error; }
  return report;
}
