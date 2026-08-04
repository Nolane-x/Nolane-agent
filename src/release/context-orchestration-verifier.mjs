import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const REQUIRED_CAPABILITIES = Object.freeze([
  'current-error-priority','old-log-decay','conversation-and-file-compaction','freshness-and-staleness',
  'per-source-token-accounting','role-specific-budgets','permission-filtering','durable-checkpoints','cursor-paging',
  'authenticated-api','observable-control-center','full-release-matrix-gate',
]);
const REQUIRED_FILES = Object.freeze([
  'src/agent/context-orchestration-kernel.mjs','src/context/context-orchestration-service.mjs','src/server/routes.mjs','src/server/http-server.mjs','src/app.mjs',
  'ui/context-memory-center.js','ui/context-memory-center.css','tests/context-orchestration-kernel.test.mjs','tests/context-orchestration-service.test.mjs',
  'tests/context-orchestration-http-api.test.mjs','tests/context-orchestration-app-wiring.test.mjs','tests/context-orchestration-center-ui.test.mjs',
  'tests/context-orchestration-release-gate.test.mjs','src/release/full-release-matrix.mjs',
]);
async function source(root, relative, failures) { try { return await readFile(path.join(root, relative), 'utf8'); } catch { failures.push(`missing required source: ${relative}`); return ''; } }
function requirePattern(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(`missing ${label}`); }

export async function verifyContextOrchestration({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory); const releaseVersion = String(version ?? '').trim(); const failures = [];
  if (!/^\d+\.\d+\.\d+$/.test(releaseVersion)) failures.push('stable semantic version is required');
  const contents = new Map(); for (const relative of REQUIRED_FILES) contents.set(relative, await source(root, relative, failures));
  const kernel = contents.get('src/agent/context-orchestration-kernel.mjs') ?? '';
  const service = contents.get('src/context/context-orchestration-service.mjs') ?? '';
  const routes = contents.get('src/server/routes.mjs') ?? '';
  const app = contents.get('src/app.mjs') ?? '';
  const ui = contents.get('ui/context-memory-center.js') ?? '';
  const css = contents.get('ui/context-memory-center.css') ?? '';
  const matrix = contents.get('src/release/full-release-matrix.mjs') ?? '';
  requirePattern(kernel, /current-error[\s\S]*pinned-test|item\.current[\s\S]*severity[\s\S]*pinned/, 'current error and pinned priority', failures);
  requirePattern(kernel, /sourceType === 'log'[\s\S]*days \* 14|old/, 'old log decay', failures);
  requirePattern(kernel, /compactConversation[\s\S]*compactFile[\s\S]*originalRef/, 'conversation and file compaction with original references', failures);
  requirePattern(kernel, /freshness[\s\S]*sourceHash[\s\S]*currentHash[\s\S]*sourceUsage/, 'freshness, staleness, and source token accounting', failures);
  for (const role of ['planner','executor','reviewer','debugger','subagent']) requirePattern(kernel, new RegExp(role), `role budget ${role}`, failures);
  requirePattern(kernel, /cross-project[\s\S]*allowedRoles[\s\S]*allowedPrincipals/, 'permission filtering', failures);
  requirePattern(service, /context_orchestration_checkpoints[\s\S]*UNIQUE\(project_id,principal_id,plan_receipt_sha256,label\)/, 'durable idempotent checkpoints', failures);
  requirePattern(service, /encodeCursor[\s\S]*decodeCursor[\s\S]*pageCheckpoint/, 'cursor paging', failures);
  requirePattern(routes, /\/api\/context-orchestration\/plan[\s\S]*\/api\/context-orchestration\/checkpoints[\s\S]*req\.forgePrincipal/, 'authenticated principal-bound API', failures);
  requirePattern(app, /new ContextOrchestrationService[\s\S]*contextOrchestration/, 'application wiring', failures);
  for (const label of ['Current errors','Freshness','Staleness','Tokens by source','Compaction','Permission omissions','Create checkpoint','Read checkpoint page']) requirePattern(ui, new RegExp(label), `Control Center label ${label}`, failures);
  requirePattern(css, /cm-orchestration-grid[\s\S]*cm-token-ledger/, 'orchestration visual layer', failures);
  requirePattern(matrix, /id:\s*'context-orchestration-governance'/, 'full release matrix gate', failures);
  const fileDigests = {}; for (const [relative, text] of contents) if (text) fileDigests[relative] = canonicalSha256({ relative, text });
  const base = { schema: 'forge.studio.context-orchestration-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass', requiredCapabilities: REQUIRED_CAPABILITIES, failures: Object.freeze(failures), fileDigests: Object.freeze(fileDigests) };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { const target = path.resolve(outputFile); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) { const error = new Error(`Context orchestration verification failed: ${failures.join('; ')}`); error.code = 'CONTEXT_ORCHESTRATION_VERIFICATION_FAILED'; error.report = report; throw error; }
  return report;
}
