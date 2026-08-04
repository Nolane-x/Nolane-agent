import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const VERIFIED_ITEMS = Object.freeze(['26.4', '26.11', '26.15', '26.16', '26.17', '26.18', '26.19', '26.25', '26.26', '26.33', '26.34', '27.6', '27.7', '27.8', '27.10']);
const REQUIRED_FILES = Object.freeze([
  'src/repository/git-completion-governance-service.mjs', 'src/execution/worktree-integration-service.mjs',
  'src/server/routes.mjs', 'src/server/http-server.mjs', 'src/app.mjs',
  'ui/git-governance-center.js', 'ui/git-governance-center.css', 'ui/index.html', 'ui/app.js',
  'tests/git-completion-governance-service.test.mjs', 'tests/worktree-integration-service.test.mjs',
  'tests/git-governance-http-api.test.mjs', 'tests/app-git-governance-wiring.test.mjs', 'tests/git-governance-center-ui.test.mjs',
  'tests/git-completion-governance-release-gate.test.mjs', 'scripts/audit-feature-checklist.mjs', 'src/release/full-release-matrix.mjs',
]);

function auditItem(audit, id) { return audit?.sections?.flatMap((section) => section.items ?? []).find((item) => item.id === id) ?? null; }
async function source(root, relative, failures) { try { return await readFile(path.join(root, relative), 'utf8'); } catch { failures.push(`missing required source: ${relative}`); return ''; } }
function requirePattern(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(`missing ${label}`); }

export async function verifyGitCompletionGovernance({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory); const releaseVersion = String(version ?? '').trim(); const failures = [];
  if (!/^\d+\.\d+\.\d+$/.test(releaseVersion)) failures.push('stable semantic version is required');
  const contents = new Map(); for (const relative of REQUIRED_FILES) contents.set(relative, await source(root, relative, failures));
  const service = contents.get('src/repository/git-completion-governance-service.mjs') ?? '';
  const integration = contents.get('src/execution/worktree-integration-service.mjs') ?? '';
  const routes = contents.get('src/server/routes.mjs') ?? '';
  const ui = contents.get('ui/git-governance-center.js') ?? '';
  const auditSource = contents.get('scripts/audit-feature-checklist.mjs') ?? '';
  const matrix = contents.get('src/release/full-release-matrix.mjs') ?? '';

  requirePattern(service, /(?=[\s\S]*git_completion_records)(?=[\s\S]*expectedHead)(?=[\s\S]*ARTIFACT_SEGMENTS)(?=[\s\S]*normalizeTestReceipts)(?=[\s\S]*residualRisks)(?=[\s\S]*\.remotes\(\))(?=[\s\S]*\.commit\()/, 'durable bounded commit transaction', failures);
  requirePattern(service, /(?=[\s\S]*git_collision_maps)(?=[\s\S]*merge-tree)(?=[\s\S]*overlaps)(?=[\s\S]*reviewCoverage)(?=[\s\S]*ready)/, 'non-mutating multi-agent collision map', failures);
  requirePattern(service, /(?=[\s\S]*git_conflict_resolutions)(?=[\s\S]*recordConflictResolution)(?=[\s\S]*GIT_CONFLICT_STILL_PRESENT)(?=[\s\S]*verificationCollisionReceiptSha256)(?=[\s\S]*git\.conflict\.resolved)/, 'verified conflict-resolution receipt', failures);
  requirePattern(integration, /collisionGovernance[\s\S]*WORKTREE_INTEGRATION_PREFLIGHT_BLOCKED[\s\S]*collisionMapReceiptSha256/, 'integration collision and review preflight', failures);
  requirePattern(routes, /(?=[\s\S]*\/api\/git-governance\/commit)(?=[\s\S]*\/api\/git-governance\/checkpoint)(?=[\s\S]*\/api\/git-governance\/collisions)(?=[\s\S]*\/api\/git-governance\/resolutions)(?=[\s\S]*principal:\s*req\.forgePrincipal)/, 'authenticated bounded Git governance API', failures);
  requirePattern(ui, /(?=[\s\S]*Remotes)(?=[\s\S]*Commits & checkpoints)(?=[\s\S]*Test evidence)(?=[\s\S]*Residual risks)(?=[\s\S]*Changed files)(?=[\s\S]*File overlaps)(?=[\s\S]*Merge-tree conflicts)(?=[\s\S]*Diff review readiness)/, 'Git Governance Center evidence surface', failures);
  requirePattern(auditSource, /gitCompletionGovernance[\s\S]*Đọc remote[\s\S]*Tạo checkpoint commit[\s\S]*Review từng diff trước merge/, 'item-level Git completion audit rules', failures);
  requirePattern(matrix, /id:\s*'git-completion-governance'[\s\S]*scripts\/verify-git-completion-governance\.mjs/, 'full release matrix Git completion gate', failures);
  if (/exec\([^)]*shell\s*:\s*true|execSync\(|spawn\([^)]*shell\s*:\s*true/i.test(service)) failures.push('Git completion service must not use shell command strings');

  const routeStart = routes.indexOf("pathname === '/api/git-governance/commit'");
  const routeEnd = routes.indexOf("pathname === '/api/local-resource-sandboxes/capabilities'", routeStart);
  const routeBlock = routeStart >= 0 && routeEnd > routeStart ? routes.slice(routeStart, routeEnd) : '';
  if (/projectRoot|workspaceRoot|body\.argv|body\.command/.test(routeBlock)) failures.push('Git governance HTTP API accepts a raw repository location or Git command surface');

  let audit = null;
  try { audit = JSON.parse(await readFile(path.join(root, 'docs', `feature-audit-${releaseVersion}.json`), 'utf8')); }
  catch { failures.push(`missing or invalid feature audit for ${releaseVersion}`); }
  for (const id of VERIFIED_ITEMS) if (auditItem(audit, id)?.status !== 'verified_source_test') failures.push(`feature audit item ${id} is not verified_source_test`);

  const limitationsText = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  const remoteBoundary = /does not push branches|không push branch|không tạo pull request/i.test(limitationsText);
  const semanticBoundary = /does not automatically resolve semantic conflicts|không tự động giải quyết semantic conflict/i.test(limitationsText);
  const correctnessBoundary = /clean (?:textual )?merge.*does not prove correctness|merge sạch.*không chứng minh.*đúng/i.test(limitationsText);
  const rawBoundary = /does not accept raw Git argv|không nhận raw Git argv|không nhận lệnh Git thô/i.test(limitationsText);
  const limitations = Object.freeze({
    remoteMutationClaimed: /\/api\/git-governance\/(?:push|pull-request)|\.push\(/.test(routeBlock) || !remoteBoundary,
    automaticSemanticResolutionClaimed: /auto(?:matic)?Resolve|resolveSemanticConflict/.test(service) || !semanticBoundary,
    cleanMergeCorrectnessClaimed: !correctnessBoundary,
    rawGitHttpClaimed: /body\.(?:argv|command)|projectRoot|workspaceRoot/.test(routeBlock) || !rawBoundary,
  });
  for (const [name, claimed] of Object.entries(limitations)) if (claimed) failures.push(`unsafe or unsupported claim remains: ${name}`);

  const fileDigests = {}; for (const [relative, text] of contents) if (text) fileDigests[relative] = canonicalSha256({ relative, text });
  const base = Object.freeze({ schema: 'forge.studio.git-completion-governance-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass', verifiedItems: VERIFIED_ITEMS, limitations, failures: Object.freeze(failures), fileDigests: Object.freeze(fileDigests) });
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { const target = path.resolve(outputFile); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) { const error = new Error(`Git completion governance verification failed: ${failures.join('; ')}`); error.code = 'GIT_COMPLETION_GOVERNANCE_VERIFICATION_FAILED'; error.report = report; throw error; }
  return report;
}
