import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const VERIFIED_ITEMS = Object.freeze(['16.14', '16.22', '16.23', '16.26', '16.27', '16.29', '16.30', '17.13', '17.18', '17.20']);
const REQUIRED_FILES = Object.freeze([
  'src/execution/atomic-patch-transaction-service.mjs', 'src/execution/tool-broker.mjs', 'src/execution/unified-patch.mjs',
  'src/agent/agent-loop.mjs', 'src/agent/run-activity-tracker.mjs', 'src/security/autonomy-policy.mjs', 'src/security/autonomy-guarded-broker.mjs',
  'tests/atomic-patch-transaction-service.test.mjs', 'tests/atomic-patch-tool-wiring.test.mjs', 'tests/atomic-patch-governance-release-gate.test.mjs',
  'scripts/audit-feature-checklist.mjs', 'src/release/full-release-matrix.mjs',
]);

function auditItem(audit, id) { return audit?.sections?.flatMap((section) => section.items ?? []).find((item) => item.id === id) ?? null; }
async function source(root, relative, failures) { try { return await readFile(path.join(root, relative), 'utf8'); } catch { failures.push(`missing required source: ${relative}`); return ''; } }
function requirePattern(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(`missing ${label}`); }

export async function verifyAtomicPatchGovernance({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory); const releaseVersion = String(version ?? '').trim(); const failures = [];
  if (!/^\d+\.\d+\.\d+$/.test(releaseVersion)) failures.push('stable semantic version is required');
  const contents = new Map(); for (const relative of REQUIRED_FILES) contents.set(relative, await source(root, relative, failures));
  const service = contents.get('src/execution/atomic-patch-transaction-service.mjs') ?? '';
  const broker = contents.get('src/execution/tool-broker.mjs') ?? '';
  const schema = contents.get('src/agent/agent-loop.mjs') ?? '';
  const policy = `${contents.get('src/security/autonomy-policy.mjs') ?? ''}\n${contents.get('src/security/autonomy-guarded-broker.mjs') ?? ''}`;
  const auditSource = contents.get('scripts/audit-feature-checklist.mjs') ?? '';
  const matrix = contents.get('src/release/full-release-matrix.mjs') ?? '';

  requirePattern(service, /(?=[\s\S]*AtomicPatchTransactionService)(?=[\s\S]*maxFiles)(?=[\s\S]*maxChangedLines)(?=[\s\S]*Duplicate patch path)(?=[\s\S]*File hash mismatch)/, 'bounded multi-file transaction preflight', failures);
  requirePattern(service, /(?=[\s\S]*Generated code cannot be patched)(?=[\s\S]*Protected comment removed)(?=[\s\S]*GENERATED_HEADER)(?=[\s\S]*PROTECTED_COMMENT)/, 'generated-code and important-comment protection', failures);
  requirePattern(service, /(?=[\s\S]*analyzeConflictMarkers)(?=[\s\S]*conflictPolicy)(?=[\s\S]*preserve)(?=[\s\S]*resolve)(?=[\s\S]*Malformed conflict markers)/, 'explicit conflict-marker policies', failures);
  requirePattern(service, /(?=[\s\S]*forge-format)(?=[\s\S]*transaction-temp-files-only)(?=[\s\S]*Formatter args must contain exactly one \{file\})(?=[\s\S]*shell:\s*false)/, 'touched-file-only formatter isolation', failures);
  requirePattern(service, /(?=[\s\S]*createMinimalUnifiedPatch)(?=[\s\S]*minimalPatchSha256)(?=[\s\S]*additions)(?=[\s\S]*deletions)(?=[\s\S]*patchBytes)(?=[\s\S]*rollback failures)/, 'minimal diff metrics and rollback evidence', failures);
  requirePattern(broker, /(?=[\s\S]*AtomicPatchTransactionService)(?=[\s\S]*fs\.patchSet)(?=[\s\S]*atomicPatchService\.apply)/, 'ToolBroker patch-set wiring', failures);
  requirePattern(schema, /name:\s*'fs\.patchSet'[\s\S]*maxItems:\s*32[\s\S]*maximum:\s*20000/, 'bounded model tool schema', failures);
  requirePattern(policy, /fs\.patchSet[\s\S]*reversible/, 'autonomy policy reversible edit handling', failures);
  requirePattern(auditSource, /atomicPatchGovernance[\s\S]*Chỉnh nhiều file nguyên tử[\s\S]*Đo độ lớn patch/, 'item-level atomic patch audit rules', failures);
  requirePattern(matrix, /id:\s*'atomic-patch-governance'[\s\S]*scripts\/verify-atomic-patch-governance\.mjs/, 'full release matrix atomic patch gate', failures);
  if (/spawn\([^)]*shell\s*:\s*true|execSync\(|\bexec\(/i.test(service)) failures.push('atomic patch service must not use shell command strings');

  let audit = null;
  try { audit = JSON.parse(await readFile(path.join(root, 'docs', `feature-audit-${releaseVersion}.json`), 'utf8')); }
  catch { failures.push(`missing or invalid feature audit for ${releaseVersion}`); }
  for (const id of VERIFIED_ITEMS) if (auditItem(audit, id)?.status !== 'verified_source_test') failures.push(`feature audit item ${id} is not verified_source_test`);

  const limitationsText = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  const transactionBoundary = /all-or-rollback.*not.*multi-file filesystem atomic|all-or-rollback.*không.*atomic.*filesystem|không tuyên bố.*filesystem.*atomic/i.test(limitationsText);
  const generatedBoundary = /no generated-code override|không hỗ trợ.*override.*generated|không cho phép.*bỏ qua.*generated/i.test(limitationsText);
  const existingFilesBoundary = /existing regular UTF-8 files only|chỉ.*file.*UTF-8.*đã tồn tại/i.test(limitationsText);
  const formatterBoundary = /formatter.*transaction temp files only|formatter.*chỉ.*file tạm/i.test(limitationsText);
  const limitations = Object.freeze({
    multiFileFilesystemAtomicityClaimed: !transactionBoundary,
    generatedOverrideClaimed: !generatedBoundary,
    createDeleteRenameClaimed: !existingFilesBoundary,
    wholeProjectFormatterClaimed: !formatterBoundary,
  });
  for (const [name, claimed] of Object.entries(limitations)) if (claimed) failures.push(`unsafe or unsupported claim remains: ${name}`);

  const fileDigests = {}; for (const [relative, text] of contents) if (text) fileDigests[relative] = canonicalSha256({ relative, text });
  const base = Object.freeze({ schema: 'forge.studio.atomic-patch-governance-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass', verifiedItems: VERIFIED_ITEMS, limitations, failures: Object.freeze(failures), fileDigests: Object.freeze(fileDigests) });
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { const target = path.resolve(outputFile); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) { const error = new Error(`Atomic patch governance verification failed: ${failures.join('; ')}`); error.code = 'ATOMIC_PATCH_GOVERNANCE_VERIFICATION_FAILED'; error.report = report; throw error; }
  return report;
}
