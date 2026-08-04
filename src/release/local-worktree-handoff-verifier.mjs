import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const REQUIRED_CAPABILITIES = Object.freeze([
  'authenticated-principal-bound-transfer',
  'managed-builder-integrator-worktree',
  'content-addressed-idempotent-handoff',
  'bounded-api-without-path-input',
  'vscode-transfer-local-command',
  'vscode-open-folder-without-shell',
  'item-level-feature-audit',
  'full-release-matrix-gate',
]);

const REQUIRED_FILES = Object.freeze([
  'src/execution/local-task-handoff-service.mjs',
  'src/execution/task-workspace.mjs',
  'src/server/routes.mjs',
  'src/server/http-server.mjs',
  'src/app.mjs',
  'extensions/vscode/src/client.ts',
  'extensions/vscode/src/extension.ts',
  'extensions/vscode/src/local-worktree.ts',
  'extensions/vscode/extension/package.json',
  'scripts/build-vscode-extension.mjs',
  'scripts/validate-vscode-extension.mjs',
  'tests/local-task-handoff-service.test.mjs',
  'tests/local-task-handoff-api.test.mjs',
  'tests/local-task-handoff-app-wiring.test.mjs',
  'tests/vscode-local-worktree-handoff.test.mjs',
  'tests/local-worktree-handoff-release-gate.test.mjs',
  'scripts/audit-feature-checklist.mjs',
  'src/release/full-release-matrix.mjs',
]);

async function source(root, relative, failures) {
  try { return await readFile(path.join(root, relative), 'utf8'); }
  catch { failures.push(`missing required source: ${relative}`); return ''; }
}

function requirePattern(text, pattern, label, failures) {
  if (!pattern.test(text)) failures.push(`missing ${label}`);
}

function auditItem(audit, id) {
  for (const section of audit?.sections ?? []) {
    const item = (section.items ?? []).find((entry) => entry.id === id);
    if (item) return item;
  }
  return null;
}

export async function verifyLocalWorktreeHandoff({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? '').trim();
  const failures = [];
  if (!/^\d+\.\d+\.\d+$/.test(releaseVersion)) failures.push('stable semantic version is required');

  const contents = new Map();
  for (const relative of REQUIRED_FILES) contents.set(relative, await source(root, relative, failures));
  const service = contents.get('src/execution/local-task-handoff-service.mjs') ?? '';
  const workspace = contents.get('src/execution/task-workspace.mjs') ?? '';
  const routes = contents.get('src/server/routes.mjs') ?? '';
  const http = contents.get('src/server/http-server.mjs') ?? '';
  const app = contents.get('src/app.mjs') ?? '';
  const client = contents.get('extensions/vscode/src/client.ts') ?? '';
  const extension = contents.get('extensions/vscode/src/extension.ts') ?? '';
  const helper = contents.get('extensions/vscode/src/local-worktree.ts') ?? '';
  const auditSource = contents.get('scripts/audit-feature-checklist.mjs') ?? '';
  const matrix = contents.get('src/release/full-release-matrix.mjs') ?? '';

  requirePattern(service, /LOCAL_HANDOFF_PRINCIPAL_REQUIRED[\s\S]*principalId/, 'authenticated principal enforcement', failures);
  requirePattern(service, /ELIGIBLE_ROLES[\s\S]*builder[\s\S]*integrator/, 'builder and integrator eligibility', failures);
  requirePattern(service, /workspaceService\.prepare\(selected\)[\s\S]*publicWorktree\(prepared\)[\s\S]*exists\(worktree\.path\)/, 'managed worktree preparation and existence verification', failures);
  requirePattern(service, /forge\.local-task-handoff\.v1[\s\S]*executionTarget:\s*'local'[\s\S]*canonicalSha256\(base\)/, 'content-addressed local handoff bundle', failures);
  requirePattern(service, /metadata\?\.localHandoff[\s\S]*existing\.principalId[\s\S]*exists\(existing\.localWorkspace\)/, 'principal-bound idempotent handoff reuse', failures);
  requirePattern(service, /task\.local-handoff\.prepared[\s\S]*receiptSha256/, 'durable local handoff event receipt', failures);
  requirePattern(workspace, /ISOLATED_ROLES\s*=\s*new Set\(\['builder', 'integrator'\]\)/, 'managed builder and integrator worktrees', failures);

  requirePattern(routes, /POST[\s\S]*\/api\/local-task-handoffs[\s\S]*missionId:\s*body\.missionId[\s\S]*taskId:\s*body\.taskId[\s\S]*principalId:\s*req\.forgePrincipal\?\.subject/, 'bounded authenticated prepare endpoint', failures);
  requirePattern(routes, /GET[\s\S]*local-task-handoffs[\s\S]*taskId:\s*decodeURIComponent[\s\S]*principalId:\s*req\.forgePrincipal\?\.subject/, 'principal-bound persisted handoff endpoint', failures);
  if (/localTaskHandoff\.prepare\(\{[\s\S]{0,320}(?:localWorkspace|worktree|path)\s*:/i.test(routes)) failures.push('local handoff API must not accept arbitrary path or worktree fields');
  requirePattern(http, /localTaskHandoff\s*=\s*null[\s\S]*createRoutes\(\{[\s\S]*localTaskHandoff/, 'HTTP service forwarding', failures);
  requirePattern(app, /LocalTaskHandoffService[\s\S]*new LocalTaskHandoffService\(\{ store, workspaceService \}\)[\s\S]*createHttpServer\(\{[\s\S]*localTaskHandoff/, 'application service wiring', failures);

  requirePattern(client, /prepareLocalHandoff\([\s\S]*\/api\/local-task-handoffs[\s\S]*JSON\.stringify\(\{ missionId:[\s\S]*getLocalHandoff/, 'VS Code bounded handoff client', failures);
  requirePattern(extension, /(?:forge|nolane)\.transferTaskLocal[\s\S]*prepareLocalHandoff\(requireRun\(\)\)/, 'VS Code transfer-local command', failures);
  requirePattern(extension, /(?:forge|nolane)\.openWorktree[\s\S]*openLocalWorktree\(vscode, handoff\)/, 'VS Code open-worktree command', failures);
  requirePattern(helper, /(?:forge\.local-task-handoff\.v1|nolane\.agent\.local-task-handoff\.v1)[\s\S]*absolute local path[\s\S]*SHA-256[\s\S]*vscode\.openFolder/, 'validated VS Code folder opening', failures);
  if (/(?:child_process|execFile|spawn\()/.test(helper) || /(?:child_process|execFile|spawn\()/.test(extension)) failures.push('VS Code local worktree opening must not execute a shell');

  try {
    const pkg = JSON.parse(contents.get('extensions/vscode/extension/package.json') ?? '{}');
    const commands = new Set((pkg.contributes?.commands ?? []).map((entry) => entry.command));
    for (const pair of [['nolane.transferTaskLocal', 'forge.transferTaskLocal'], ['nolane.openWorktree', 'forge.openWorktree']]) {
      if (!pair.some((command) => commands.has(command))) failures.push(`missing VS Code command contribution: ${pair[0]}`);
    }
  } catch { failures.push('VS Code package metadata is invalid'); }

  requirePattern(auditSource, /localWorktreeHandoff:[\s\S]*local-task-handoff-service\.mjs[\s\S]*vscode-local-worktree-handoff\.test\.mjs/, 'local worktree handoff audit evidence set', failures);
  requirePattern(auditSource, /sections:\s*\[27\][^\n]*Hỗ trợ mở worktree trong IDE\|Hỗ trợ chuyển task sang local[^\n]*localWorktreeHandoff/, 'item-level worktree handoff audit rules', failures);
  if (/(?:EXPLICIT_NOT_IMPLEMENTED[\s\S]*Hỗ trợ mở worktree trong IDE|EXPLICIT_NOT_IMPLEMENTED[\s\S]*Hỗ trợ chuyển task sang local)/.test(auditSource)) failures.push('worktree handoff items remain explicitly not implemented');
  requirePattern(matrix, /id:\s*'local-worktree-handoff'[\s\S]*scripts\/verify-local-worktree-handoff\.mjs/, 'full release matrix gate', failures);

  try {
    const audit = JSON.parse(await readFile(path.join(root, 'docs', `feature-audit-${releaseVersion}.json`), 'utf8'));
    for (const id of ['27.15', '27.16']) {
      const item = auditItem(audit, id);
      if (item?.status !== 'verified_source_test') failures.push(`feature audit item ${id} is not verified_source_test`);
    }
  } catch { failures.push(`missing or invalid feature audit for ${releaseVersion}`); }

  const limitations = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  requirePattern(limitations, /does not clone repositories|không clone repository/i, 'no repository cloning claim', failures);
  requirePattern(limitations, /does not accept arbitrary filesystem paths|không nhận đường dẫn tùy ý/i, 'no arbitrary path claim', failures);
  requirePattern(limitations, /does not execute shell commands|không thực thi lệnh shell/i, 'no shell execution claim', failures);
  requirePattern(limitations, /does not transfer tasks to cloud|không chuyển task lên cloud/i, 'no cloud transfer claim', failures);

  const fileDigests = {};
  for (const [relative, text] of contents) if (text) fileDigests[relative] = canonicalSha256({ relative, text });
  const base = {
    schema: 'forge.studio.local-worktree-handoff-verification.v1',
    version: releaseVersion,
    status: failures.length ? 'fail' : 'pass',
    requiredCapabilities: REQUIRED_CAPABILITIES,
    limitations: Object.freeze({
      cloudTransferClaimed: false,
      arbitraryPathOpenClaimed: false,
      shellExecutionClaimed: false,
      repositoryCloneClaimed: false,
    }),
    failures: Object.freeze(failures),
    fileDigests: Object.freeze(fileDigests),
  };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) {
    const target = path.resolve(outputFile);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (failures.length) {
    const error = new Error(`Local worktree handoff verification failed: ${failures.join('; ')}`);
    error.code = 'LOCAL_WORKTREE_HANDOFF_VERIFICATION_FAILED';
    error.report = report;
    throw error;
  }
  return report;
}
