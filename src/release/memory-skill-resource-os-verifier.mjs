import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { expectedFrontierAuditCounts } from './frontier-audit-counts.mjs';

const SHA = /^[a-f0-9]{64}$/;
async function source(root, relative, failures) { try { return await readFile(path.join(root, relative), 'utf8'); } catch { failures.push(`missing ${relative}`); return ''; } }
async function present(root, relative, failures) { try { await access(path.join(root, relative)); } catch { failures.push(`missing ${relative}`); } }
function requirePattern(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(`missing behavior: ${label}`); }

export async function verifyMemorySkillResourceOs({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? '');
  const failures = [];
  const required = [
    'src/memory/memory-operating-system.mjs','src/memory/memory-policy-controller.mjs','src/memory/model-time-clock.mjs','src/memory/replay-scheduler.mjs',
    'src/skills/compositional-skill-compiler.mjs','src/skills/skill-registry.mjs','src/skills/stability-plasticity-guard.mjs',
    'src/runtime/resource-admission-controller.mjs','src/runtime/viability-region-controller.mjs','src/runtime/local-device-doctor.mjs','src/runtime/resource-lifecycle-coordinator.mjs','src/runtime/memory-skill-resource-plane.mjs','src/storage/content-addressed-artifact-store.mjs',
    'tests/memory-operating-system.test.mjs','tests/memory-policy-controller.test.mjs','tests/replay-scheduler.test.mjs','tests/compositional-skill-compiler.test.mjs','tests/stability-plasticity-guard.test.mjs','tests/resource-admission-controller.test.mjs','tests/content-addressed-artifact-store.test.mjs','tests/memory-skill-resource-plane.test.mjs',
  ];
  for (const file of required) await present(root, file, failures);

  const memory = await source(root, 'src/memory/memory-operating-system.mjs', failures);
  const policy = await source(root, 'src/memory/memory-policy-controller.mjs', failures);
  const replay = await source(root, 'src/memory/replay-scheduler.mjs', failures);
  const modelTime = await source(root, 'src/memory/model-time-clock.mjs', failures);
  const compiler = await source(root, 'src/skills/compositional-skill-compiler.mjs', failures);
  const registry = await source(root, 'src/skills/skill-registry.mjs', failures);
  const stability = await source(root, 'src/skills/stability-plasticity-guard.mjs', failures);
  const admission = await source(root, 'src/runtime/resource-admission-controller.mjs', failures);
  const viability = await source(root, 'src/runtime/viability-region-controller.mjs', failures);
  const doctor = await source(root, 'src/runtime/local-device-doctor.mjs', failures);
  const artifacts = await source(root, 'src/storage/content-addressed-artifact-store.mjs', failures);
  const lifecycle = await source(root, 'src/runtime/resource-lifecycle-coordinator.mjs', failures);
  const plane = await source(root, 'src/runtime/memory-skill-resource-plane.mjs', failures);
  const decision = await source(root, 'src/decision/decision-plane.mjs', failures);
  const app = await source(root, 'src/app.mjs', failures);

  requirePattern(memory, /suppress[\s\S]*deprioritize[\s\S]*invalidate[\s\S]*archive[\s\S]*abstract[\s\S]*delete/, 'six governed memory lifecycle operations', failures);
  requirePattern(memory, /(?=[\s\S]*memory_versions)(?=[\s\S]*valid_from_ms)(?=[\s\S]*valid_until_ms)(?=[\s\S]*semantic_schema)(?=[\s\S]*exception)/, 'versioned layered memory schema', failures);
  requirePattern(policy, /ADD[\s\S]*UPDATE[\s\S]*DELETE[\s\S]*RETRIEVE[\s\S]*SUMMARIZE[\s\S]*NOOP[\s\S]*shadowOnly:\s*true/, 'governed shadow memory policy', failures);
  requirePattern(modelTime, /policyDrift[\s\S]*schemaChanges[\s\S]*correctionRate[\s\S]*rawStepsIgnored:\s*true/, 'model-time change clock', failures);
  requirePattern(replay, /predictionError[\s\S]*conflict[\s\S]*reverted[\s\S]*transferValue[\s\S]*modelInvoked:\s*false/, 'bounded value-driven replay', failures);
  requirePattern(compiler, /preconditions[\s\S]*parameters[\s\S]*effects[\s\S]*invariants[\s\S]*failureSignatures[\s\S]*rollback[\s\S]*decomposition/, 'typed compositional skill operator', failures);
  requirePattern(registry, /transfer test requires a different repository or vocabulary[\s\S]*transfer-tested[\s\S]*lineage/, 'skill transfer and lineage governance', failures);
  requirePattern(stability, /forwardTransfer[\s\S]*backwardTransfer[\s\S]*negativeTransfer[\s\S]*memoryGrowthRatio[\s\S]*automaticPromotionExecuted:\s*false/, 'stability-plasticity promotion guard', failures);
  requirePattern(admission, /model[\s\S]*browser[\s\S]*terminal[\s\S]*lsp[\s\S]*embedding[\s\S]*indexer[\s\S]*test[\s\S]*utilityPerMbSecond[\s\S]*rssMbSeconds/, 'resource leases and utility admission', failures);
  requirePattern(viability, /availableRamMb[\s\S]*diskFreeMb[\s\S]*errorRate[\s\S]*pendingIrreversibleActions[\s\S]*allowIrreversible/, 'predictive viability region', failures);
  requirePattern(doctor, /Lite[\s\S]*Balanced[\s\S]*Performance[\s\S]*appliedAutomatically:\s*false/, 'local device doctor profiles', failures);
  requirePattern(artifacts, /(?=[\s\S]*content-addressed-artifact)(?=[\s\S]*deduplicated)(?=[\s\S]*rawStoredInMemory:\s*false)(?=[\s\S]*artifact-tombstone)/, 'content-addressed bounded artifact store', failures);
  requirePattern(lifecycle, /mission-ownership-mismatch[\s\S]*process-identity-mismatch[\s\S]*terminateTree[\s\S]*unmatchedProcessKilled:\s*false/, 'mission-owned resource lifecycle cleanup', failures);
  requirePattern(plane, /decideMemoryPolicy[\s\S]*scheduleReplay[\s\S]*compileSkill[\s\S]*admitResource[\s\S]*putArtifact[\s\S]*productionPolicyChanged:\s*false/, 'lazy memory skill resource facade', failures);
  requirePattern(decision, /(?=[\s\S]*memorySkillResourceLoaded)(?=[\s\S]*scheduleMemoryReplay)(?=[\s\S]*compileCompositionalSkill)(?=[\s\S]*admitResource)/, 'Decision Plane memory-skill-resource integration', failures);
  if (/MemorySkillResourcePlane/.test(app)) failures.push('src/app.mjs must not import or instantiate MemorySkillResourcePlane directly');

  let measurement = null;
  try { measurement = JSON.parse(await source(root, `docs/memory-skill-resource-os-measurement-${releaseVersion}.json`, failures)); } catch { failures.push('measurement JSON invalid'); }
  if (measurement) {
    if (measurement.version !== releaseVersion) failures.push('measurement version mismatch');
    const expectedOps = ['abstract','archive','delete','deprioritize','invalidate','suppress'];
    if (JSON.stringify(measurement.memory?.operations) !== JSON.stringify(expectedOps)) failures.push('memory lifecycle operations were not measured');
    const checks = [
      ['version history', measurement.memory?.versionHistory], ['exception precedence', measurement.memory?.exceptionPrecedence], ['self-report rejection', measurement.policy?.selfReportRejected], ['verified consolidation', measurement.policy?.verifiedConsolidationAllowed], ['model-time raw-step rejection', measurement.replay?.modelTimeIgnoresRawSteps], ['reverted replay priority', measurement.replay?.revertedEpisodePrioritized], ['typed skill', measurement.skills?.typedOperator], ['transfer requirement', measurement.skills?.transferRequired], ['skill regression block', measurement.skills?.regressionBlocked], ['low-value browser denial', measurement.resources?.lowValueBrowserDenied], ['targeted test admission', measurement.resources?.targetedTestAdmitted], ['RSS-seconds measurement', measurement.resources?.rssMbSecondsMeasured], ['predicted eviction', measurement.resources?.predictedEviction], ['PID mismatch protection', measurement.resources?.pidMismatchProtected], ['artifact deduplication', measurement.artifacts?.deduplicated], ['lazy fast path', measurement.lazy?.fastPathUnloaded],
    ];
    for (const [label, value] of checks) if (value !== true) failures.push(`${label} not measured`);
    if (measurement.memory?.privacyDeletionContentRetained !== false) failures.push('privacy-deleted memory content was retained');
    if (measurement.artifacts?.rawBytesInSnapshot !== false || measurement.privacy?.rawArtifactsStoredInSnapshot !== false) failures.push('raw artifact bytes leaked into snapshots');
    if (measurement.privacy?.hiddenReasoningStored !== false || measurement.privacy?.rawPromptsStored !== false) failures.push('privacy boundary violated');
    if (measurement.replay?.modelInvoked !== false || measurement.skills?.automaticPromotionExecuted !== false) failures.push('automatic learning claim inflated');
    if (measurement.composition?.appStaticImports > 160 || measurement.composition?.appConstructors > 180) failures.push('composition budget exceeded');
    if (Object.values(measurement.boundaries ?? {}).some((value) => value !== false)) failures.push('measurement boundaries inflated');
    const unsigned = { ...measurement }; delete unsigned.receiptSha256;
    if (!SHA.test(measurement.receiptSha256 ?? '') || canonicalSha256(unsigned) !== measurement.receiptSha256) failures.push('measurement receipt invalid');
  }

  let audit = null;
  try { audit = JSON.parse(await source(root, `docs/feature-audit-${releaseVersion}.json`, failures)); } catch { failures.push('audit JSON invalid'); }
  const expected = expectedFrontierAuditCounts(releaseVersion);
  if (!audit || audit.totalItems !== 1150 || JSON.stringify(audit.summary) !== JSON.stringify(expected)) failures.push('frontier audit transition mismatch');
  const limitations = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  for (const phrase of ['does not change production memory policy','does not automatically promote skills','does not certify direct OS budget enforcement','does not certify long-term skill survival','does not claim benchmark superiority']) if (!limitations.includes(phrase)) failures.push(`missing limitation: ${phrase}`);

  const base = { schema: 'forge.studio.memory-skill-resource-os-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass', failures, measurement, auditSummary: audit?.summary ?? null, boundaries: measurement?.boundaries ?? null };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { await mkdir(path.dirname(outputFile), { recursive: true }); await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) { const error = new Error(`Memory Skill Resource OS verification failed: ${failures.join('; ')}`); error.report = report; throw error; }
  return report;
}
