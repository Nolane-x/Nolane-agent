import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { expectedFrontierAuditCounts } from './frontier-audit-counts.mjs';

const SHA = /^[a-f0-9]{64}$/;
async function source(root, relative, failures) { try { return await readFile(path.join(root, relative), 'utf8'); } catch { failures.push(`missing ${relative}`); return ''; } }
async function present(root, relative, failures) { try { await access(path.join(root, relative)); } catch { failures.push(`missing ${relative}`); } }
function requirePattern(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(`missing behavior: ${label}`); }

export async function verifyLongHorizonConstruction({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? '');
  const failures = [];
  const required = [
    'src/construction/specification-compiler.mjs','src/construction/requirement-traceability-ledger.mjs','src/construction/invariant-ledger.mjs',
    'src/construction/executable-plan-engine.mjs','src/construction/state-capsule-store.mjs','src/construction/prospective-obligation-ledger.mjs',
    'src/construction/goal-conflict-resolver.mjs','src/construction/semantic-patch-analyzer.mjs','src/construction/dynamic-patch-budget.mjs',
    'src/construction/test-impact-selector.mjs','src/construction/candidate-patch-selector.mjs','src/construction/completion-proof-builder.mjs',
    'src/construction/construction-control-plane.mjs','tests/specification-compiler.test.mjs','tests/requirement-traceability-ledger.test.mjs',
    'tests/invariant-ledger.test.mjs','tests/executable-plan-engine.test.mjs','tests/state-capsule-store.test.mjs',
    'tests/prospective-obligation-ledger.test.mjs','tests/goal-conflict-resolver.test.mjs','tests/semantic-patch-analyzer.test.mjs',
    'tests/dynamic-patch-budget.test.mjs','tests/test-impact-selector.test.mjs','tests/candidate-patch-selector.test.mjs',
    'tests/completion-proof-builder.test.mjs','tests/construction-control-plane.test.mjs','tests/construction-decision-plane-integration.test.mjs','tests/agent-loop-construction-mode.test.mjs',
  ];
  for (const file of required) await present(root, file, failures);
  const spec = await source(root, 'src/construction/specification-compiler.mjs', failures);
  const trace = await source(root, 'src/construction/requirement-traceability-ledger.mjs', failures);
  const invariant = await source(root, 'src/construction/invariant-ledger.mjs', failures);
  const plan = await source(root, 'src/construction/executable-plan-engine.mjs', failures);
  const capsule = await source(root, 'src/construction/state-capsule-store.mjs', failures);
  const patch = await source(root, 'src/construction/semantic-patch-analyzer.mjs', failures);
  const budget = await source(root, 'src/construction/dynamic-patch-budget.mjs', failures);
  const candidate = await source(root, 'src/construction/candidate-patch-selector.mjs', failures);
  const proof = await source(root, 'src/construction/completion-proof-builder.mjs', failures);
  const control = await source(root, 'src/construction/construction-control-plane.mjs', failures);
  const decision = await source(root, 'src/decision/decision-plane.mjs', failures);
  const agent = await source(root, 'src/agent/agent-loop.mjs', failures);
  const app = await source(root, 'src/app.mjs', failures);
  requirePattern(spec, /verificationPlan[\s\S]*contradictionFindings[\s\S]*editAuthorized/, 'specification compilation and contradiction gate', failures);
  requirePattern(trace, /criterionCompletion[\s\S]*verification[\s\S]*reachable/, 'requirement-to-verification traceability', failures);
  requirePattern(invariant, /owner[\s\S]*severity[\s\S]*verifierId[\s\S]*staleInvariantIds/, 'owned invariant authorization', failures);
  requirePattern(plan, /milestones[\s\S]*allowedFiles[\s\S]*forbiddenChanges[\s\S]*revalidate/, 'hierarchical executable plan and revalidation', failures);
  requirePattern(capsule, /atomicWrite|rename\(temp, target\)|integrity check failed|revalidation-required/, 'atomic state capsule and drift-safe resume', failures);
  requirePattern(patch, /(?=[\s\S]*semanticFootprint)(?=[\s\S]*publicApiChanges)(?=[\s\S]*schemaChanges)(?=[\s\S]*permissionChanges)(?=[\s\S]*revertedLines)/, 'semantic patch footprint and correction lineage', failures);
  requirePattern(budget, /bugfix[\s\S]*feature[\s\S]*refactor[\s\S]*migration[\s\S]*expansion requires evidence/, 'dynamic patch budget', failures);
  requirePattern(candidate, /correctness-gate-failed[\s\S]*semanticFootprint[\s\S]*worktreesCreatedDirectly\s*:\s*false/, 'correctness-first candidate selection', failures);
  requirePattern(proof, /missingEvidence[\s\S]*rollback-point[\s\S]*completionClaimAllowed/, 'completion proof gate', failures);
  requirePattern(control, /compileSpecification[\s\S]*createPlan[\s\S]*analyzePatch[\s\S]*selectCandidate[\s\S]*directFileMutation\s*:\s*false/, 'construction control facade', failures);
  requirePattern(decision, /(?=[\s\S]*constructionLoaded)(?=[\s\S]*compileConstructionSpecification)(?=[\s\S]*constructionSnapshot)/, 'lazy Decision Plane construction integration', failures);
  requirePattern(agent, /constructionModeRequested[\s\S]*agent\.construction\.blocked[\s\S]*agent\.construction\.activated/, 'Agent Loop construction gate', failures);
  if (/ConstructionControlPlane/.test(app)) failures.push('src/app.mjs must not import or instantiate ConstructionControlPlane directly');

  let measurement = null;
  try { measurement = JSON.parse(await source(root, `docs/long-horizon-construction-measurement-${releaseVersion}.json`, failures)); }
  catch { failures.push('measurement JSON invalid'); }
  if (measurement) {
    if (measurement.version !== releaseVersion) failures.push('measurement version mismatch');
    if (!measurement.specification?.conflictBlocked) failures.push('specification conflict not measured');
    if (!measurement.traceability?.criterionCompleted) failures.push('traceability completion not measured');
    if (!measurement.invariants?.staleBlocks) failures.push('stale invariant blocking not measured');
    if (!measurement.plan?.hierarchical || !measurement.plan?.repositoryDriftBlocks) failures.push('hierarchical plan/revalidation not measured');
    if (!measurement.capsule?.exactResume || !measurement.capsule?.driftRequiresRevalidation) failures.push('capsule resume boundaries not measured');
    if (!measurement.obligation?.completedAfterTrigger) failures.push('prospective obligation not measured');
    if (!measurement.goals?.hardConstraintPreserved || measurement.goals?.hardConstraintsWeakened !== false) failures.push('goal conflict integrity not measured');
    if (!measurement.patch?.safePatchAllowed || !measurement.patch?.publicApiBreakBlocked || !measurement.patch?.overBudgetBlocked) failures.push('semantic patch gate not measured');
    if (!measurement.candidates?.correctnessFirst || !measurement.candidates?.semanticFootprintSelected || measurement.candidates?.worktreesCreatedDirectly !== false) failures.push('candidate ordering/boundary not measured');
    if (!measurement.proof?.completeWithReceipts || !measurement.proof?.incompleteWithoutReceipts) failures.push('completion proof not measured');
    if (measurement.composition?.appStaticImports > 160 || measurement.composition?.appConstructors > 180) failures.push('composition budget exceeded');
    if (Object.values(measurement.boundaries ?? {}).some((value) => value !== false)) failures.push('measurement boundaries inflated');
    const unsigned = { ...measurement }; delete unsigned.receiptSha256;
    if (!SHA.test(measurement.receiptSha256 ?? '') || canonicalSha256(unsigned) !== measurement.receiptSha256) failures.push('measurement receipt invalid');
  }

  let audit = null;
  try { audit = JSON.parse(await source(root, `docs/feature-audit-${releaseVersion}.json`, failures)); }
  catch { failures.push('audit JSON invalid'); }
  const expected = expectedFrontierAuditCounts(releaseVersion);
  if (!audit || audit.totalItems !== 1150 || JSON.stringify(audit.summary) !== JSON.stringify(expected)) failures.push('frontier audit transition mismatch');
  const limitations = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  for (const phrase of ['does not create candidate worktrees directly','does not certify cross-reboot recovery on every operating system','does not claim benchmark superiority']) if (!limitations.includes(phrase)) failures.push(`missing limitation: ${phrase}`);

  const base = { schema: 'forge.studio.long-horizon-construction-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass', failures, measurement, auditSummary: audit?.summary ?? null, boundaries: measurement?.boundaries ?? null };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { await mkdir(path.dirname(outputFile), { recursive: true }); await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) { const error = new Error(`Long-horizon construction verification failed: ${failures.join('; ')}`); error.report = report; throw error; }
  return report;
}
