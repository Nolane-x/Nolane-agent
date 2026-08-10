import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { TreeSitterRuntimeService } from '../repository/tree-sitter-runtime-service.mjs';
import { PodmanSandboxDriver } from '../sandbox/podman-sandbox-driver.mjs';
import { WindowsJobObjectDriver } from '../sandbox/windows-job-object-driver.mjs';
import { MacOsSandboxDriver } from '../sandbox/macos-sandbox-driver.mjs';
import { CredentialHelperClient } from '../security/credential-helper-client.mjs';

const classIds = Object.freeze({
  runner_os: Object.freeze(['1.7', '1.8']),
  github_lifecycle: Object.freeze(['2.17', '2.27', '3.15', '7.23', '26.30', '26.31', '26.32', '26.38']),
  managed_cloud: Object.freeze([
    '1.6', '2.26', '3.24', '3.25', '7.25',
    '20.3', '20.4', '20.5', '20.8', '20.10', '20.11', '20.12', '20.13', '20.14', '20.32', '20.34',
    '22.2', '22.3', '22.4', '22.5', '22.7', '22.8', '22.9', '22.10', '22.11', '22.12', '22.13',
    '22.14', '22.15', '22.16', '22.22', '22.23', '22.24', '22.28', '22.29',
  ]),
  native_runtime: Object.freeze(['13.27', '21.1', '21.2', '21.3', '21.4', '21.5', '21.6', '21.7']),
  os_keychain: Object.freeze(['25.6']),
  provider_credentials: Object.freeze(['26.39', '26.40']),
});

export const EXTERNAL_GATE_CLASSES = Object.freeze(Object.fromEntries(
  Object.entries(classIds).flatMap(([classification, ids]) => ids.map((id) => [id, classification])),
));

function bounded(value, limit = 160) {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, limit);
}

function commandProbe(command, args) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(Object.freeze(result));
    };
    let child;
    try {
      child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      finish({ available: false, reason: error?.code === 'ENOENT' ? 'not-installed' : 'probe-failed' });
      return;
    }
    const timer = setTimeout(() => {
      child.kill();
      finish({ available: false, reason: 'probe-timeout' });
    }, 5_000);
    timer.unref?.();
    child.stdout.on('data', (chunk) => { stdout = `${stdout}${chunk}`.slice(0, 4_096); });
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(0, 4_096); });
    child.once('error', (error) => {
      clearTimeout(timer);
      finish({ available: false, reason: error?.code === 'ENOENT' ? 'not-installed' : 'probe-failed' });
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      const version = bounded(stdout || stderr);
      finish(code === 0 ? { available: true, version } : { available: false, reason: 'probe-failed', exitCode: code });
    });
  });
}

export async function probeCredentialHelper({
  rootDirectory = process.cwd(),
  command = process.env.NOLANE_CREDENTIAL_HELPER
    || path.join(rootDirectory, 'native', 'credential', process.platform === 'win32' ? 'NolaneCredential.exe' : 'nolane-credential'),
  accessImpl = access,
  clientFactory = (options) => new CredentialHelperClient(options),
} = {}) {
  try { await accessImpl(command); } catch { return Object.freeze({ available: false, reason: 'helper-not-built' }); }
  const client = clientFactory({ command, requestTimeoutMs: 5_000, startupTimeoutMs: 5_000 });
  const service = 'nolane-external-gate-probe';
  const account = `gate-${process.pid}-${Date.now()}`;
  const secret = randomBytes(24).toString('base64url');
  let stored = false;
  let cleanup = false;
  try {
    const initialized = await client.start();
    await client.set({ service, account, secret });
    stored = true;
    const resolved = await client.resolve({ service, account });
    if (resolved !== secret) throw new Error('credential-round-trip-mismatch');
    cleanup = await client.delete({ service, account });
    stored = false;
    return Object.freeze({
      available: cleanup === true,
      backend: bounded(initialized?.backend),
      protocolVersion: Number(initialized?.protocolVersion ?? 0),
      roundTrip: true,
      cleanup,
    });
  } catch (error) {
    if (stored) cleanup = await client.delete({ service, account }).catch(() => false);
    return Object.freeze({ available: false, reason: bounded(error?.code || error?.message || 'probe-failed'), roundTrip: false, cleanup });
  } finally {
    await client.close().catch(() => {});
  }
}

async function defaultRuntimeProbes(rootDirectory) {
  const [treeSitter, podman, windowsJobObjects, macOsSandbox, docker, wsl, osKeychain] = await Promise.all([
    new TreeSitterRuntimeService({ projectResolver: () => null }).capabilities(),
    new PodmanSandboxDriver().capabilities(),
    new WindowsJobObjectDriver({ helperPath: process.env.NOLANE_JOB_OBJECT_HELPER || path.join(rootDirectory, 'native', 'job-object', 'forge-job-object.exe') }).capabilities(),
    new MacOsSandboxDriver().capabilities(),
    commandProbe('docker', ['version', '--format', '{{.Server.Version}}']),
    process.platform === 'win32' ? commandProbe('wsl.exe', ['--status']) : Promise.resolve({ available: false, reason: 'wrong-platform' }),
    probeCredentialHelper({ rootDirectory }),
  ]);
  return Object.freeze({ treeSitter, podman, windowsJobObjects, macOsSandbox, docker, wsl, osKeychain });
}

function nativeCapability(id, probes) {
  if (id === '13.27') return probes.treeSitter;
  if (id === '21.1') return [probes.windowsJobObjects, probes.macOsSandbox, probes.podman].find((item) => item?.available) ?? { available: false };
  if (id === '21.2') return [probes.podman, probes.docker].find((item) => item?.available) ?? { available: false };
  if (id === '21.3') return probes.docker;
  if (id === '21.4') return probes.podman;
  if (id === '21.5') return probes.wsl;
  if (id === '21.6') return probes.windowsJobObjects;
  return probes.macOsSandbox;
}

function observationFor(id, classification, environment, probes) {
  if (classification === 'managed_cloud') return { observation: 'requires-managed-infrastructure' };
  if (classification === 'provider_credentials') return { observation: 'requires-provider-credentials' };
  if (classification === 'os_keychain') return { observation: probes.osKeychain?.available ? 'observed' : 'runtime-unavailable', capability: probes.osKeychain ?? null };
  if (classification === 'native_runtime') {
    const capability = nativeCapability(id, probes) ?? { available: false };
    return { observation: capability.available ? 'observed' : 'runtime-unavailable', capability };
  }
  if (classification === 'runner_os') {
    if (id === '1.7') return { observation: environment.platform === 'win32' ? 'observed-on-windows' : 'not-observed' };
    if (environment.platform === 'linux') return { observation: 'observed-on-linux' };
    if (environment.platform === 'darwin') return { observation: 'observed-on-macos' };
    return { observation: 'not-observed' };
  }
  const isGitHubRun = environment.githubActions === true && environment.githubRepository === 'Nolane-x/Nolane-agent';
  if (id === '2.27' || id === '26.38') return { observation: isGitHubRun ? 'observed' : 'not-observed' };
  if (id === '26.32') return { observation: isGitHubRun && environment.githubIssueLinked === true ? 'observed' : 'not-observed' };
  return { observation: isGitHubRun && environment.githubEventName === 'pull_request' ? 'observed' : 'not-observed' };
}

function currentEnvironment() {
  return Object.freeze({
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    githubActions: process.env.GITHUB_ACTIONS === 'true',
    githubEventName: bounded(process.env.GITHUB_EVENT_NAME, 64),
    githubRepository: bounded(process.env.GITHUB_REPOSITORY, 160),
    githubRef: bounded(process.env.GITHUB_REF, 320),
    githubIssueLinked: process.env.NOLANE_GITHUB_ISSUE_LINKED === 'true',
    runnerOs: bounded(process.env.RUNNER_OS || process.platform, 64),
  });
}

export async function collectExternalGateEvidence({
  rootDirectory = process.cwd(), version, outputFile,
  environment = currentEnvironment(), runtimeProbes = defaultRuntimeProbes,
} = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = bounded(version, 80);
  if (!releaseVersion) throw new TypeError('Version is required');
  const audit = JSON.parse(await readFile(path.join(root, 'docs', `feature-audit-${releaseVersion}.json`), 'utf8'));
  const external = (audit.sections ?? []).flatMap((section) => section.items ?? []).filter((item) => item.status === 'external_gate');
  const auditIds = new Set(external.map((item) => item.id));
  const classifiedIds = Object.keys(EXTERNAL_GATE_CLASSES);
  const missing = [...auditIds].filter((id) => !EXTERNAL_GATE_CLASSES[id]);
  const stale = classifiedIds.filter((id) => !auditIds.has(id));
  if (missing.length || stale.length) throw new Error(`External gate classification drift (missing=${missing.join(',')}; stale=${stale.join(',')})`);

  const probes = Object.freeze(await runtimeProbes(root));
  const gates = external.map((item) => {
    const classification = EXTERNAL_GATE_CLASSES[item.id];
    return Object.freeze({
      id: item.id,
      text: bounded(item.text, 240),
      classification,
      ...observationFor(item.id, classification, environment, probes),
    });
  });
  const classSummary = Object.fromEntries(Object.keys(classIds).map((key) => [key, gates.filter((gate) => gate.classification === key).length]));
  const base = {
    schema: 'nolane.agent.external-gate-evidence.v1',
    version: releaseVersion,
    totalExternalGates: gates.length,
    classSummary,
    environment: Object.freeze({ ...environment }),
    probes,
    gates: Object.freeze(gates),
  };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) {
    const target = path.resolve(outputFile);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o644 });
  }
  return report;
}
