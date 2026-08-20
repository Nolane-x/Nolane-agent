import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { SecretScanner } from '../security/secret-scanner.mjs';

const MAX_CAPTURE_BYTES = 8 * 1024 * 1024;


function releaseIdentity(rootDirectory) {
  try {
    const identity = JSON.parse(readFileSync(path.join(rootDirectory, 'config', 'release-identity.json'), 'utf8'));
    if (identity.schema === 'nolane.agent.release-identity.v1') return { product: 'Nolane Agent', prefix: identity.artifactPrefix, schema: 'nolane.agent.full-release-matrix.v1' };
    if (identity.schema === 'forge.studio.release-identity.v1') return { product: 'Forge Studio', prefix: identity.artifactPrefix, schema: 'forge.full-release-matrix.v1' };
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return { product: 'Forge Studio', prefix: 'ForgeStudio', schema: 'forge.full-release-matrix.v1' };
}


function validateGate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Release gate must be an object');
  const id = String(value.id ?? '').trim();
  const label = String(value.label ?? '').trim();
  const command = String(value.command ?? '').trim();
  const args = Array.isArray(value.args) ? value.args.map(String) : [];
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(id)) throw new TypeError(`Invalid release gate id: ${id}`);
  if (!label || !command) throw new TypeError(`Release gate ${id} requires label and command`);
  return Object.freeze({
    id,
    label,
    command,
    args: Object.freeze(args),
    cwd: String(value.cwd ?? '.'),
    required: value.required !== false,
    timeoutMs: Number.isFinite(Number(value.timeoutMs)) ? Math.max(1_000, Number(value.timeoutMs)) : 10 * 60_000,
    env: Object.freeze({ ...(value.env ?? {}) }),
    expectStdoutEmpty: value.expectStdoutEmpty === true,
  });
}

function safeText(value, scanner) {
  const text = String(value ?? '').slice(0, MAX_CAPTURE_BYTES);
  try { return scanner.scanText(text, { source: 'release-matrix-log' }).redactedText; }
  catch { return '[REDACTED:log-unavailable]'; }
}

export function executeReleaseGate(gate, { rootDirectory = process.cwd(), signal = null } = {}) {
  const normalized = validateGate(gate);
  return new Promise((resolve) => {
    const started = Date.now();
    const stdout = [];
    const stderr = [];
    let captured = 0;
    let settled = false;
    const child = spawn(normalized.command, normalized.args, {
      cwd: path.resolve(rootDirectory, normalized.cwd),
      env: { ...process.env, ...normalized.env },
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const capture = (target) => (chunk) => {
      if (captured >= MAX_CAPTURE_BYTES) return;
      const remaining = MAX_CAPTURE_BYTES - captured;
      const value = Buffer.from(chunk).subarray(0, remaining);
      captured += value.length;
      target.push(value);
    };
    child.stdout.on('data', capture(stdout));
    child.stderr.on('data', capture(stderr));
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', abort);
      resolve({
        exitCode: result.exitCode,
        signal: result.signal ?? null,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        durationMs: Date.now() - started,
        timedOut: result.timedOut === true,
        spawnError: result.spawnError ?? null,
        outputTruncated: captured >= MAX_CAPTURE_BYTES,
      });
    };
    child.on('error', (error) => finish({ exitCode: -1, signal: null, spawnError: String(error?.message ?? error) }));
    child.on('close', (code, closeSignal) => finish({ exitCode: Number.isInteger(code) ? code : -1, signal: closeSignal }));
    const abort = () => child.kill('SIGKILL');
    signal?.addEventListener?.('abort', abort, { once: true });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish({ exitCode: -1, signal: 'SIGKILL', timedOut: true });
    }, normalized.timeoutMs);
  });
}

export function defaultReleaseGates({ rootDirectory = process.cwd(), version } = {}) {
  const root = path.resolve(rootDirectory);
  const forgeRoot = path.join(root, 'vendor', 'forge-os');
  const identity = releaseIdentity(root);
  const releaseRoot = `release/${identity.prefix}-${version}`;
  const goEnv = Object.freeze({
    GOCACHE: path.join(root, 'release', '.cache', 'go-build'),
    GOMODCACHE: path.join(root, 'release', '.cache', 'go-mod'),
  });
  const py = process.env.NOLANE_AGENT_PYTHON || process.env.FORGE_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  const versionText = String(version ?? '');
  const currentReleaseGateSet = versionText === '5.0.0-beta.6' || versionText === '0.0.0';
  const gates = [
    { id: 'source-clean', label: 'Committed source tree is clean', command: 'git', args: ['status', '--porcelain=v1', '--untracked-files=all'], expectStdoutEmpty: true, timeoutMs: 30_000 },
    { id: 'version-coherence', label: 'Release identity and artifact version coherence', command: process.execPath, args: ['scripts/verify-version-coherence.mjs', '.'], timeoutMs: 60_000 },
    { id: 'nolane-runtime-purity', label: 'Nolane-owned runtime and release brand purity', command: process.execPath, args: ['scripts/verify-nolane-runtime-purity.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'electron-installer-config', label: 'Windows NSIS installer identity and update compatibility', command: process.execPath, args: ['scripts/verify-electron-installer-config.mjs', '.'], timeoutMs: 3 * 60_000 },
    { id: 'signed-update-contract', label: 'Signed GitHub release manifest, download policy and installer validation', command: process.execPath, args: ['--test', 'tests/update-release-tools.test.mjs', 'tests/update-service.test.mjs'], timeoutMs: 5 * 60_000 },
    { id: 'electron-update-wiring', label: 'Electron update notification, staging, install/restart and recovery boundary', command: process.execPath, args: ['--test', 'tests/electron-update-controller.test.mjs', 'tests/electron-update-wiring.test.mjs'], timeoutMs: 5 * 60_000 },
    { id: 'github-release-workflow', label: 'GitHub Actions CI, NSIS release, attestations and channel feed', command: process.execPath, args: ['--test', 'tests/github-release-workflow.test.mjs'], timeoutMs: 3 * 60_000 },
    { id: 'update-trust-bootstrap', label: 'Packaged public update trust with runner-only private key', command: process.execPath, args: ['--test', 'tests/update-trust-bootstrap.test.mjs'], timeoutMs: 3 * 60_000 },
    { id: 'beta1-release-docs', label: 'Beta.1 release, limitations, verification and publishing non-claims', command: process.execPath, args: ['--test', 'tests/nolane-beta1-release-docs.test.mjs'], timeoutMs: 3 * 60_000 },
    ...((() => {
      const text = versionText;
      if (currentReleaseGateSet) return true;
      const match = text.match(/^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/);
      if (!match) return false;
      const [, majorText, minorText, patchText, phase, sequenceText] = match;
      const major = Number(majorText); const minor = Number(minorText); const patch = Number(patchText); const sequence = Number(sequenceText ?? 0);
      if (major > 5 || (major === 5 && (minor > 0 || patch > 0))) return true;
      if (major !== 5 || minor !== 0 || patch !== 0) return false;
      if (!phase || phase === 'rc') return true;
      return phase === 'beta' && sequence >= 2;
    })() ? [
      { id: 'native-core-inventory', label: 'Complete clean-room upstream core inventory and classification truth reset', command: process.execPath, args: ['scripts/verify-nolane-native-core-inventory.mjs', '.'], timeoutMs: 3 * 60_000 },
      { id: 'master-acceptance-ledger', label: 'Canonical legacy, Nolane V5 and native-core acceptance ledger with fresh evidence', command: process.execPath, args: ['scripts/verify-master-acceptance-ledger.mjs', '.'], timeoutMs: 5 * 60_000 },
      { id: 'native-core-contract-catalog', label: 'Behavior-level native core conformance and complete-parity claim lock', command: process.execPath, args: ['scripts/verify-native-core-parity.mjs', '.'], timeoutMs: 5 * 60_000 },
      { id: 'native-core-runtime-kernel', label: 'Bounded shared turn lifecycle, cancellation and immutable runtime receipts', command: process.execPath, args: ['--test', 'tests/native-core-runtime-kernel.test.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'native-core-context-provider', label: 'Tiered context assembly, quarantine and provider fallback fabric', command: process.execPath, args: ['--test', 'tests/native-core-context-provider.test.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'native-core-tool-execution', label: 'Typed tool and execution backend fabric with cancellation and cleanup', command: process.execPath, args: ['--test', 'tests/native-core-tool-execution.test.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'native-core-state-learning', label: 'Persistent sessions, bounded memory and verified-only skill learning', command: process.execPath, args: ['--test', 'tests/native-core-state-learning.test.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'native-core-extension-automation', label: 'Signed plugins, bounded MCP, durable scheduling and worker leases', command: process.execPath, args: ['--test', 'tests/native-core-extension-automation.test.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'native-core-gateway-api', label: 'Authorized gateway ledger, exactly-once delivery and shared product surfaces', command: process.execPath, args: ['--test', 'tests/native-core-gateway-api.test.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'native-core-operations-security', label: 'Tamper-evident operations, egress, backup, provenance and recovery fabric', command: process.execPath, args: ['--test', 'tests/native-core-operations-security.test.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'native-core-goal-evidence', label: 'Independent evidence-gated goal completion and hidden-reasoning rejection', command: process.execPath, args: ['--test', 'tests/native-core-goal-evidence.test.mjs', 'tests/nolane-native-agent-service.test.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'native-core-adapter-tck', label: 'Typed adapter lifecycle, permission, cancellation and secret-isolation conformance', command: process.execPath, args: ['--test', 'tests/native-core-adapter-tck.test.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'native-core-mixture-of-agents', label: 'Independent proposal, disagreement-preserving synthesis and verifier-gated MoA', command: process.execPath, args: ['--test', 'tests/native-core-mixture-of-agents.test.mjs'], timeoutMs: 5 * 60_000 },
      ...(String(version) === '5.0.0-beta.2' ? [
        { id: 'beta2-release-docs', label: 'Beta.2 native-core parity, release limitations and non-claim documentation', command: process.execPath, args: ['--test', 'tests/nolane-beta2-release-docs.test.mjs'], timeoutMs: 3 * 60_000 },
      ] : [
        { id: 'native-core-runtime-wave3', label: 'ACP, provider protocol, repository intelligence and delegation runtime conversion', command: process.execPath, args: ['--test', 'tests/native-core-runtime-wave3.test.mjs'], timeoutMs: 5 * 60_000 },
        { id: 'native-core-surface-wave3', label: 'Browser, gateway, command surface and usage runtime conversion', command: process.execPath, args: ['--test', 'tests/native-core-surface-wave3.test.mjs'], timeoutMs: 5 * 60_000 },
        { id: 'native-core-wave3-production-wiring', label: 'Runtime conversion production service, HTTP and application wiring', command: process.execPath, args: ['--test', 'tests/native-core-wave3-production-wiring.test.mjs'], timeoutMs: 5 * 60_000 },
        { id: 'native-core-wave3-parity-mapping', label: 'Exact upstream behavior mapping and empty-residual pruning', command: process.execPath, args: ['--test', 'tests/native-core-wave3-parity-mapping.test.mjs'], timeoutMs: 5 * 60_000 },
        ...(String(version) === '5.0.0-beta.3' ? [
          { id: 'beta3-release-docs', label: 'Beta.3 runtime conversion, limitations, parity and non-claim documentation', command: process.execPath, args: ['--test', 'tests/nolane-beta3-release-docs.test.mjs'], timeoutMs: 3 * 60_000 },
        ] : [
          { id: 'native-core-agent-behavior-wave4', label: 'Public messages, titles, one-shot execution, independent review and replay cleanup', command: process.execPath, args: ['--test', 'tests/native-core-agent-behavior-wave4.test.mjs'], timeoutMs: 5 * 60_000 },
          { id: 'native-core-session-lifecycle-wave4', label: 'Persistent session metadata, search, branch, rewind, queue and safe exports', command: process.execPath, args: ['--test', 'tests/native-core-session-lifecycle-wave4.test.mjs'], timeoutMs: 5 * 60_000 },
          { id: 'native-core-tool-governance-wave4', label: 'Schema, URL, path, diff, checkpoint, output and budget governance', command: process.execPath, args: ['--test', 'tests/native-core-tool-governance-wave4.test.mjs'], timeoutMs: 5 * 60_000 },
          { id: 'native-core-profile-oauth-wave4', label: 'Versioned profiles, credential references, PKCE callback and revocation runtime', command: process.execPath, args: ['--test', 'tests/native-core-profile-oauth-wave4.test.mjs'], timeoutMs: 5 * 60_000 },
          { id: 'native-core-wave4-production-wiring', label: 'Runtime wave4 orchestration and bounded authenticated HTTP production paths', command: process.execPath, args: ['--test', 'tests/native-core-wave4-production-wiring.test.mjs'], timeoutMs: 5 * 60_000 },
          { id: 'native-core-wave4-parity-mapping', label: 'Exact residual behavior mapping with provider and UI external gates retained', command: process.execPath, args: ['--test', 'tests/native-core-wave4-parity-mapping.test.mjs'], timeoutMs: 5 * 60_000 },
          ...(String(version) === '5.0.0-beta.4' ? [
            { id: 'beta4-release-docs', label: 'Beta.4 runtime wave, limitations, parity and non-claim documentation', command: process.execPath, args: ['--test', 'tests/nolane-beta4-release-docs.test.mjs'], timeoutMs: 3 * 60_000 },
          ] : [
            { id: 'native-core-runtime-wave5', label: 'Kanban, local observability, skill bundle, dashboard auth, session search, cron and JSON runtime conversion', command: process.execPath, args: ['--test', 'tests/native-core-runtime-wave5.test.mjs'], timeoutMs: 5 * 60_000 },
            { id: 'native-core-wave5-production-wiring', label: 'Runtime wave5 orchestration and bounded authenticated HTTP production paths', command: process.execPath, args: ['--test', 'tests/native-core-wave5-production-wiring.test.mjs'], timeoutMs: 5 * 60_000 },
            { id: 'native-core-wave5-parity-mapping', label: 'Exact local runtime mapping with real provider and platform gates retained', command: process.execPath, args: ['--test', 'tests/native-core-wave5-parity-mapping.test.mjs'], timeoutMs: 5 * 60_000 },
            ...(String(version) === '5.0.0-beta.5' ? [
              { id: 'beta5-release-docs', label: 'Beta.5 runtime wave, limitations, parity and non-claim documentation', command: process.execPath, args: ['--test', 'tests/nolane-beta5-release-docs.test.mjs'], timeoutMs: 3 * 60_000 },
            ] : [
              { id: 'native-core-runtime-wave6', label: 'MCP OAuth, browser supervision, async delegation, PTY, gateway recovery and local media runtime conversion', command: process.execPath, args: ['--test', 'tests/native-core-runtime-wave6.test.mjs'], timeoutMs: 5 * 60_000 },
              { id: 'native-core-wave6-production-wiring', label: 'Runtime wave6 lifecycle, orchestration and bounded authenticated HTTP production paths', command: process.execPath, args: ['--test', 'tests/native-core-wave6-production-wiring.test.mjs'], timeoutMs: 5 * 60_000 },
              { id: 'native-core-wave6-parity-mapping', label: 'Exact wave6 upstream behavior mapping with real provider and platform gates retained', command: process.execPath, args: ['--test', 'tests/native-core-wave6-parity-mapping.test.mjs'], timeoutMs: 5 * 60_000 },
              ...(versionText === '5.0.0-beta.6' ? [
                { id: 'beta6-release-docs', label: 'Beta.6 runtime wave, limitations, parity and non-claim documentation', command: process.execPath, args: ['--test', 'tests/nolane-beta6-release-docs.test.mjs'], timeoutMs: 3 * 60_000 },
              ] : versionText === '0.0.0' ? [
                { id: 'current-release-docs', label: '0.0.0 release, limitations, verification, and publication non-claims', command: process.execPath, args: ['--test', 'tests/nolane-release-0-0-0-docs.test.mjs'], timeoutMs: 3 * 60_000 },
              ] : [
                { id: 'native-core-no-residual-catchall', label: 'No residual contract IDs or broad catch-all path patterns', command: process.execPath, args: ['scripts/verify-native-core-decomposition.mjs', 'no-residual'], timeoutMs: 3 * 60_000 },
                { id: 'native-core-single-owner-mapping', label: 'Every decomposed upstream path has one canonical owner and one conformance mapping', command: process.execPath, args: ['scripts/verify-native-core-decomposition.mjs', 'single-owner'], timeoutMs: 3 * 60_000 },
                { id: 'native-core-zero-empty-contract', label: 'Every native core contract owns at least one pinned upstream behavior path', command: process.execPath, args: ['scripts/verify-native-core-decomposition.mjs', 'zero-empty'], timeoutMs: 3 * 60_000 },
                { id: 'native-core-exclusion-policy', label: 'Nolane-owned entitlement and explicit upstream billing non-copy policy', command: process.execPath, args: ['scripts/verify-native-core-decomposition.mjs', 'exclusion-policy'], timeoutMs: 3 * 60_000 },
                { id: 'beta7-release-docs', label: 'Beta.7 residual decomposition, entitlement policy, limitations and non-claim documentation', command: process.execPath, args: ['--test', 'tests/nolane-beta7-release-docs.test.mjs'], timeoutMs: 3 * 60_000 },
              ]),
            ]),
          ]),
        ]),
      ]),
    ] : []),
    ...(currentReleaseGateSet ? [
      { id: 'native-core-wave6-decomposition-checkpoint', label: 'Residual decomposition, single-owner mapping, zero-empty contracts and entitlement exclusion policy', command: process.execPath, args: ['--test', 'tests/native-core-residual-decomposition.test.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'native-core-wave7-execution-checkpoint', label: 'Wave 7 execution runtime, production wiring and exact parity mapping', command: process.execPath, args: ['--test', 'tests/native-core-execution-wave7.test.mjs', 'tests/native-core-execution-wave7-production-wiring.test.mjs', 'tests/native-core-execution-wave7-parity-mapping.test.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'native-core-wave8-session-checkpoint', label: 'Wave 8 session runtime, production wiring and exact parity mapping', command: process.execPath, args: ['--test', 'tests/native-core-session-wave8.test.mjs', 'tests/native-core-session-wave8-production-wiring.test.mjs', 'tests/native-core-session-wave8-parity-mapping.test.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'native-core-wave9-provider-checkpoint', label: 'Wave 9 provider transport runtime, production wiring and exact parity mapping', command: process.execPath, args: ['--test', 'tests/native-core-provider-wave9.test.mjs', 'tests/native-core-provider-wave9-production-wiring.test.mjs', 'tests/native-core-provider-wave9-parity-mapping.test.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'native-core-wave10-gateway-checkpoint', label: 'Wave 10 gateway and messaging runtime, production wiring and exact parity mapping', command: process.execPath, args: ['--test', 'tests/native-core-gateway-wave10.test.mjs', 'tests/native-core-gateway-wave10-production-wiring.test.mjs', 'tests/native-core-gateway-wave10-parity-mapping.test.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'native-core-wave11-browser-checkpoint', label: 'Wave 11 browser engine, production wiring and exact parity mapping', command: process.execPath, args: ['--test', 'tests/native-core-browser-wave11.test.mjs', 'tests/native-core-browser-wave11-production-wiring.test.mjs', 'tests/native-core-browser-wave11-parity-mapping.test.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'native-core-wave12-adapter-checkpoint', label: 'Wave 12 adapter ecosystem, production wiring and exact parity mapping', command: process.execPath, args: ['--test', 'tests/native-core-adapter-ecosystem-wave12.test.mjs', 'tests/native-core-adapter-ecosystem-wave12-production-wiring.test.mjs', 'tests/native-core-adapter-ecosystem-wave12-parity-mapping.test.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'native-core-wave13-trust-checkpoint', label: 'Wave 13 trust core, production wiring and exact parity mapping', command: process.execPath, args: ['--test', 'tests/native-core-trust-wave13.test.mjs', 'tests/native-core-trust-wave13-production-wiring.test.mjs', 'tests/native-core-trust-wave13-parity-mapping.test.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'native-core-wave14-media-checkpoint', label: 'Wave 14 media core, production wiring and exact parity mapping', command: process.execPath, args: ['--test', 'tests/native-core-media-wave14.test.mjs', 'tests/native-core-media-wave14-production-wiring.test.mjs', 'tests/native-core-media-wave14-parity-mapping.test.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'native-core-wave15-product-config-checkpoint', label: 'Wave 15 shared product and configuration runtime, production wiring and exact parity mapping', command: process.execPath, args: ['--test', 'tests/native-core-product-config-wave15.test.mjs', 'tests/native-core-product-config-wave15-production-wiring.test.mjs', 'tests/native-core-product-config-wave15-parity-mapping.test.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'native-core-waves16-19-fail-closed-checkpoint', label: 'Waves 16-19 external certification receipt and stable-release claim lock', command: process.execPath, args: ['--test', 'tests/native-core-external-certification-checkpoint.test.mjs', 'tests/nolane-native-wave-checkpoint-docs.test.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'nolane-proof-intelligence', label: 'Proof-carrying missions, causal repository twin, adversarial selection and adaptive model governance', command: process.execPath, args: ['scripts/verify-nolane-proof-intelligence.mjs', '.'], timeoutMs: 5 * 60_000 },
      { id: 'deep-superiority-wave-batch', label: 'Mission constitution, counterfactual planning, verified memory, self-healing, proof budgets, benchmark, UI and dogfood protocols', command: process.execPath, args: ['scripts/verify-deep-superiority-wave-batch.mjs', '.'], timeoutMs: 5 * 60_000 },
      { id: 'forensic-recovery-checkpoint-1', label: 'Fail-closed source custody, symbol inventory, truth ledger, evidence reset and UI v3 gap audit', command: process.execPath, args: ['scripts/verify-forensic-recovery-checkpoint-1.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'forensic-recovery-checkpoint-2', label: 'Source-local UI v3 completion, assertion evidence bindings, verified beta default and protected non-claims', command: process.execPath, args: ['scripts/verify-forensic-recovery-checkpoint-2.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'forensic-recovery-checkpoint-3', label: 'Full-ledger assertion dispositions, trained bounded tool-router artifact, held-out benchmark and protected non-claims', command: process.execPath, args: ['scripts/verify-forensic-recovery-checkpoint-3.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'forensic-recovery-checkpoint-4', label: 'Reduced assertion-unbound evidence backlog, four trained bounded specialists, governed decision support and protected non-claims', command: process.execPath, args: ['scripts/verify-forensic-recovery-checkpoint-4.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'forensic-recovery-checkpoint-5', label: 'Exact assertion migrations, verified repository trajectories, five repository-trained specialists and protected non-claims', command: process.execPath, args: ['scripts/verify-forensic-recovery-checkpoint-5.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'forensic-recovery-checkpoint-6', label: 'Complete local assertion evidence, multi-runtime mutation recovery, ablation-governed specialists and protected non-claims', command: process.execPath, args: ['scripts/verify-forensic-recovery-checkpoint-6.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'forensic-recovery-checkpoint-7', label: 'Held-out long-horizon missions, process rewards, transferable skills and transfer-process-cost-governed promotion', command: process.execPath, args: ['scripts/verify-forensic-recovery-checkpoint-7.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'forensic-recovery-checkpoint-8', label: 'Project-disjoint AST transfer, bounded constraint proofs, solver portfolio and promotion v4', command: process.execPath, args: ['scripts/verify-forensic-recovery-checkpoint-8.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'forensic-recovery-checkpoint-9', label: 'Type-aware multi-file refactor transfer, seeded solver property proofs and promotion v5', command: process.execPath, args: ['scripts/verify-forensic-recovery-checkpoint-9.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'forensic-recovery-checkpoint-10', label: 'TypeScript semantic transfer, cross-language generated contracts, property proofs and promotion v6', command: process.execPath, args: ['scripts/verify-forensic-recovery-checkpoint-10.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'checkpoint-10-ux-foundation', label: 'Production-wired Settings, model intelligence, live summary, persistent resizing and adaptive UX', command: process.execPath, args: ['scripts/verify-checkpoint-10-ux-foundation.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'model-profile-catalog-checkpoint-11', label: 'Normalized exact profiles, catalog imports, inference, sync, export and conservative unknown handling', command: process.execPath, args: ['--test', 'tests/model-profile-registry.test.mjs', 'tests/model-catalog-import.test.mjs', 'tests/model-profile-sync.test.mjs', 'tests/model-profile-export.test.mjs', 'tests/model-profile-http-api.test.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'model-control-plane-checkpoint-11', label: 'Health, circuit breaker, policy routing, provider-diverse fallback, portfolios, dossiers and HTTP management', command: process.execPath, args: ['--test', 'tests/model-health-ledger.test.mjs', 'tests/model-policy-engine.test.mjs', 'tests/model-management-service.test.mjs', 'tests/model-profile-intelligence-adapter.test.mjs', 'tests/model-management-http-api.test.mjs'], timeoutMs: 5 * 60_000 },
      { id: 'model-intelligence-evidence-checkpoint-11', label: 'Catalog breadth, fail-closed uncertainty, receipt integrity, production wiring and release documentation', command: process.execPath, args: ['scripts/verify-model-intelligence-control-plane.mjs', '.'], timeoutMs: 5 * 60_000 },
    ] : []),
    { id: 'workspace-trust-governance', label: 'Workspace trust identity, gates, API, and Control Center', command: process.execPath, args: ['--test', 'tests/workspace-trust-service.test.mjs', 'tests/workspace-trust-gates.test.mjs', 'tests/workspace-trust-http-api.test.mjs', 'tests/workspace-trust-center-ui.test.mjs', 'tests/workspace-trust-app-wiring.test.mjs'], timeoutMs: 3 * 60_000 },
    { id: 'diff-review-governance', label: 'Hunk-level diff review, partial accept/reject, API, and Control Center', command: process.execPath, args: ['--test', 'tests/diff-review-service.test.mjs', 'tests/diff-review-http-api.test.mjs', 'tests/diff-review-center-ui.test.mjs', 'tests/diff-review-app-wiring.test.mjs'], timeoutMs: 3 * 60_000 },
    { id: 'agent-operations-governance', label: 'Model, tool, MCP, capability, and agent operations management', command: process.execPath, args: ['--test', 'tests/agent-operations-service.test.mjs', 'tests/agent-operations-http-api.test.mjs', 'tests/agent-operations-center-ui.test.mjs', 'tests/agent-operations-app-wiring.test.mjs'], timeoutMs: 3 * 60_000 },
    { id: 'context-memory-governance', label: 'Context history, artifact pinning, memory freshness, and Control Center', command: process.execPath, args: ['--test', 'tests/context-memory-center-service.test.mjs', 'tests/context-memory-center-http-api.test.mjs', 'tests/context-memory-center-ui.test.mjs', 'tests/context-memory-center-app-wiring.test.mjs'], timeoutMs: 3 * 60_000 },
    { id: 'trace-evidence-governance', label: 'Trace timeline, receipt graph, failure clusters, exports, and Control Center', command: process.execPath, args: ['--test', 'tests/trace-evidence-center-service.test.mjs', 'tests/trace-evidence-center-http-api.test.mjs', 'tests/trace-evidence-center-ui.test.mjs', 'tests/trace-evidence-center-app-wiring.test.mjs'], timeoutMs: 3 * 60_000 },
    { id: 'repository-discovery-intelligence', label: 'Evidence-bound repository discovery and architecture intelligence', command: process.execPath, args: ['scripts/verify-repository-discovery.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'codebase-knowledge-graph', label: 'Routes, APIs, models, references, calls, history, watcher, regex, and explainable ranking', command: process.execPath, args: ['scripts/verify-codebase-knowledge.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'local-semantic-dependency-intelligence', label: 'Local semantic search, bounded dependency topology, cycles, API, and Control Center', command: process.execPath, args: ['scripts/verify-semantic-dependency.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'local-ast-intelligence', label: 'Vendored compiler AST query, hash-guarded atomic patch, API, and Knowledge Center', command: process.execPath, args: ['scripts/verify-ast-intelligence.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'local-resource-sandbox', label: 'Local CPU, RAM, process, and disk enforcement with durable leases and Sandbox Manager', command: process.execPath, args: ['scripts/verify-local-resource-sandbox.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'local-worktree-handoff', label: 'Authenticated local task transfer and VS Code managed-worktree opening', command: process.execPath, args: ['scripts/verify-local-worktree-handoff.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'code-relationship-intelligence', label: 'Compiler-backed inheritance graph and local issue-to-code indexing', command: process.execPath, args: ['scripts/verify-code-relationships.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'remaining-completion', label: 'Integrated browser, Secrets Manager, Tree-sitter contract, and native sandbox capability gates', command: process.execPath, args: ['scripts/verify-remaining-completion.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'git-completion-governance', label: 'Evidence-bound Git completion, conflict resolution, agent collision maps, and diff review readiness', command: process.execPath, args: ['scripts/verify-git-completion-governance.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'atomic-patch-governance', label: 'All-or-rollback multi-file patches, touched-file formatting, conflict policy, minimal diffs, and change budgets', command: process.execPath, args: ['scripts/verify-atomic-patch-governance.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'command-execution-governance', label: 'Structured shell argv, command risk classification, managed PID servers, approval bundles, and secret-safe guardrails', command: process.execPath, args: ['scripts/verify-command-execution-governance.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'planning-evidence-governance', label: 'Missing-input detection, bounded planning evidence, scope, risks, related tests/config/docs, and revision receipts', command: process.execPath, args: ['scripts/verify-planning-evidence-governance.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'local-operations-human-control', label: 'Evidence-bound image, call graph, Git history, recorded cost, manual control, sandbox lifecycle, hostile-content sanitization, and controlled cache', command: process.execPath, args: ['scripts/verify-local-operations-human-control.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'mission-completion-runtime-readiness', label: 'Ordered architecture stages, bounded task resources, completion workflow, local review, commit permission, and Docker preflight', command: process.execPath, args: ['scripts/verify-mission-completion-runtime-readiness.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'evidence-context-runtime', label: 'Durable evidence graph, five-source RRF retrieval, context leases, counter-evidence, and context-aware recovery', command: process.execPath, args: ['scripts/verify-evidence-context-runtime.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'adaptive-microkernel', label: 'Adaptive profiles, lazy optional modules, event-driven SSE, Lite UI policy, and split optional packs', command: process.execPath, args: ['scripts/verify-adaptive-microkernel.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'adaptive-work-fabric', label: 'Attributed provider/browser admission, shared incremental indexing, and adaptive subagent graph reconciliation', command: process.execPath, args: ['scripts/verify-adaptive-work-fabric.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'adaptive-harness-lab', label: 'Provider-specific harness composition, privacy-bounded failure telemetry, replay-gated promotion, and rollback', command: process.execPath, args: ['scripts/verify-adaptive-harness-lab.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'mission-resource-fabric', label: 'Mission-attributed process resources, protocol-aware provider sessions, incremental intelligence, canaries, browser journeys, hosted lifecycle, and lean UI', command: process.execPath, args: ['scripts/verify-mission-resource-fabric.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'decision-efficiency-loop', label: 'Criterion-bound verified value, privacy-safe decision receipts, and resource-aware efficiency metrics', command: process.execPath, args: ['scripts/verify-decision-efficiency-loop.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'context-engine-v3', label: 'Evidence Cards, utility-per-token selection, counter-evidence, tokenizer adapters, and bounded context escalation', command: process.execPath, args: ['scripts/verify-context-engine-v3.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'repository-intelligence-fabric', label: 'Lazy hybrid retrieval, explicit embedding fallback, quantized Merkle reuse, and cited Repository Digital Twin', command: process.execPath, args: ['scripts/verify-repository-intelligence-fabric.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'repository-truth-plane', label: 'Branch-scoped cited architecture, symbol, runtime maps, staged evidence queries, and paged source zoom', command: process.execPath, args: ['scripts/verify-repository-truth-plane.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'construction-safety-completion', label: 'Contract-first construction, semantic patch safety, independent verification, and causal counterfactual governance', command: process.execPath, args: ['scripts/verify-construction-safety-completion.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'adaptive-learning-trust-fabric', label: 'Feature-conditioned routing, held-out policy evaluation, cohort rollback, verified strategy learning, domain trust, model switching, trajectory calibration, and teacher challenges', command: process.execPath, args: ['scripts/verify-adaptive-learning-trust-fabric.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'local-context-semantic-completion', label: 'Local tokenizer, cache coherence, semantic batching, vector integrity, corruption quarantine, and memory-pressure completion', command: process.execPath, args: ['scripts/verify-local-frontier-completion.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'local-polyglot-evidence-completion', label: 'Cited static, build, test, coverage, runtime, request, event, database, and effect attribution graphs', command: process.execPath, args: ['scripts/verify-local-frontier-completion.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'local-memory-resource-collaboration-completion', label: 'Verified memory actions, user control, causal invalidation, process budgets, resource reuse, reviewer isolation, and coordination metrics', command: process.execPath, args: ['scripts/verify-local-frontier-completion.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'local-product-security-experience-completion', label: 'Artifact journeys, visual oracle, accessibility, failure injection, unified work surface, VS Code evidence, and performance budgets', command: process.execPath, args: ['scripts/verify-local-frontier-completion.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'local-benchmark-completion', label: 'Contamination-locked public and encrypted private local frontier benchmark certification', command: process.execPath, args: ['scripts/verify-local-frontier-completion.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'intelligence-completion-kernel', label: 'Verified context learning, paged vectors, repository enrichment, bounded program analysis, lineage, and patch ablation', command: process.execPath, args: ['scripts/verify-intelligence-completion-kernel.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'verified-mission-runtime', label: 'Verified outcome hierarchy, effect truth, calibrated confidence, semantic progress, resource cost, disk logs, and process cleanup', command: process.execPath, args: ['scripts/verify-verified-mission-runtime.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'polyglot-runtime-intelligence', label: 'Honest language capabilities, pooled LSP contracts, runtime graph evidence, and architecture drift sentinel', command: process.execPath, args: ['scripts/verify-polyglot-runtime-intelligence.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'cognitive-decision-kernel', label: 'Bounded context posterior, hypotheses, information-efficient probes, targeted error attribution, and causal episode gates', command: process.execPath, args: ['scripts/verify-cognitive-decision-kernel.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'long-horizon-construction', label: 'Executable specifications, traceability, invariants, resumable plans, semantic patch gates, and completion proofs', command: process.execPath, args: ['scripts/verify-long-horizon-construction.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'verification-learned-routing', label: 'Risk-adaptive verification, independent review, failure recovery, trajectory calibration, and shadow-only verified-outcome routing', command: process.execPath, args: ['scripts/verify-verification-learned-routing.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'memory-skill-os', label: 'Versioned memory lifecycle, governed consolidation, replay, typed skills, transfer, and stability guards', command: process.execPath, args: ['scripts/verify-memory-skill-resource-os.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'resource-admission-control', label: 'Utility-per-MB resource leases, viability prediction, content-addressed artifacts, and mission-owned cleanup', command: process.execPath, args: ['scripts/verify-memory-skill-resource-os.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'multi-agent-collaboration', label: 'Versioned blackboard, commitments, adaptive topology, trust, credit, and semantic merge governance', command: process.execPath, args: ['scripts/verify-collaboration-experience.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'browser-experience-surface', label: 'Deterministic browser replay, injection defense, review queue, playback, steering, web UI, and VS Code bridge', command: process.execPath, args: ['scripts/verify-collaboration-experience.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'security-resilience-supply-chain', label: 'Typed taint, injection quarantine, supply-chain provenance, exfiltration defense, audit integrity, and adversarial runtime resilience', command: process.execPath, args: ['scripts/verify-security-resilience.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'comparative-certification-harness', label: 'Locked benchmark comparability, contamination control, bounded evidence, statistics, attestation, and honest claim gates', command: process.execPath, args: ['scripts/verify-comparative-certification.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'world-model-portfolio', label: 'Bounded domain world models, foresight economics, counterfactual reliability, calibration, and no-commit gates', command: process.execPath, args: ['scripts/verify-world-model-portfolio.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'developmental-agent-learning', label: 'Verified self-model, tool trust, bounded autotelic curriculum, future-self simulation, and held-out stage gates', command: process.execPath, args: ['scripts/verify-developmental-agent-learning.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'frontier-safety-and-self-healing', label: 'Cross-repository transactions, post-merge survival, bounded self-healing, cultural lineage, and self-improvement constitution', command: process.execPath, args: ['scripts/verify-frontier-safety-self-healing.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'instruction-policy-governance', label: 'Typed instruction scopes, precedence, conflicts, schema, imports, API, and Control Center', command: process.execPath, args: ['scripts/verify-instruction-policy.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'agent-modes-governance', label: 'Canonical agent modes, autonomy boundaries, runtime enforcement, API, and Control Center', command: process.execPath, args: ['scripts/verify-agent-modes.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'context-orchestration-governance', label: 'Context priority, compaction, freshness, accounting, budgets, permissions, checkpoints, paging, API, and Control Center', command: process.execPath, args: ['scripts/verify-context-orchestration.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'mission-state-progress-governance', label: 'Mission identity, criteria, hypotheses, tests, cost, sandbox, approvals, subagents, and actual progress', command: process.execPath, args: ['scripts/verify-mission-state-progress.mjs', '.'], timeoutMs: 5 * 60_000 },
    { id: 'node-suite', label: `${identity.product} Node test suite`, command: 'npm', args: ['test'], timeoutMs: 20 * 60_000 },
    { id: 'node-syntax', label: 'Application syntax validation', command: process.execPath, args: ['--check', 'src/app.mjs'], timeoutMs: 60_000 },
    { id: 'runtime-smoke', label: 'Authenticated loopback runtime smoke', command: 'npm', args: ['run', 'smoke'], timeoutMs: 3 * 60_000 },
    { id: 'eval-suite', label: 'Deterministic evaluation suite', command: 'npm', args: ['run', 'eval'], timeoutMs: 3 * 60_000 },
    { id: 'vscode-build', label: 'VS Code source build and validation', command: 'npm', args: ['run', 'build:vscode'], timeoutMs: 3 * 60_000 },
    { id: 'go-modules', label: 'Native Go module tests', command: 'npm', args: ['run', 'test:go'], env: goEnv, timeoutMs: 10 * 60_000 },
    { id: 'python-sdk', label: 'Python SDK tests', command: py, args: ['-m', 'unittest', 'discover', '-s', 'sdk/python/tests', '-v'], env: { PYTHONPATH: path.join(root, 'sdk', 'python') }, timeoutMs: 3 * 60_000 },
    { id: 'forgeos-validate', label: 'ForgeOS full validation', command: 'npm', args: ['run', 'validate'], cwd: path.relative(root, forgeRoot), timeoutMs: 20 * 60_000 },
    { id: 'forgeos-smoke', label: 'ForgeOS smoke suite', command: 'npm', args: ['run', 'smoke'], cwd: path.relative(root, forgeRoot), timeoutMs: 3 * 60_000 },
    { id: 'forgeos-adapter-tck', label: 'ForgeOS adapter conformance kit', command: 'npm', args: ['run', 'adapter:tck'], cwd: path.relative(root, forgeRoot), env: { FORGEOS_ADAPTER_TCK_OUTPUT: path.join(root, 'release', 'forgeos', 'adapter-tck.json') }, timeoutMs: 5 * 60_000 },
    { id: 'forgeos-v06-audit', label: 'ForgeOS 0.6 audit', command: 'npm', args: ['run', 'v06:audit'], cwd: path.relative(root, forgeRoot), timeoutMs: 5 * 60_000 },
    { id: 'forgeos-certification', label: 'ForgeOS skill certification audit', command: 'npm', args: ['run', 'skills:certification-audit'], cwd: path.relative(root, forgeRoot), timeoutMs: 5 * 60_000 },
    { id: 'forgeos-mutation-critical', label: 'ForgeOS critical mutation checks', command: 'npm', args: ['run', 'test:mutation-critical'], cwd: path.relative(root, forgeRoot), timeoutMs: 10 * 60_000 },
    { id: 'feature-audit', label: 'Item-level 1,150-feature frontier audit', command: process.execPath, args: ['scripts/generate-frontier-feature-audit.mjs', '.', String(version)], timeoutMs: 3 * 60_000 },
    { id: 'remaining-gaps-report', label: 'Complete report of every partial, external, and missing requirement', command: process.execPath, args: ['scripts/generate-remaining-gaps-report.mjs', 'verify', '.'], timeoutMs: 3 * 60_000 },
    { id: 'nolane-requirement-registry', label: 'Nolane Agent named acceptance requirement registry and NolaneNative transformation ledger', command: process.execPath, args: ['scripts/generate-nolane-program.mjs'], timeoutMs: 5 * 60_000 },
    { id: 'nolane-remaining-gaps-report', label: 'Complete Nolane acceptance-ledger gaps report', command: process.execPath, args: ['scripts/generate-remaining-gaps-report.mjs', 'verify', '.'], timeoutMs: 3 * 60_000 },
    { id: 'nolane-evidence-freshness', label: 'Nolane acceptance evidence path and SHA-256 freshness', command: process.execPath, args: ['scripts/verify-nolane-evidence-freshness.mjs'], timeoutMs: 3 * 60_000 },
    { id: 'nolane-evidence-quality', label: 'Nolane observable behavior, wiring status, and evidence concentration policy', command: process.execPath, args: ['scripts/verify-nolane-evidence-quality.mjs'], timeoutMs: 3 * 60_000 },
    { id: 'nolane-ui-capability-audit', label: 'Nolane UI capability inventory coverage', command: process.execPath, args: ['scripts/audit-ui-capabilities.mjs'], timeoutMs: 3 * 60_000 },
    { id: 'small-model-foundation', label: 'Nolane small-model foundation behavior and authenticated HTTP wiring', command: process.execPath, args: ['--test', 'tests/small-model-trajectory-lab.test.mjs', 'tests/small-model-verifier-mesh.test.mjs', 'tests/small-model-specialist-fabric.test.mjs', 'tests/small-model-adaptive-compute.test.mjs', 'tests/small-model-foundation-http.test.mjs'], timeoutMs: 5 * 60_000 },
    { id: 'alpha4-distillation-verification', label: 'Alpha.4 distillation orchestration, hidden verification and verifier red-team', command: process.execPath, args: ['--test', 'tests/small-model-distillation-orchestrator.test.mjs', 'tests/small-model-hidden-verification.test.mjs'], timeoutMs: 5 * 60_000 },
    { id: 'alpha4-recursive-symbolic', label: 'Alpha.4 fixed-memory recursive policy and symbolic solver compiler', command: process.execPath, args: ['--test', 'tests/small-model-recursive-policy.test.mjs', 'tests/small-model-symbolic-solver.test.mjs'], timeoutMs: 5 * 60_000 },
    { id: 'alpha4-plasticity-curriculum', label: 'Alpha.4 bounded plasticity and reproducible curriculum factory', command: process.execPath, args: ['--test', 'tests/small-model-plasticity-plane.test.mjs', 'tests/small-model-curriculum-factory.test.mjs'], timeoutMs: 5 * 60_000 },
    { id: 'alpha4-specialist-compute', label: 'Alpha.4 specialist trust, shared schemas and compute calibration', command: process.execPath, args: ['--test', 'tests/small-model-specialist-alpha4.test.mjs', 'tests/small-model-compute-calibration.test.mjs'], timeoutMs: 5 * 60_000 },
    { id: 'alpha4-operational-boundaries', label: 'Alpha.4 Nolane-native CLI, secrets, operational boundaries, dependency preflight and behavior contracts', command: process.execPath, args: ['--test', 'tests/client-sdk-cli.test.mjs', 'tests/secret-access-service.test.mjs', 'tests/nolane-native-operational-boundaries.test.mjs', 'tests/nolane-native-differential-contract.test.mjs'], timeoutMs: 5 * 60_000 },
    { id: 'alpha4-http-control-plane', label: 'Alpha.4 authenticated HTTP wiring, Control Plane evidence and release non-claims', command: process.execPath, args: ['--test', 'tests/alpha4-foundation-http.test.mjs', 'tests/ui-v3-control-plane-domains.test.mjs', 'tests/nolane-alpha4-release-docs.test.mjs'], timeoutMs: 5 * 60_000 },
    { id: 'alpha5-scientific-benchmarks', label: 'Alpha.5 matched-budget, quantization, OOD and same-quality cost benchmark gates', command: process.execPath, args: ['--test', 'tests/small-model-scientific-benchmark.test.mjs'], timeoutMs: 5 * 60_000 },
    { id: 'alpha5-symbolic-constraints', label: 'Alpha.5 token-aware codemod, finite-domain SMT and bounded Datalog behavior', command: process.execPath, args: ['--test', 'tests/small-model-symbolic-alpha5.test.mjs'], timeoutMs: 5 * 60_000 },
    { id: 'alpha5-specialist-plasticity', label: 'Alpha.5 lazy specialist artifacts, policy distillation, learned adaptation and latent memory routing', command: process.execPath, args: ['--test', 'tests/small-model-specialist-alpha5.test.mjs', 'tests/small-model-plasticity-alpha5.test.mjs'], timeoutMs: 5 * 60_000 },
    { id: 'alpha5-native-capability-pack', label: 'Alpha.5 Nolane-native web, notebook, memory, TUI, media and audio replacements', command: process.execPath, args: ['--test', 'tests/nolane-native-capability-pack.test.mjs'], timeoutMs: 5 * 60_000 },
    { id: 'alpha5-brand-ui-static-quality', label: 'Alpha.5 active-brand and static UI quality certification', command: process.execPath, args: ['--test', 'tests/brand-migration-alpha5.test.mjs', 'tests/ui-quality-alpha5.test.mjs'], timeoutMs: 5 * 60_000 },
    { id: 'alpha5-production-wiring', label: 'Alpha.5 authenticated production wiring, Control Plane evidence and release non-claims', command: process.execPath, args: ['--test', 'tests/alpha5-production-wiring.test.mjs', 'tests/ui-v3-control-plane-domains.test.mjs', 'tests/nolane-alpha5-release-docs.test.mjs'], timeoutMs: 5 * 60_000 },
    { id: 'self-benchmark', label: 'Non-comparative benchmark smoke', command: 'npm', args: ['run', 'benchmark:self'], timeoutMs: 3 * 60_000 },
    { id: 'self-benchmark-claim-gate', label: 'Benchmark comparative-claim lock', command: process.execPath, args: ['scripts/verify-self-benchmark.mjs', 'release/benchmark-self-smoke'], timeoutMs: 60_000 },
    { id: 'project-manifest', label: 'Project manifest generation', command: process.execPath, args: ['scripts/generate-manifest.mjs', '.', `release/project-manifest-${version}.json`], timeoutMs: 3 * 60_000 },
    { id: 'windows-bootstrap', label: 'Windows x64 bootstrap and update payload', command: 'bash', args: ['scripts/build-windows.sh', `${releaseRoot}-electron-windows-x64`], env: goEnv, timeoutMs: 15 * 60_000 },
    { id: 'release-artifacts', label: 'Source and IDE release archives', command: process.execPath, args: ['scripts/package-release-artifacts.mjs', '--version', String(version)], timeoutMs: 10 * 60_000 },
    { id: 'published-source-clean-room', label: 'Exact published source ZIP clean-room certification without Git metadata', command: process.execPath, args: ['scripts/certify-published-source.mjs', '.', String(version)], timeoutMs: 25 * 60_000 },
    { id: 'fresh-source-reconstruction', label: 'Fresh source archive reconstruction', command: process.execPath, args: ['scripts/verify-source-reconstruction.mjs', '.', String(version)], timeoutMs: 15 * 60_000 },
    { id: 'archive-integrity', label: 'Release archive and checksum verification', command: process.execPath, args: ['scripts/verify-release-artifacts.mjs', '--version', String(version)], timeoutMs: 10 * 60_000 },
  ];
  const major = Number.parseInt(String(version).split('.')[0], 10);
  if (Number.isFinite(major) && (major >= 5 || currentReleaseGateSet)) {
    const wrapRetention = (gate, gateArgs = ['{root}']) => {
      const verifierScript = gate.args?.[0];
      if (!String(verifierScript ?? '').startsWith('scripts/')) throw new Error(`Legacy retention gate ${gate.id} does not use a verifier script`);
      return {
        ...gate,
        label: `${gate.label} [4.0.0 retention]`,
        command: process.execPath,
        args: ['scripts/run-legacy-retention-gate.mjs', verifierScript, '.', '4.0.0', ...gateArgs],
      };
    };
    const start = gates.findIndex((gate) => gate.id === 'repository-discovery-intelligence');
    const end = gates.findIndex((gate) => gate.id === 'mission-state-progress-governance');
    if (start < 0 || end < start) throw new Error('Legacy frontier retention gate range is missing');
    for (let index = start; index <= end; index += 1) gates[index] = wrapRetention(gates[index]);
    const auditIndex = gates.findIndex((gate) => gate.id === 'feature-audit');
    const gapsIndex = gates.findIndex((gate) => gate.id === 'remaining-gaps-report');
    gates[auditIndex] = wrapRetention(gates[auditIndex], ['{root}', '{version}']);
    gates[gapsIndex] = wrapRetention(gates[gapsIndex], ['verify', '{root}']);
  }
  return gates.map(validateGate);
}

function markdown(report) {
  const rows = report.gates.map((gate) => `| ${gate.id} | ${gate.required ? 'required' : 'optional'} | ${gate.status} | ${gate.exitCode} | ${gate.durationMs} | \`${gate.receiptSha256}\` |`).join('\n');
  return `# ${report.product} ${report.version} Full Release Matrix\n\n- Status: **${report.status}**\n- Commit: \`${report.commit}\`\n- Required gates: ${report.requiredPassed}/${report.requiredTotal} passed\n- Platform: ${report.environment.platform}/${report.environment.arch}\n- Node: ${report.environment.node}\n- Started: ${report.startedAt}\n- Finished: ${report.finishedAt}\n\n| Gate | Class | Status | Exit | Duration ms | Receipt |\n|---|---|---:|---:|---:|---|\n${rows}\n`;
}

export async function runFullReleaseMatrix({
  rootDirectory = process.cwd(), outputDirectory = 'release/matrix', version, commit,
  gates = defaultReleaseGates({ rootDirectory, version }), executor = null,
  now = () => new Date(), signal = null, onGateStart = null, onGateFinish = null,
} = {}) {
  if (!version) throw new TypeError('Release matrix version is required');
  if (!/^[a-f0-9]{40,64}$/i.test(String(commit ?? ''))) throw new TypeError('Release matrix commit must be a Git object id');
  const root = path.resolve(rootDirectory);
  const identity = releaseIdentity(root);
  const output = path.resolve(root, outputDirectory);
  const logs = path.join(output, 'logs');
  await mkdir(logs, { recursive: true });
  const scanner = new SecretScanner({ maxBytes: MAX_CAPTURE_BYTES });
  const startedAt = now().toISOString();
  const results = [];
  for (const raw of gates) {
    const gate = validateGate(raw);
    await onGateStart?.(gate);
    const executed = await (executor ? executor(gate) : executeReleaseGate(gate, { rootDirectory: root, signal }));
    const stdout = safeText(executed.stdout, scanner);
    const stderr = safeText(executed.stderr, scanner);
    const expectationFailed = gate.expectStdoutEmpty && stdout.trim().length > 0;
    const status = executed.exitCode === 0 && !executed.timedOut && !executed.spawnError && !expectationFailed ? 'pass' : 'fail';
    const logText = [
      `gate=${gate.id}`,
      `command=${gate.command} ${gate.args.join(' ')}`,
      `cwd=${gate.cwd}`,
      `status=${status}`,
      `exitCode=${executed.exitCode}`,
      `durationMs=${executed.durationMs}`,
      '', '--- stdout ---', stdout, '', '--- stderr ---', stderr,
      executed.spawnError ? `\nspawnError=${safeText(executed.spawnError, scanner)}` : '',
    ].join('\n');
    await writeFile(path.join(logs, `${gate.id}.log`), logText, { mode: 0o600 });
    const base = {
      schema: 'forge.release-gate-result.v1', id: gate.id, label: gate.label,
      required: gate.required, status, command: gate.command, args: gate.args, cwd: gate.cwd,
      exitCode: Number(executed.exitCode), signal: executed.signal ?? null,
      durationMs: Number(executed.durationMs ?? 0), timedOut: executed.timedOut === true,
      outputTruncated: executed.outputTruncated === true,
      stdoutSha256: canonicalSha256(stdout), stderrSha256: canonicalSha256(stderr),
      logPath: `logs/${gate.id}.log`,
    };
    const result = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
    results.push(result);
    await onGateFinish?.(result);
  }
  const required = results.filter((gate) => gate.required);
  const reportBase = {
    schema: identity.schema, product: identity.product, version: String(version),
    commit: String(commit), status: required.every((gate) => gate.status === 'pass') ? 'pass' : 'fail',
    startedAt, finishedAt: now().toISOString(), requiredPassed: required.filter((gate) => gate.status === 'pass').length,
    requiredTotal: required.length,
    environment: { platform: process.platform, arch: process.arch, node: process.version },
    gates: results,
  };
  const report = Object.freeze({ ...reportBase, receiptSha256: canonicalSha256(reportBase) });
  await writeFile(path.join(output, 'full-release-matrix.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o644 });
  await writeFile(path.join(output, 'full-release-matrix.md'), markdown(report), { mode: 0o644 });
  return report;
}
