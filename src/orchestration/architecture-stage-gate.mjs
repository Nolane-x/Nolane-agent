import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const REASONING_ROLES = new Set(['coordinator', 'scout', 'reviewer']);
const EXECUTION_ROLES = new Set(['builder', 'integrator']);
const DEFAULT_LIMITS = Object.freeze({
  maxTurns: 24,
  maxToolCalls: 64,
  maxEstimatedTokens: 240_000,
  maxElapsedMs: 20 * 60_000,
});

function positive(value, fallback, label) {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(result) || result <= 0) throw new TypeError(`${label} must be a positive number`);
  return Math.floor(result);
}

export function buildTaskGovernanceEnvelope({ role, resourceLimits = {} } = {}) {
  const normalizedRole = String(role ?? '').trim();
  if (!REASONING_ROLES.has(normalizedRole) && !EXECUTION_ROLES.has(normalizedRole)) throw new TypeError(`Unknown task role: ${normalizedRole}`);
  const executionClass = EXECUTION_ROLES.has(normalizedRole) ? 'execution' : 'reasoning';
  const limits = Object.freeze({
    maxTurns: positive(resourceLimits.maxTurns, DEFAULT_LIMITS.maxTurns, 'maxTurns'),
    maxToolCalls: positive(resourceLimits.maxToolCalls, DEFAULT_LIMITS.maxToolCalls, 'maxToolCalls'),
    maxEstimatedTokens: positive(resourceLimits.maxEstimatedTokens, DEFAULT_LIMITS.maxEstimatedTokens, 'maxEstimatedTokens'),
    maxElapsedMs: positive(resourceLimits.maxElapsedMs, DEFAULT_LIMITS.maxElapsedMs, 'maxElapsedMs'),
  });
  const base = Object.freeze({
    schema: 'forge.task-governance-envelope.v1',
    role: normalizedRole,
    executionClass,
    mutationAllowed: executionClass === 'execution',
    reasoningSeparated: true,
    resourceLimits: limits,
  });
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function json(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; }
}

export class ArchitectureStageGate {
  constructor({ root = process.cwd() } = {}) { this.root = path.resolve(root); }

  async inspect() {
    const packageJson = await json(path.join(this.root, 'package.json'));
    const version = String(packageJson?.version ?? 'unknown');
    const coreFiles = [
      path.join(this.root, 'src', 'app.mjs'),
      (await exists(path.join(this.root, 'src', 'agent', 'agent-loop.mjs')))
        ? path.join(this.root, 'src', 'agent', 'agent-loop.mjs')
        : path.join(this.root, 'src', 'agent-loop.mjs'),
      path.join(this.root, 'src', 'orchestration', 'task-graph.mjs'),
    ];
    const coreEvidence = await Promise.all(coreFiles.map(exists));
    const coreReady = Boolean(packageJson && coreEvidence.every(Boolean));

    const extensionPackage = await json(path.join(this.root, 'extensions', 'vscode', 'package.json'));
    const ideEvidence = Boolean(extensionPackage && String(extensionPackage.version ?? '') === version);
    const ideReady = coreReady && ideEvidence;

    const desktopEvidence = await exists(path.join(this.root, 'desktop', 'electron-main.mjs'));
    const multiAgentEvidence = await exists(path.join(this.root, 'src', 'orchestration', 'task-graph.mjs'));
    const desktopReady = ideReady && desktopEvidence && multiAgentEvidence;

    const cloudEvidence = await exists(path.join(this.root, 'src', 'cloud', 'cloud-sandbox-service.mjs'));
    const cloudReady = desktopReady && cloudEvidence;

    const stages = Object.freeze([
      Object.freeze({ id: 'core', ready: coreReady, prerequisite: null, evidence: Object.freeze(coreFiles.map((file, index) => ({ file: path.relative(this.root, file), present: coreEvidence[index] }))) }),
      Object.freeze({ id: 'ide', ready: ideReady, prerequisite: 'core', evidence: Object.freeze([{ file: 'extensions/vscode/package.json', present: ideEvidence, version: extensionPackage?.version ?? null }]) }),
      Object.freeze({ id: 'desktop', ready: desktopReady, prerequisite: 'ide', evidence: Object.freeze([{ file: 'desktop/electron-main.mjs', present: desktopEvidence }, { file: 'src/orchestration/task-graph.mjs', present: multiAgentEvidence }]) }),
      Object.freeze({ id: 'cloud', ready: cloudReady, prerequisite: 'desktop', evidence: Object.freeze([{ file: 'src/cloud/cloud-sandbox-service.mjs', present: cloudEvidence }]) }),
    ]);
    const base = Object.freeze({
      schema: 'forge.architecture-stage-readiness.v1',
      version,
      status: coreReady ? 'pass' : 'fail',
      stages,
      cloudOperational: false,
      cloudClaim: 'eligible-after-local-stages-only',
      reasoningExecutionSeparated: true,
      extensionPoint: 'stage-evidence-provider-v1',
    });
    return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
