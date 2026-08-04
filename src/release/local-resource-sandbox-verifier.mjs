import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const REQUIRED_CAPABILITIES = Object.freeze([
  'cross-platform-watchdog-process-tree',
  'linux-cgroup-v2-hard-limits',
  'bounded-workspace-disk-meter',
  'durable-principal-project-leases',
  'sustained-violation-termination',
  'terminal-fail-closed-attachment',
  'authenticated-read-sample-close-api',
  'observable-sandbox-manager',
  'item-level-feature-audit',
  'full-release-matrix-gate',
]);

const REQUIRED_FILES = Object.freeze([
  'src/sandbox/platform-resource-driver.mjs',
  'src/sandbox/linux-proc-resource-driver.mjs',
  'src/sandbox/cgroup-v2-resource-driver.mjs',
  'src/sandbox/workspace-disk-meter.mjs',
  'src/sandbox/local-resource-sandbox-service.mjs',
  'src/terminal/terminal-manager.mjs',
  'src/server/routes.mjs',
  'src/server/http-server.mjs',
  'src/server/terminal-websocket.mjs',
  'src/app.mjs',
  'ui/sandbox-manager.js',
  'ui/sandbox-manager.css',
  'ui/app.js',
  'ui/index.html',
  'tests/local-resource-sandbox-drivers.test.mjs',
  'tests/local-resource-sandbox-service.test.mjs',
  'tests/local-resource-sandbox-http-api.test.mjs',
  'tests/local-resource-sandbox-app-wiring.test.mjs',
  'tests/local-resource-sandbox-center-ui.test.mjs',
  'tests/local-resource-sandbox-release-gate.test.mjs',
  'tests/terminal-manager.test.mjs',
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

export async function verifyLocalResourceSandbox({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? '').trim();
  const failures = [];
  if (!/^\d+\.\d+\.\d+$/.test(releaseVersion)) failures.push('stable semantic version is required');

  const contents = new Map();
  for (const relative of REQUIRED_FILES) contents.set(relative, await source(root, relative, failures));
  const platformDriver = contents.get('src/sandbox/platform-resource-driver.mjs') ?? '';
  const procDriver = contents.get('src/sandbox/linux-proc-resource-driver.mjs') ?? '';
  const cgroup = contents.get('src/sandbox/cgroup-v2-resource-driver.mjs') ?? '';
  const disk = contents.get('src/sandbox/workspace-disk-meter.mjs') ?? '';
  const service = contents.get('src/sandbox/local-resource-sandbox-service.mjs') ?? '';
  const terminal = contents.get('src/terminal/terminal-manager.mjs') ?? '';
  const routes = contents.get('src/server/routes.mjs') ?? '';
  const socket = contents.get('src/server/terminal-websocket.mjs') ?? '';
  const app = contents.get('src/app.mjs') ?? '';
  const ui = contents.get('ui/sandbox-manager.js') ?? '';
  const css = contents.get('ui/sandbox-manager.css') ?? '';
  const audit = contents.get('scripts/audit-feature-checklist.mjs') ?? '';
  const matrix = contents.get('src/release/full-release-matrix.mjs') ?? '';

  requirePattern(platformDriver, /Get-CimInstance Win32_Process[\s\S]*taskkill[\s\S]*\/T[\s\S]*\/F/, 'Windows CIM process-tree measurement and taskkill tree termination', failures);
  requirePattern(platformDriver, /class PsProcessResourceDriver[\s\S]*ps[\s\S]*-axo[\s\S]*terminateTree/, 'macOS and POSIX ps watchdog driver', failures);
  requirePattern(procDriver, /class LinuxProcResourceDriver[\s\S]*sampleTree[\s\S]*terminateTree/, 'Linux proc process-tree watchdog driver', failures);
  requirePattern(cgroup, /cgroup\.controllers[\s\S]*cpu\.max[\s\S]*memory\.max[\s\S]*pids\.max[\s\S]*cgroup\.procs/, 'cgroup v2 CPU, memory, process, and PID attachment limits', failures);
  requirePattern(cgroup, /memory\.current[\s\S]*pids\.current[\s\S]*cgroup\.kill/, 'cgroup v2 usage and cleanup evidence', failures);
  requirePattern(disk, /(?=[\s\S]*maxEntries)(?=[\s\S]*maxBytes)(?=[\s\S]*isSymbolicLink\(\))(?=[\s\S]*entry-limit)(?=[\s\S]*byte-limit)/, 'bounded non-symlink-following workspace disk meter', failures);
  requirePattern(service, /DatabaseSync[\s\S]*local_resource_sandbox_leases[\s\S]*project_id[\s\S]*principal_id/, 'durable project and principal scoped leases', failures);
  requirePattern(service, /cpuPercent[\s\S]*memoryBytes[\s\S]*processCount[\s\S]*diskBytes[\s\S]*violationGraceSamples/, 'bounded four-dimension resource policy', failures);
  requirePattern(service, /(?=[\s\S]*consecutiveViolations)(?=[\s\S]*terminateTree)(?=[\s\S]*state:\s*'violated')(?=[\s\S]*receiptSha256)/, 'sustained violation termination and content-addressed receipt', failures);
  requirePattern(service, /nativeDrivers[\s\S]*podman[\s\S]*windowsJobObjects[\s\S]*macOsSandbox/, 'native isolation capability probes', failures);
  requirePattern(terminal, /resourceSandbox\.createLease[\s\S]*service\.create[\s\S]*session\?\.pid[\s\S]*resourceSandbox\.attachProcess/, 'terminal lease creation and PID attachment', failures);
  requirePattern(terminal, /service\.terminate[\s\S]*resourceSandbox\.closeLease|resourceSandbox\.closeLease[\s\S]*terminate/, 'terminal fail-closed rollback and cleanup', failures);
  requirePattern(routes, /\/api\/local-resource-sandboxes\/capabilities[\s\S]*\/api\/local-resource-sandboxes[\s\S]*sample\|close/, 'authenticated sandbox read, sample, and close endpoints', failures);
  if (/local-resource-sandboxes[^\n]*attach|attach[^\n]*local-resource-sandboxes/i.test(routes)) failures.push('arbitrary PID attach endpoint must not exist');
  requirePattern(socket, /principalId:\s*'local-admin'[\s\S]*sandbox:\s*message\.sandbox/, 'terminal WebSocket sandbox policy propagation', failures);
  requirePattern(app, /LocalResourceSandboxService[\s\S]*local-resource-sandboxes\.db[\s\S]*resourceSandbox:\s*localResourceSandbox/, 'application service and terminal wiring', failures);
  requirePattern(ui, /(?=[\s\S]*Local Resource Sandbox)(?=[\s\S]*CPU)(?=[\s\S]*RAM)(?=[\s\S]*Process)(?=[\s\S]*Disk)(?=[\s\S]*receiptSha256)(?=[\s\S]*\/sample)(?=[\s\S]*\/close)/, 'observable four-meter sandbox manager with receipts and controls', failures);
  requirePattern(css, /sandbox-manager[\s\S]*sandbox-meter[\s\S]*sandbox-lease/, 'sandbox manager responsive styling', failures);
  requirePattern(audit, /sections:\s*\[4\][\s\S]*Trình quản lý sandbox[\s\S]*localResourceSandbox/, 'sandbox manager item-level audit rule', failures);
  requirePattern(audit, /sections:\s*\[18\][^\n]*Hỗ trợ giới hạn \(CPU\|RAM\|process\|disk\)[^\n]*localResourceSandbox/, 'CPU, RAM, process, and disk item-level audit rules', failures);
  requirePattern(audit, /EXTERNAL_RULES[\s\S]*Hỗ trợ Podman[\s\S]*Hỗ trợ Windows Job Objects[\s\S]*Hỗ trợ macOS sandbox/, 'honest OS sandbox and Podman external gates', failures);
  requirePattern(matrix, /id:\s*'local-resource-sandbox'[\s\S]*scripts\/verify-local-resource-sandbox\.mjs/, 'full release matrix gate', failures);

  const fileDigests = {};
  for (const [relative, text] of contents) if (text) fileDigests[relative] = canonicalSha256({ relative, text });
  const base = {
    schema: 'forge.studio.local-resource-sandbox-verification.v1',
    version: releaseVersion,
    status: failures.length ? 'fail' : 'pass',
    requiredCapabilities: REQUIRED_CAPABILITIES,
    limitations: Object.freeze({
      cgroupV2HardLimitsOnlyWhenWritable: true,
      watchdogModeTerminatesAfterSustainedViolation: true,
      windowsJobObjectsClaimed: false,
      macOsSandboxClaimed: false,
      podmanClaimed: false,
      nativeDriverContractsPresent: true,
      namespaceIsolationClaimed: false,
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
    const error = new Error(`Local resource sandbox verification failed: ${failures.join('; ')}`);
    error.code = 'LOCAL_RESOURCE_SANDBOX_VERIFICATION_FAILED';
    error.report = report;
    throw error;
  }
  return report;
}
