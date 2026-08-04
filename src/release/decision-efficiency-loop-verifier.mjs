import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const SHA = /^[a-f0-9]{64}$/;
async function source(root, relative, failures) { try { return await readFile(path.join(root, relative), 'utf8'); } catch { failures.push(`missing ${relative}`); return ''; } }
async function present(root, relative, failures) { try { await access(path.join(root, relative)); } catch { failures.push(`missing ${relative}`); } }
function requirePattern(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(`missing behavior: ${label}`); }

export async function verifyDecisionEfficiencyLoop({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory); const releaseVersion = String(version ?? ''); const failures = [];
  for (const file of ['src/decision/acceptance-criteria-ledger.mjs','src/decision/decision-receipt-service.mjs','src/decision/decision-efficiency-metrics.mjs','src/decision/decision-plane.mjs','tests/acceptance-criteria-ledger.test.mjs','tests/decision-receipt-service.test.mjs','tests/decision-efficiency-metrics.test.mjs','tests/verification-criteria-binding.test.mjs','tests/decision-plane-app-wiring.test.mjs','tests/decision-efficiency-ui.test.mjs']) await present(root, file, failures);
  const ledger = await source(root, 'src/decision/acceptance-criteria-ledger.mjs', failures);
  const receipt = await source(root, 'src/decision/decision-receipt-service.mjs', failures);
  const metrics = await source(root, 'src/decision/decision-efficiency-metrics.mjs', failures);
  const verification = await source(root, 'src/orchestration/verification-runner.mjs', failures);
  requirePattern(ledger, /verifiedCriteriaScore[\s\S]*verifiedWeight[\s\S]*receiptSha256/, 'criterion score requires valid receipt', failures);
  requirePattern(receipt, /FORBIDDEN_KEYS[\s\S]*chainofthought[\s\S]*rawprompt[\s\S]*modeloutput/, 'privacy-safe public Decision Receipt', failures);
  requirePattern(metrics, /(?=[\s\S]*tokenYield)(?=[\s\S]*memoryYield)(?=[\s\S]*editYield)(?=[\s\S]*revertedLines)(?=[\s\S]*correctionCycles)/, 'verified decision efficiency yields', failures);
  requirePattern(verification, /forge\.acceptance-criterion-verification\.v1[\s\S]*verifiedCriterionIds[\s\S]*unverifiedCriterionIds/, 'verification bound to criteria', failures);
  let measurement = null; try { measurement = JSON.parse(await source(root, `docs/decision-efficiency-loop-measurement-${releaseVersion}.json`, failures)); } catch { failures.push('measurement JSON is invalid'); }
  if (measurement) {
    if (measurement.version !== releaseVersion) failures.push('measurement version mismatch');
    if (measurement.criteria?.verifiedCriteriaScore !== measurement.criteria?.totalCriteriaWeight) failures.push('measurement criteria are not fully verified');
    for (const key of ['tokenYield','memoryYield','editYield']) if (!(measurement.efficiency?.[key] > 0)) failures.push(`${key} was not measured`);
    if (measurement.privacy?.rawPromptRejected !== true || measurement.privacy?.modelOutputRejected !== true || measurement.privacy?.rawPrivatePayloadStored !== false) failures.push('private payload rejection was not measured');
    if (measurement.composition?.appStaticImports > 160 || measurement.composition?.appConstructors > 180) failures.push('app composition budget exceeded');
    const unsigned = { ...measurement }; delete unsigned.receiptSha256;
    if (!SHA.test(measurement.receiptSha256 ?? '') || canonicalSha256(unsigned) !== measurement.receiptSha256) failures.push('measurement receipt invalid');
  }
  let audit = null; try { audit = JSON.parse(await source(root, `docs/feature-audit-${releaseVersion}.json`, failures)); } catch { failures.push('frontier audit JSON invalid'); }
  const requiredVerified = new Set(['29.1','29.2','29.4','29.5','29.6','29.7','29.9','29.10','29.11','29.12','29.15','29.18','30.1','30.3','30.4','30.5','30.6','30.7','30.8','30.9','30.10','30.11','30.12','30.16','30.18']);
  const requiredAtLeastPartial = new Set(['29.3','29.8','29.13','29.14','29.16','30.2','30.17']);
  const auditItems = new Map((audit?.sections ?? []).flatMap((section) => section.items ?? []).map((item) => [String(item.id), item]));
  const summaryTotal = Object.values(audit?.summary ?? {}).reduce((sum, value) => sum + Number(value || 0), 0);
  if (!audit || audit.totalItems !== 1150 || summaryTotal !== 1150 || Number(audit.summary?.verified_source_test ?? 0) < 759) failures.push('1,150-item audit summary regressed below the 2.20 baseline');
  for (const id of requiredVerified) if (auditItems.get(id)?.status !== 'verified_source_test') failures.push(`2.20 verified requirement regressed: ${id}`);
  for (const id of requiredAtLeastPartial) if (!['partial','verified_source_test'].includes(auditItems.get(id)?.status)) failures.push(`2.20 partial requirement regressed: ${id}`);
  const limitations = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  for (const [pattern,label] of [[/does not claim.*outperform|không.*vượt.*Cursor|comparative superiority/i,'comparative non-claim'],[/shadow.*(?:does not|do not).*change|shadow.*không.*đổi.*router/i,'shadow routing non-claim'],[/contextTokensActuallyUseful.*not.*causal|không.*chứng minh.*context.*hữu ích/i,'useful-context limitation']]) requirePattern(limitations, pattern, label, failures);
  const boundaries = Object.freeze({ comparativeSuperiorityClaimed: false, autonomousRoutingClaimed: false, causalContextUsefulnessClaimed: false, independentRepositoryBenchmarkClaimed: false });
  const base = { schema: 'forge.studio.decision-efficiency-loop-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass', auditCounts: audit?.summary ?? null, measurement, boundaries, failures: Object.freeze(failures) };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { await mkdir(path.dirname(path.resolve(outputFile)), { recursive: true }); await writeFile(path.resolve(outputFile), `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) { const error = new Error(`Decision Efficiency Loop verification failed with ${failures.length} issue(s)`); error.code='DECISION_EFFICIENCY_LOOP_VERIFICATION_FAILED'; error.report=report; throw error; }
  return report;
}
