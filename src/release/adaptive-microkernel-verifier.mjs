import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const releaseAtLeastFour = (version) => Number(String(version).split('.')[0]) >= 4;

const REQUIRED = Object.freeze([
  'src/runtime/runtime-profile-service.mjs',
  'src/runtime/system-resource-sampler.mjs',
  'src/runtime/resource-governor.mjs',
  'src/runtime/runtime-module-manager.mjs',
  'src/runtime/optional-enterprise-cloud-module.mjs',
  'src/runtime/lazy-enterprise-cloud-adapters.mjs',
  'src/events/durable-event-hub.mjs',
  'src/storage/studio-store.mjs',
  'src/server/http-server.mjs',
  'scripts/lib/nolane-runtime-purity-verifier.mjs',
  'src/release/release-artifacts.mjs',
  'src/app.mjs',
  'ui/runtime-performance-policy.js',
  'ui/runtime-performance.css',
  'ui/app.js',
  'ui/workroom.js',
  'tests/runtime-profile-service.test.mjs',
  'tests/resource-governor.test.mjs',
  'tests/runtime-module-manager.test.mjs',
  'tests/adaptive-microkernel-app-wiring.test.mjs',
  'tests/durable-event-hub.test.mjs',
  'tests/runtime-performance-policy.test.mjs',
  'tests/nolane-runtime-purity.test.mjs',
  'tests/release-artifacts.test.mjs',
  'src/release/full-release-matrix.mjs',
]);

async function source(root, relative, failures) {
  try { return await readFile(path.join(root, relative), 'utf8'); }
  catch { failures.push(`missing required source: ${relative}`); return ''; }
}
function requirePattern(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(`missing ${label}`); }
function counts(audit) {
  const output = { verified_source_test: 0, partial: 0, external_gate: 0, not_implemented: 0 };
  for (const section of audit?.sections ?? []) { if (Number(section.number) > 28) continue; for (const item of section.items ?? []) if (Object.hasOwn(output, item.status)) output[item.status] += 1; }
  return Object.freeze(output);
}

export async function verifyAdaptiveMicrokernel({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory); const releaseVersion = String(version ?? '').trim(); const failures = []; const contents = new Map();
  for (const relative of REQUIRED) contents.set(relative, await source(root, relative, failures));
  const profiles = contents.get('src/runtime/runtime-profile-service.mjs') ?? '';
  const sampler = contents.get('src/runtime/system-resource-sampler.mjs') ?? '';
  const governor = contents.get('src/runtime/resource-governor.mjs') ?? '';
  const modules = contents.get('src/runtime/runtime-module-manager.mjs') ?? '';
  const optional = contents.get('src/runtime/optional-enterprise-cloud-module.mjs') ?? '';
  const hub = contents.get('src/events/durable-event-hub.mjs') ?? '';
  const store = contents.get('src/storage/studio-store.mjs') ?? '';
  const server = contents.get('src/server/http-server.mjs') ?? '';
  const retirement = contents.get('scripts/lib/nolane-runtime-purity-verifier.mjs') ?? '';
  const releases = contents.get('src/release/release-artifacts.mjs') ?? '';
  const app = contents.get('src/app.mjs') ?? '';
  const uiPolicy = contents.get('ui/runtime-performance-policy.js') ?? '';
  const uiCss = contents.get('ui/runtime-performance.css') ?? '';
  const matrix = contents.get('src/release/full-release-matrix.mjs') ?? '';

  requirePattern(profiles, /(?=[\s\S]*maxActiveAgents:\s*1)(?=[\s\S]*maxVisibleTerminals:\s*2)(?=[\s\S]*maxEditorModels:\s*4)(?=[\s\S]*maxBrowserSessions:\s*0)(?=[\s\S]*semanticIndexing:\s*'on-demand')/, '8 GiB Lite profile defaults', failures);
  requirePattern(sampler, /(?=[\s\S]*totalmem)(?=[\s\S]*freemem)(?=[\s\S]*systemAvailableBytes)(?=[\s\S]*systemAvailableRatio)/, 'system-wide memory sampler', failures);
  requirePattern(governor, /(?=[\s\S]*emergency)(?=[\s\S]*800\s*\*\s*1024\s*\*\s*1024)(?=[\s\S]*maxActiveAgents:\s*0)(?=[\s\S]*unloadOptionalModules:\s*true)/, 'system-aware emergency brownout policy', failures);
  requirePattern(modules, /(?=[\s\S]*unloaded)(?=[\s\S]*loading)(?=[\s\S]*active)(?=[\s\S]*idle)(?=[\s\S]*suspended)(?=[\s\S]*unload)/, 'microkernel module lifecycle', failures);
  requirePattern(optional, /(?=[\s\S]*enterprise-cloud)(?=[\s\S]*EnterpriseStore)(?=[\s\S]*CloudQueue)(?=[\s\S]*activate)/, 'lazy enterprise and cloud module descriptor', failures);
  for (const forbidden of ['./enterprise/', './cloud/cloud-job-queue.mjs', './cloud/cloud-sandbox-adapter.mjs']) if (new RegExp(`^import[^\\n]+${forbidden.replaceAll('/', '\\/').replaceAll('.', '\\.')}`, 'm').test(app)) failures.push(`enterprise/cloud implementation remains eagerly imported: ${forbidden}`);
  requirePattern(hub, /(?=[\s\S]*subscribe)(?=[\s\S]*publish)(?=[\s\S]*maxSubscribers)/, 'bounded durable event hub', failures);
  requirePattern(store, /(?=[\s\S]*eventHub)(?=[\s\S]*publish)(?=[\s\S]*appendEvent)/, 'post-commit event publication', failures);
  requirePattern(server, /(?=[\s\S]*eventHub\?\.subscribe)(?=[\s\S]*5_000)(?=[\s\S]*15_000)/, 'event-driven SSE with slow reconciliation and heartbeat', failures);
  if (/setInterval\s*\(\s*send\s*,\s*250\s*\)/.test(server)) failures.push('250 ms SQLite SSE polling remains enabled');
  requirePattern(uiPolicy, /(?=[\s\S]*forge-profile-lite)(?=[\s\S]*forge-resource-emergency)(?=[\s\S]*terminalFrameIntervalMs)(?=[\s\S]*33)(?=[\s\S]*reducedEffects)/, 'runtime-driven Lite UI policy', failures);
  requirePattern(uiCss, /(?=[\s\S]*forge-reduced-effects)(?=[\s\S]*animation:\s*none\s*!important)(?=[\s\S]*backdrop-filter:\s*none\s*!important)/, 'reduced animation and blur policy', failures);
  requirePattern(retirement, /(?=[\s\S]*verifyNolaneRuntimePurity)(?=[\s\S]*pathFindings)(?=[\s\S]*contentFindings)(?=[\s\S]*archiveFindings)/, 'Nolane runtime purity source and archive boundary', failures);
  requirePattern(releases, /(?=[\s\S]*runtimeOwnership)(?=[\s\S]*externalRuntimeBundled:\s*false)(?=[\s\S]*verifyNolaneRuntimePurity)/i, 'Nolane-owned release packaging boundary', failures);
  requirePattern(matrix, /id:\s*'adaptive-microkernel'[\s\S]*verify-adaptive-microkernel\.mjs/, 'required adaptive microkernel matrix gate', failures);

  const appStaticImports = (app.match(/^import\s.+$/gm) ?? []).length;
  const appConstructors = (app.match(/\bnew\s+[A-Z][A-Za-z0-9_$]*/g) ?? []).length;
  if (appStaticImports > 160) failures.push(`app static imports exceed budget: ${appStaticImports} > 160`);
  if (appConstructors > 180) failures.push(`app eager constructor expressions exceed budget: ${appConstructors} > 180`);

  let audit = null;
  try { audit = JSON.parse(await readFile(path.join(root, 'docs', `feature-audit-${releaseVersion}.json`), 'utf8')); }
  catch { failures.push(`missing or invalid feature audit for ${releaseVersion}`); }
  const auditCounts = counts(audit);
  const expected = { verified_source_test: 734, partial: 0, external_gate: 56, not_implemented: 0 };
  for (const [status, value] of Object.entries(expected)) if (auditCounts[status] !== value) failures.push(`audit count ${status} expected ${value} but found ${auditCounts[status]}`);

  const limitations = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  const runtimePurityLimitation = [/Nolane Native[\s\S]*(external runtime|external compatibility|runtime purity|owned by Nolane Agent)/i, 'Nolane runtime purity limitation'];
  for (const [pattern, label] of [
    [/modules are activated on demand/i, 'on-demand modules limitation'],
    [/does not make every service unloadable/i, 'remaining eager core limitation'],
    [/system available memory/i, 'system memory sampling limitation'],
    runtimePurityLimitation,
    [/do(?:es)? not certify Windows production/i, 'platform certification non-claim'],
  ]) requirePattern(limitations, pattern, label, failures);

  const boundaries = Object.freeze({
    enterpriseEagerAtLocalStartup: false,
    sqliteSsePolling250ms: false,
    externalRuntimeBundledInCore: false,
    everyServiceUnloadable: false,
    windowsProductionCertified: false,
  });
  const metrics = Object.freeze({ appStaticImports, appConstructors, previousAppStaticImports: 171, previousAppConstructors: 192 });
  const base = { schema: 'forge.adaptive-microkernel-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass', auditCounts, metrics, boundaries, failures: Object.freeze(failures) };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { await mkdir(path.dirname(path.resolve(outputFile)), { recursive: true }); await writeFile(path.resolve(outputFile), `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) { const error = new Error(`Adaptive microkernel verification failed with ${failures.length} issue(s)`); error.code = 'ADAPTIVE_MICROKERNEL_VERIFICATION_FAILED'; error.report = report; throw error; }
  return report;
}
