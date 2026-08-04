import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { expectedFrontierAuditCounts } from './frontier-audit-counts.mjs';
import { LOCAL_FRONTIER_VERIFIED_IDS, LOCAL_FRONTIER_EXTERNAL_IDS } from '../../scripts/measure-local-frontier-completion.mjs';

const SHA = /^[a-f0-9]{64}$/;
async function present(root, relative, failures) { try { await access(path.join(root, relative)); } catch { failures.push(`missing ${relative}`); } }
async function text(root, relative, failures) { try { return await readFile(path.join(root, relative), 'utf8'); } catch { failures.push(`missing ${relative}`); return ''; } }
function same(a, b) { return Array.isArray(a) && a.length === b.length && a.every((item, index) => item === b[index]); }
function statuses(audit) { return new Map((audit?.sections ?? []).flatMap((section) => section.items ?? []).map((item) => [item.id, item.status])); }
function allTrue(group) { return group && Object.values(group).every((value) => value === true); }

export async function verifyLocalFrontierCompletion({ rootDirectory = process.cwd(), version = '4.0.0', outputFile } = {}) {
  const root = path.resolve(rootDirectory); const releaseVersion = String(version); const failures = [];
  for (const relative of [
    'src/frontier-completion/harness-bpe-tokenizer.mjs','src/frontier-completion/context-cache-coherence.mjs','src/frontier-completion/semantic-index-runtime.mjs','src/frontier-completion/polyglot-evidence-runtime.mjs','src/frontier-completion/memory-resource-collaboration-runtime.mjs','src/frontier-completion/product-security-experience-runtime.mjs','src/frontier-completion/reproducible-benchmark-pack.mjs','src/frontier-completion/local-frontier-completion-plane.mjs',
    'tests/local-frontier-context-semantic.test.mjs','tests/local-frontier-polyglot-evidence.test.mjs','tests/local-frontier-memory-resource-collaboration.test.mjs','tests/local-frontier-product-security-experience.test.mjs','tests/local-frontier-benchmark-pack.test.mjs','tests/local-frontier-completion-plane.test.mjs','tests/local-frontier-completion-release-gate.test.mjs',
    'ui/local-frontier-work-surface.js','ui/local-frontier-work-surface.css','benchmark/frontier/public-suite.json','benchmark/frontier/private-held-out.enc.json','scripts/lib/nolane-runtime-purity-verifier.mjs','tests/nolane-runtime-purity.test.mjs',
  ]) await present(root, relative, failures);

  let measurement = null; try { measurement = JSON.parse(await text(root, `docs/local-frontier-completion-measurement-${releaseVersion}.json`, failures)); } catch { failures.push('measurement JSON invalid'); }
  if (measurement) {
    if (measurement.version !== releaseVersion) failures.push('measurement version mismatch');
    if (!same(measurement.promotedRequirementIds, LOCAL_FRONTIER_VERIFIED_IDS)) failures.push('promoted requirement ids mismatch');
    if (!same(measurement.externalizedRequirementIds, LOCAL_FRONTIER_EXTERNAL_IDS)) failures.push('externalized requirement ids mismatch');
    for (const group of ['contextSemantic','polyglot','memoryResourceCollaboration','productSecurityExperience','benchmark']) if (!allTrue(measurement[group])) failures.push(`${group} measurement incomplete`);
    if (Object.values(measurement.externalBoundaries ?? {}).some((value) => value !== false)) failures.push('external boundary inflated');
    if (Object.values(measurement.privacy ?? {}).some((value) => value !== false)) failures.push('privacy boundary violated');
    if (measurement.rootDirectoryUsedForClaims !== false) failures.push('root path leaked into claims');
    const unsigned = { ...measurement }; delete unsigned.receiptSha256;
    if (!SHA.test(measurement.receiptSha256 ?? '') || canonicalSha256(unsigned) !== measurement.receiptSha256) failures.push('measurement receipt invalid');
  }

  let audit = null; try { audit = JSON.parse(await text(root, `docs/feature-audit-${releaseVersion}.json`, failures)); } catch { failures.push('audit JSON invalid'); }
  const expected = expectedFrontierAuditCounts(releaseVersion);
  if (!audit || audit.totalItems !== 1150 || JSON.stringify(audit.summary) !== JSON.stringify(expected)) failures.push('frontier audit counts mismatch');
  const map = statuses(audit);
  for (const id of LOCAL_FRONTIER_VERIFIED_IDS) if (map.get(id) !== 'verified_source_test') failures.push(`requirement not verified: ${id}`);
  for (const id of LOCAL_FRONTIER_EXTERNAL_IDS) if (map.get(id) !== 'external_gate') failures.push(`requirement not external: ${id}`);
  if ((audit?.summary?.partial ?? -1) !== 0) failures.push('partial requirements remain');

  const limitations = await text(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  for (const phrase of ['does not bundle a production ONNX INT8 embedding model','does not bundle production tree-sitter grammars or language-server binaries','does not claim benchmark superiority']) if (!limitations.includes(phrase)) failures.push(`missing limitation: ${phrase}`);
  const runtimePurityLimitation = /Nolane Native[\s\S]*(external runtime|external compatibility|runtime purity|owned by Nolane Agent)/i;
  if (!runtimePurityLimitation.test(limitations)) failures.push('missing Nolane runtime purity limitation');

  try {
    const { verifyNolaneRuntimePurity } = await import('../../scripts/lib/nolane-runtime-purity-verifier.mjs');
    const purity = await verifyNolaneRuntimePurity({ rootDirectory: root });
    if (purity.status !== 'pass') failures.push('Nolane runtime purity verification failed');
  } catch { failures.push('Nolane runtime purity verification failed'); }

  const app = await text(root, 'src/app.mjs', failures);
  if (/LocalFrontierCompletionPlane|local-frontier-completion-plane/.test(app)) failures.push('src/app.mjs must not construct LocalFrontierCompletionPlane directly');
  const base = { schema: 'forge.studio.local-frontier-completion-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass', failures, promotedRequirementIds: LOCAL_FRONTIER_VERIFIED_IDS, externalizedRequirementIds: LOCAL_FRONTIER_EXTERNAL_IDS, auditCounts: audit?.summary ?? null, runtimePurity: { externalRuntimeBundled: false, verified: failures.every((item) => item !== 'Nolane runtime purity verification failed') }, measurementReceiptSha256: measurement?.receiptSha256 ?? null };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { await mkdir(path.dirname(outputFile), { recursive: true }); await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) { const error = new Error(`Local Frontier Completion verification failed: ${failures.join('; ')}`); error.report = report; throw error; }
  return report;
}
