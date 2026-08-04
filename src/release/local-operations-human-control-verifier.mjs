import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const VERIFIED_ITEMS = Object.freeze(['4.22', '4.24', '4.25', '4.32', '4.43', '4.44', '5.32', '5.33', '14.18', '20.9']);
const REQUIRED_FILES = Object.freeze([
  'src/security/content-sanitizer.mjs',
  'src/operations/controlled-local-cache.mjs',
  'src/operations/local-operations-center-service.mjs',
  'src/browser/image-comparison-service.mjs',
  'src/sandbox/local-resource-sandbox-service.mjs',
  'src/app.mjs',
  'src/server/http-server.mjs',
  'src/server/routes.mjs',
  'ui/local-operations-center.js',
  'ui/local-operations-center.css',
  'ui/app.js',
  'ui/index.html',
  'tests/content-sanitizer.test.mjs',
  'tests/controlled-local-cache.test.mjs',
  'tests/local-operations-center-service.test.mjs',
  'tests/local-operations-http-api.test.mjs',
  'tests/local-operations-app-wiring.test.mjs',
  'tests/local-operations-center-ui.test.mjs',
  'tests/local-operations-human-control-release-gate.test.mjs',
  'scripts/audit-feature-checklist.mjs',
  'src/release/full-release-matrix.mjs',
]);

function auditItem(audit, id) { return audit?.sections?.flatMap((section) => section.items ?? []).find((item) => item.id === id) ?? null; }
async function source(root, relative, failures) { try { return await readFile(path.join(root, relative), 'utf8'); } catch { failures.push(`missing required source: ${relative}`); return ''; } }
function requirePattern(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(`missing ${label}`); }

export async function verifyLocalOperationsHumanControl({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? '').trim();
  const failures = [];
  if (!/^\d+\.\d+\.\d+$/.test(releaseVersion)) failures.push('stable semantic version is required');
  const contents = new Map();
  for (const relative of REQUIRED_FILES) contents.set(relative, await source(root, relative, failures));
  const sanitizer = contents.get('src/security/content-sanitizer.mjs') ?? '';
  const cache = contents.get('src/operations/controlled-local-cache.mjs') ?? '';
  const service = contents.get('src/operations/local-operations-center-service.mjs') ?? '';
  const images = contents.get('src/browser/image-comparison-service.mjs') ?? '';
  const sandbox = contents.get('src/sandbox/local-resource-sandbox-service.mjs') ?? '';
  const routes = contents.get('src/server/routes.mjs') ?? '';
  const app = contents.get('src/app.mjs') ?? '';
  const ui = contents.get('ui/local-operations-center.js') ?? '';
  const auditSource = contents.get('scripts/audit-feature-checklist.mjs') ?? '';
  const matrix = contents.get('src/release/full-release-matrix.mjs') ?? '';

  requirePattern(sanitizer, /(?=[\s\S]*CONTROL_RE)(?=[\s\S]*BIDI_RE)(?=[\s\S]*INJECTION_RE)(?=[\s\S]*HTML_RE)(?=[\s\S]*renderAs:\s*'text')(?=[\s\S]*receiptSha256)/, 'plain-text hostile-content sanitization receipt', failures);
  requirePattern(cache, /(?=[\s\S]*DatabaseSync)(?=[\s\S]*project_id)(?=[\s\S]*principal_id)(?=[\s\S]*namespace)(?=[\s\S]*expires_at)(?=[\s\S]*maxBytes)(?=[\s\S]*ORDER BY accessed_at ASC)(?=[\s\S]*CONTROLLED_CACHE_SECRET_DENIED)(?=[\s\S]*purge\()/, 'scoped TTL quota LRU secret-denying controlled cache', failures);
  requirePattern(images, /(?=[\s\S]*async inspect\()(?=[\s\S]*async read\()(?=[\s\S]*#assertContained)(?=[\s\S]*contentSha256)(?=[\s\S]*receiptSha256)/, 'project-contained image inspection and binary read evidence', failures);
  requirePattern(service, /(?=[\s\S]*callGraph\()(?=[\s\S]*callHierarchy)(?=[\s\S]*sanitizeUntrustedContent)(?=[\s\S]*receiptSha256)/, 'sanitized call graph projection', failures);
  requirePattern(service, /(?=[\s\S]*gitHistory\()(?=[\s\S]*gitHistoryProvider)(?=[\s\S]*source:\s*'local-git-only')(?=[\s\S]*sanitizeUntrustedContent)/, 'bounded local-only Git history projection', failures);
  requirePattern(service, /(?=[\s\S]*costSummary\()(?=[\s\S]*source:\s*'recorded-usage-only')(?=[\s\S]*missionState\.snapshot)/, 'recorded-usage-only cost manager', failures);
  requirePattern(service, /(?=[\s\S]*editCommandCandidate\()(?=[\s\S]*validateArgv)(?=[\s\S]*commandFingerprint)(?=[\s\S]*approvalReusable:\s*false)(?=[\s\S]*requires-fresh-governance)/, 'fresh-governance command editing candidate', failures);
  requirePattern(service, /(?=[\s\S]*takeManualControl\()(?=[\s\S]*runCoordinator\.pause)(?=[\s\S]*manual-control)/, 'manual takeover that pauses the run', failures);
  requirePattern(service, /(?=[\s\S]*retainSandbox\()(?=[\s\S]*releaseSandbox\()(?=[\s\S]*retainLease)(?=[\s\S]*closeLease)/, 'sandbox retain and release controls', failures);
  requirePattern(sandbox, /(?=[\s\S]*retainLease)(?=[\s\S]*retainedUntilMs)(?=[\s\S]*retainTimer)(?=[\s\S]*sample\()(?=[\s\S]*terminateTree)/, 'retained sandbox TTL with continuing enforcement', failures);
  requirePattern(service, /(?=[\s\S]*cacheStatus\()(?=[\s\S]*purgeCache\()(?=[\s\S]*this\.cache\.list)(?=[\s\S]*this\.cache\.purge)/, 'controlled cache status and purge operations', failures);
  requirePattern(routes, /(?=[\s\S]*pathname\.startsWith\('\/api\/local-operations\/'\))(?=[\s\S]*req\.forgePrincipal\?\.subject)(?=[\s\S]*images\/inspect)(?=[\s\S]*images\/content)(?=[\s\S]*call-graph)(?=[\s\S]*git-history)(?=[\s\S]*\/cost)(?=[\s\S]*command-candidates)(?=[\s\S]*manual-control)(?=[\s\S]*retain\|release)(?=[\s\S]*\/cache)/, 'authenticated bounded Local Operations API surface', failures);
  if (/local-operations[\s\S]{0,500}(?:workspaceRoot|body\.principalId|rawCommand|shellCommand)/i.test(routes)) failures.push('Local Operations routes must not accept workspace roots, spoofed principals, or raw shell commands');
  requirePattern(app, /(?=[\s\S]*new ControlledLocalCache\()(?=[\s\S]*new LocalOperationsCenterService\()(?=[\s\S]*localOperations)(?=[\s\S]*controlledLocalCache\.close\()/, 'application wiring and cache shutdown', failures);
  requirePattern(ui, /(?=[\s\S]*Images)(?=[\s\S]*Call Graph)(?=[\s\S]*Git History)(?=[\s\S]*Cost)(?=[\s\S]*Human Control)(?=[\s\S]*Cache)(?=[\s\S]*textContent)(?=[\s\S]*replaceChildren)(?=[\s\S]*raw:true)(?=[\s\S]*URL\.createObjectURL)/, 'six-tab text-safe Local Operations Center', failures);
  if (/innerHTML\s*=|localStorage.*token|sessionStorage.*token/i.test(ui)) failures.push('Local Operations UI must not inject repository HTML or persist tokens');
  requirePattern(auditSource, /localOperationsHumanControl[\s\S]*Trình xem ảnh[\s\S]*Cache có kiểm soát/, 'item-level Local Operations audit rules', failures);
  requirePattern(matrix, /id:\s*'local-operations-human-control'[\s\S]*scripts\/verify-local-operations-human-control\.mjs/, 'full release matrix Local Operations gate', failures);

  let audit = null;
  try { audit = JSON.parse(await readFile(path.join(root, 'docs', `feature-audit-${releaseVersion}.json`), 'utf8')); }
  catch { failures.push(`missing or invalid feature audit for ${releaseVersion}`); }
  for (const id of VERIFIED_ITEMS) if (auditItem(audit, id)?.status !== 'verified_source_test') failures.push(`feature audit item ${id} is not verified_source_test`);

  const limitationsText = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  const providerInvoiceBoundary = /recorded usage only|chỉ.*usage.*đã ghi|not (?:a )?provider invoice|không.*provider invoice|không.*hóa đơn.*nhà cung cấp/i.test(limitationsText);
  const callGraphBoundary = /call graph.*requires.*language server|call graph.*cần.*language server|có thể.*unavailable.*LSP|không.*luôn.*khả dụng/i.test(limitationsText);
  const retainedEnforcementBoundary = /retained sandbox.*resource.*enforce|sandbox.*giữ.*vẫn.*giới hạn tài nguyên|retention.*does not disable.*enforcement/i.test(limitationsText);
  const cacheSecretBoundary = /cache.*not for secrets|cache.*không.*secret|không lưu.*secret.*cache/i.test(limitationsText);
  const editedApprovalBoundary = /edited command.*fresh approval|editing a command.*invalidates.*approval|sửa lệnh.*phê duyệt mới|command edit.*invalidates.*approval/i.test(limitationsText);
  const limitations = Object.freeze({
    providerInvoiceClaimed: !providerInvoiceBoundary,
    callGraphAlwaysAvailableClaimed: !callGraphBoundary,
    retentionDisablesEnforcementClaimed: !retainedEnforcementBoundary,
    secretCacheClaimed: !cacheSecretBoundary,
    editedCommandKeepsApprovalClaimed: !editedApprovalBoundary,
  });
  for (const [name, claimed] of Object.entries(limitations)) if (claimed) failures.push(`unsafe or unsupported claim remains: ${name}`);

  const fileDigests = {};
  for (const [relative, text] of contents) if (text) fileDigests[relative] = canonicalSha256({ relative, text });
  const base = Object.freeze({ schema: 'forge.studio.local-operations-human-control-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass', verifiedItems: VERIFIED_ITEMS, limitations, failures: Object.freeze(failures), fileDigests: Object.freeze(fileDigests) });
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { const target = path.resolve(outputFile); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) { const error = new Error(`Local Operations and Human Control verification failed: ${failures.join('; ')}`); error.code = 'LOCAL_OPERATIONS_HUMAN_CONTROL_VERIFICATION_FAILED'; error.report = report; throw error; }
  return report;
}
