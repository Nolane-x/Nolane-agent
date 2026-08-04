import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { expectedFrontierAuditCounts } from './frontier-audit-counts.mjs';
const SHA = /^[a-f0-9]{64}$/i;
async function source(root, file, failures) { try { return await readFile(path.join(root, file), 'utf8'); } catch { failures.push(`missing ${file}`); return ''; } }
async function present(root, file, failures) { try { await access(path.join(root, file)); } catch { failures.push(`missing ${file}`); } }
function required(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(`missing behavior: ${label}`); }
function expectedAuditFor(version) { return expectedFrontierAuditCounts(version); }
export async function verifyComparativeCertification({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory); const releaseVersion = String(version ?? ''); const failures = [];
  const files = ['src/benchmark/benchmark-schema.mjs','src/benchmark/comparability-contract.mjs','src/benchmark/contamination-guard.mjs','src/benchmark/benchmark-runner.mjs','src/benchmark/benchmark-scorer.mjs','src/benchmark/run-evidence-journal.mjs','src/benchmark/failure-taxonomy.mjs','src/benchmark/independent-attestation.mjs','src/benchmark/comparative-certification-service.mjs','tests/benchmark-comparability-contract.test.mjs','tests/benchmark-certified-evidence.test.mjs','tests/comparative-certification-service.test.mjs','tests/vscode-security-certification-state.test.mjs'];
  for (const file of files) await present(root, file, failures);
  const [schema, contract, contamination, runner, scorer, journal, attestation, certification, routes, ui, vscode] = await Promise.all(['src/benchmark/benchmark-schema.mjs','src/benchmark/comparability-contract.mjs','src/benchmark/contamination-guard.mjs','src/benchmark/benchmark-runner.mjs','src/benchmark/benchmark-scorer.mjs','src/benchmark/run-evidence-journal.mjs','src/benchmark/independent-attestation.mjs','src/benchmark/comparative-certification-service.mjs','src/server/routes.mjs','ui/collaboration-experience-center.js','extensions/vscode/src/mission-state.ts'].map((file) => source(root, file, failures)));
  required(schema, /(?=[\s\S]*schemaVersion)(?=[\s\S]*distribution)(?=[\s\S]*machineFingerprint)(?=[\s\S]*permissions)(?=[\s\S]*maxRssMb)/, 'locked benchmark schema v2', failures);
  required(contract, /model-mismatch[\s\S]*machine-mismatch[\s\S]*budget-mismatch[\s\S]*permission-mismatch/, 'comparability contract', failures);
  required(contamination, /private-held-out|hidden-case-fingerprint-exposed[\s\S]*contaminationProvenAbsent:\s*false/, 'contamination guard', failures);
  required(runner, /peakRssMb[\s\S]*rssMbSeconds[\s\S]*corrections[\s\S]*artifacts/, 'certified benchmark run evidence', failures);
  required(scorer, /functionalConfidence95[\s\S]*latencyVariance[\s\S]*keepRate[\s\S]*minimumTasks/, 'variance and confidence scoring', failures);
  required(journal, /rawCommandStored:\s*false[\s\S]*rawOutputStored:\s*false/, 'bounded evidence journal', failures);
  required(attestation, /runDigest[\s\S]*signature[\s\S]*claimantSystem/, 'independent attestation binding', failures);
  required(certification, /fake-provider-present[\s\S]*independent-attestation-missing[\s\S]*minimum-common-task-threshold[\s\S]*platformMatrixCertified:\s*false/, 'comparative claim lock', failures);
  required(routes, /security-certification\/benchmark\/certify/, 'bounded certification API', failures);
  required(ui, /comparativeSuperiorityProven/, 'web non-claim surface', failures);
  required(vscode, /(?:forge\.vscode-security-certification-state\.v1|nolane\.agent\.vscode-security-certification-state\.v1)[\s\S]*comparativeSuperiorityProven/, 'VS Code bounded certification projection', failures);
  let measurement = null; try { measurement = JSON.parse(await source(root, `docs/security-certification-measurement-${releaseVersion}.json`, failures)); } catch { failures.push('measurement JSON invalid'); }
  if (measurement) {
    if (measurement.version !== releaseVersion) failures.push('measurement version mismatch');
    for (const [label, value] of Object.entries({ comparableContractPassed: measurement.certification?.comparableContractPassed, mismatchRejected: measurement.certification?.mismatchRejected, contaminationBlocked: measurement.certification?.contaminationBlocked, evidenceBounded: measurement.certification?.evidenceBounded, fakeProviderExcluded: measurement.certification?.fakeProviderExcluded })) if (value !== true) failures.push(`${label} not measured`);
    if (measurement.certification?.externalComparativeClaimAllowed !== false) failures.push('external comparative claim must remain locked');
    if (measurement.boundaries?.realCompetitorRunsPresent !== false || measurement.boundaries?.independentSuperiorityAttested !== false || measurement.boundaries?.comparativeSuperiorityClaimed !== false) failures.push('comparative boundary inflated');
    const unsigned = { ...measurement }; delete unsigned.receiptSha256; if (!SHA.test(measurement.receiptSha256 ?? '') || canonicalSha256(unsigned) !== measurement.receiptSha256) failures.push('measurement receipt invalid');
  }
  let audit = null; try { audit = JSON.parse(await source(root, `docs/feature-audit-${releaseVersion}.json`, failures)); } catch { failures.push('audit JSON invalid'); }
  if (!audit || audit.totalItems !== 1150 || JSON.stringify(audit.summary) !== JSON.stringify(expectedAuditFor(releaseVersion))) failures.push('frontier audit transition mismatch');
  const limitations = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures); for (const phrase of ['does not certify real competitor benchmark runs','does not certify a private held-out suite','does not claim comparative superiority']) if (!limitations.includes(phrase)) failures.push(`missing limitation: ${phrase}`);
  const base = { schema: 'forge.studio.comparative-certification-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass', failures, measurement, boundaries: measurement?.boundaries ?? {} }; const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { await mkdir(path.dirname(outputFile), { recursive: true }); await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) throw Object.assign(new Error(`Comparative Certification verification failed: ${failures.join('; ')}`), { report }); return report;
}
