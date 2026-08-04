import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { TreeSitterRuntimeService } from '../repository/tree-sitter-runtime-service.mjs';
import { PodmanSandboxDriver } from '../sandbox/podman-sandbox-driver.mjs';
import { WindowsJobObjectDriver } from '../sandbox/windows-job-object-driver.mjs';
import { MacOsSandboxDriver } from '../sandbox/macos-sandbox-driver.mjs';

const REQUIRED_FILES = Object.freeze([
  'ui/integrated-browser-center.js', 'ui/integrated-browser-center.css', 'ui/secrets-manager.js', 'ui/secrets-manager.css',
  'src/browser/browser-agent-service.mjs', 'src/security/credential-vault.mjs', 'src/repository/tree-sitter-runtime-service.mjs',
  'src/sandbox/podman-sandbox-driver.mjs', 'src/sandbox/windows-job-object-driver.mjs', 'src/sandbox/macos-sandbox-driver.mjs',
  'src/sandbox/local-resource-sandbox-service.mjs', 'src/server/routes.mjs', 'src/server/http-server.mjs', 'src/app.mjs',
  'tests/integrated-browser-center-ui.test.mjs', 'tests/secrets-manager-center-ui.test.mjs', 'tests/tree-sitter-runtime-service.test.mjs',
  'tests/tree-sitter-http-api.test.mjs', 'tests/native-sandbox-drivers.test.mjs', 'tests/completion-runtime-app-wiring.test.mjs',
  'tests/completion-release-gate.test.mjs', 'scripts/audit-feature-checklist.mjs', 'src/release/full-release-matrix.mjs',
]);

function auditItem(audit, id) { return audit?.sections?.flatMap((section) => section.items ?? []).find((item) => item.id === id) ?? null; }
async function source(root, relative, failures) { try { return await readFile(path.join(root, relative), 'utf8'); } catch { failures.push(`missing required source: ${relative}`); return ''; } }
function requirePattern(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(`missing ${label}`); }

export async function verifyRemainingCompletion({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory); const releaseVersion = String(version ?? '').trim(); const failures = [];
  if (!/^\d+\.\d+\.\d+$/.test(releaseVersion)) failures.push('stable semantic version is required');
  const contents = new Map(); for (const relative of REQUIRED_FILES) contents.set(relative, await source(root, relative, failures));
  const browserUi = contents.get('ui/integrated-browser-center.js') ?? '';
  const secretsUi = contents.get('ui/secrets-manager.js') ?? '';
  const tree = contents.get('src/repository/tree-sitter-runtime-service.mjs') ?? '';
  const podman = contents.get('src/sandbox/podman-sandbox-driver.mjs') ?? '';
  const windows = contents.get('src/sandbox/windows-job-object-driver.mjs') ?? '';
  const macos = contents.get('src/sandbox/macos-sandbox-driver.mjs') ?? '';
  const routes = contents.get('src/server/routes.mjs') ?? '';
  const auditSource = contents.get('scripts/audit-feature-checklist.mjs') ?? '';
  const matrix = contents.get('src/release/full-release-matrix.mjs') ?? '';

  requirePattern(browserUi, /\/api\/browser\/(open|goto)[\s\S]*snapshot[\s\S]*screenshot[\s\S]*safeUrl/, 'governed integrated browser surface', failures);
  requirePattern(browserUi, /url\.username\s*\|\|\s*url\.password/, 'browser credential-bearing URL rejection', failures);
  requirePattern(secretsUi, /(?=[\s\S]*\/api\/credentials)(?=[\s\S]*type\s*=\s*'password')(?=[\s\S]*present)/, 'metadata-only Secrets Manager', failures);
  if (/resolve|reveal|plaintext/i.test(secretsUi)) failures.push('Secrets Manager must not expose a reveal/resolve/plaintext action');
  requirePattern(tree, /(?=[\s\S]*tree-sitter)(?=[\s\S]*--version)(?=[\s\S]*'parse')(?=[\s\S]*--json)(?=[\s\S]*realpath)(?=[\s\S]*receiptSha256)/, 'project-bound Tree-sitter CLI contract', failures);
  requirePattern(routes, /\/api\/tree-sitter\/capabilities[\s\S]*\/api\/tree-sitter\/parse[\s\S]*req\.forgePrincipal\?\.subject/, 'authenticated Tree-sitter API', failures);
  requirePattern(podman, /(?=[\s\S]*--network=none)(?=[\s\S]*--read-only)(?=[\s\S]*--cap-drop=all)(?=[\s\S]*--pids-limit)(?=[\s\S]*--cpus=)(?=[\s\S]*--memory=)/, 'rootless bounded Podman contract', failures);
  requirePattern(windows, /platform\s*!==\s*'win32'[\s\S]*capabilities[\s\S]*create[\s\S]*attach[\s\S]*terminate/, 'fail-closed Windows Job Object helper contract', failures);
  requirePattern(macos, /(?=[\s\S]*platform\s*!==\s*'darwin')(?=[\s\S]*deny default)(?=[\s\S]*deny network\*)(?=[\s\S]*sandbox-exec)/, 'fail-closed macOS sandbox profile contract', failures);
  requirePattern(auditSource, /Trình duyệt tích hợp[\s\S]*integratedBrowser/, 'integrated browser audit rule', failures);
  requirePattern(auditSource, /Trình quản lý secrets[\s\S]*secretsManager/, 'Secrets Manager audit rule', failures);
  requirePattern(auditSource, /EXTERNAL_RULES[\s\S]*Hỗ trợ tree-sitter[\s\S]*Hỗ trợ Podman[\s\S]*Hỗ trợ Windows Job Objects[\s\S]*Hỗ trợ macOS sandbox/, 'external native runtime audit rules', failures);
  requirePattern(matrix, /id:\s*'remaining-completion'[\s\S]*scripts\/verify-remaining-completion\.mjs/, 'full release matrix completion gate', failures);

  let audit = null;
  try { audit = JSON.parse(await readFile(path.join(root, 'docs', `feature-audit-${releaseVersion}.json`), 'utf8')); }
  catch { failures.push(`missing or invalid feature audit for ${releaseVersion}`); }
  for (const id of ['4.21', '4.30']) if (auditItem(audit, id)?.status !== 'verified_source_test') failures.push(`feature audit item ${id} is not verified_source_test`);
  for (const id of ['13.27', '21.4', '21.6', '21.7']) if (auditItem(audit, id)?.status !== 'external_gate') failures.push(`feature audit item ${id} is not external_gate`);
  const baselineItems = (audit?.sections ?? [])
    .filter((section) => Number(section?.number) <= 28)
    .flatMap((section) => section?.items ?? []);
  const frontierItems = (audit?.sections ?? [])
    .filter((section) => Number(section?.number) > 28)
    .flatMap((section) => section?.items ?? []);
  const notImplementedCount = baselineItems.filter((item) => item?.status === 'not_implemented').length;
  const frontierNotImplementedCount = frontierItems.filter((item) => item?.status === 'not_implemented').length;
  if (notImplementedCount !== 0) failures.push('baseline feature audit still contains not_implemented items');

  const limitations = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  requirePattern(limitations, /Tree-sitter.*external|Tree-sitter.*cài đặt|Tree-sitter.*runtime/i, 'Tree-sitter external runtime boundary', failures);
  requirePattern(limitations, /Podman.*runtime|Podman.*daemon|Podman.*cài đặt/i, 'Podman runtime boundary', failures);
  requirePattern(limitations, /Windows Job Objects.*helper|Windows.*runner/i, 'Windows Job Objects native runner boundary', failures);
  requirePattern(limitations, /macOS sandbox.*runner|sandbox-exec.*macOS/i, 'macOS runner boundary', failures);

  const [treeSitterEvidence, podmanEvidence, windowsEvidence, macOsEvidence] = await Promise.all([
    new TreeSitterRuntimeService({ projectResolver: () => null }).capabilities(),
    new PodmanSandboxDriver().capabilities(), new WindowsJobObjectDriver().capabilities(), new MacOsSandboxDriver().capabilities(),
  ]);
  const runtimeEvidence = Object.freeze({ treeSitter: treeSitterEvidence, podman: podmanEvidence, windowsJobObjects: windowsEvidence, macOsSandbox: macOsEvidence });
  const fileDigests = {}; for (const [relative, text] of contents) if (text) fileDigests[relative] = canonicalSha256({ relative, text });
  const base = {
    schema: 'forge.studio.remaining-completion-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass',
    audit: Object.freeze({ verifiedBrowserAndSecrets: Object.freeze(['4.21', '4.30']), externalNativeRuntime: Object.freeze(['13.27', '21.4', '21.6', '21.7']), notImplementedCount, frontierNotImplementedCount }),
    runtimeEvidence, failures: Object.freeze(failures), fileDigests: Object.freeze(fileDigests),
  };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { const target = path.resolve(outputFile); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) { const error = new Error(`Remaining completion verification failed: ${failures.join('; ')}`); error.code = 'REMAINING_COMPLETION_VERIFICATION_FAILED'; error.report = report; throw error; }
  return report;
}
