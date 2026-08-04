import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const RISK_LEVELS = new Set(['low', 'medium', 'high', 'critical']);
const AUTONOMY_LEVELS = new Set(['read-only', 'guided', 'workspace-autopilot', 'sandbox-autopilot']);

function text(value, label, max = 20_000) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required`);
  if (result.length > max) throw new TypeError(`${label} exceeds ${max} characters`);
  return result;
}

function textList(value, label, { min = 0, max = 256 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new TypeError(`${label} must contain between ${min} and ${max} entries`);
  return Object.freeze(value.map((item, index) => text(item, `${label}[${index}]`, 4_000)));
}

function integer(value, label, min, max) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < min || result > max) throw new TypeError(`${label} must be between ${min} and ${max}`);
  return result;
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function measurableObjective(value) {
  const objective = text(value, 'objective', 8_000);
  if (objective.length < 20 || !/(?:\d|below|above|less than|more than|at least|at most|within|without|passes?|complete[sd]?|reduce|increase|remove|add|create|implement|fix|verify)/i.test(objective)) {
    throw new TypeError('objective must be measurable and describe an observable outcome');
  }
  return objective;
}

function successCriteria(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 128) throw new TypeError('successCriteria must contain between 1 and 128 entries');
  const ids = new Set();
  return Object.freeze(value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError(`successCriteria[${index}] must be an object`);
    const id = text(item.id, `successCriteria[${index}].id`, 120);
    if (ids.has(id)) throw new TypeError(`duplicate successCriteria id: ${id}`);
    ids.add(id);
    const verification = item.verification;
    if (!verification || typeof verification !== 'object' || Array.isArray(verification)) throw new TypeError(`successCriteria[${index}].verification is required`);
    const command = text(verification.command, `successCriteria[${index}].verification.command`, 260);
    const args = textList(verification.args ?? [], `successCriteria[${index}].verification.args`, { max: 128 });
    return deepFreeze({ id, description: text(item.description, `successCriteria[${index}].description`, 2_000), verification: { command, args } });
  }));
}

function normalizePathPattern(value, label) {
  const raw = text(value, label, 1_000).replaceAll('\\', '/');
  if (raw.startsWith('/') || /^[A-Za-z]:\//.test(raw) || raw.split('/').includes('..')) throw new TypeError(`${label} must remain workspace-relative`);
  return raw.replace(/^\.\//, '');
}

function scope(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('scope must be an object');
  const allowedPaths = textList(value.allowedPaths ?? [], 'scope.allowedPaths', { min: 1, max: 256 }).map((item, index) => normalizePathPattern(item, `scope.allowedPaths[${index}]`));
  const deniedPaths = textList(value.deniedPaths ?? [], 'scope.deniedPaths', { max: 256 }).map((item, index) => normalizePathPattern(item, `scope.deniedPaths[${index}]`));
  return deepFreeze({ allowedPaths, deniedPaths });
}

function networkPolicy(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('networkPolicy must be an object');
  const mode = String(value.mode ?? 'deny');
  if (!['deny', 'allowlist'].includes(mode)) throw new TypeError('networkPolicy.mode must be deny or allowlist');
  const domains = textList(value.domains ?? [], 'networkPolicy.domains', { max: 256 }).map((domain) => domain.toLowerCase());
  const ports = Object.freeze((value.ports ?? []).map((port, index) => integer(port, `networkPolicy.ports[${index}]`, 1, 65535)));
  if (mode === 'allowlist' && domains.length === 0 && ports.length === 0) throw new TypeError('allowlist networkPolicy requires domains or ports');
  if (mode === 'deny' && (domains.length || ports.length)) throw new TypeError('deny networkPolicy cannot contain allowlist entries');
  return deepFreeze({ mode, domains: [...new Set(domains)], ports: [...new Set(ports)] });
}

function outputContract(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('outputContract must be an object');
  return deepFreeze({
    kind: text(value.kind, 'outputContract.kind', 120),
    requiredArtifacts: textList(value.requiredArtifacts ?? [], 'outputContract.requiredArtifacts', { min: 1, max: 128 }).map((item, index) => normalizePathPattern(item, `outputContract.requiredArtifacts[${index}]`)),
    schema: value.schema == null ? null : text(value.schema, 'outputContract.schema', 4_000),
  });
}

function matchGlob(pattern, candidate) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('**', '\u0000').replaceAll('*', '[^/]*').replaceAll('\u0000', '.*').replaceAll('?', '[^/]');
  return new RegExp(`^${escaped}$`).test(candidate);
}

function actionPath(value) {
  const candidate = String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
  if (!candidate || candidate.startsWith('/') || /^[A-Za-z]:\//.test(candidate) || candidate.split('/').includes('..')) throw new Error('Task action path escapes contract scope');
  return path.posix.normalize(candidate);
}

export function normalizeTaskContract(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('task contract must be an object');
  const autonomy = String(input.autonomy ?? 'guided');
  if (!AUTONOMY_LEVELS.has(autonomy)) throw new TypeError(`unsupported autonomy: ${autonomy}`);
  const riskLevel = String(input.riskLevel ?? 'medium');
  if (!RISK_LEVELS.has(riskLevel)) throw new TypeError(`unsupported riskLevel: ${riskLevel}`);
  const deadline = text(input.deadline, 'deadline', 80);
  if (!Number.isFinite(Date.parse(deadline))) throw new TypeError('deadline must be an ISO-8601 date');
  const base = {
    schema: 'forge.task-contract.v1',
    objective: measurableObjective(input.objective),
    successCriteria: successCriteria(input.successCriteria),
    scope: scope(input.scope),
    allowedCommands: [...new Set(textList(input.allowedCommands ?? [], 'allowedCommands', { min: 1, max: 256 }))],
    networkPolicy: networkPolicy(input.networkPolicy),
    testCriteria: textList(input.testCriteria, 'testCriteria', { min: 1, max: 128 }),
    performanceCriteria: textList(input.performanceCriteria, 'performanceCriteria', { min: 1, max: 128 }),
    securityCriteria: textList(input.securityCriteria, 'securityCriteria', { min: 1, max: 128 }),
    compatibilityCriteria: textList(input.compatibilityCriteria, 'compatibilityCriteria', { min: 1, max: 128 }),
    outputContract: outputContract(input.outputContract),
    allowCommit: input.allowCommit === true,
    allowDeploy: input.allowDeploy === true,
    allowInternet: input.allowInternet === true,
    autonomy,
    tokenBudget: integer(input.tokenBudget, 'tokenBudget', 1, 10_000_000_000),
    deadline: new Date(deadline).toISOString(),
    riskLevel,
    stopConditions: textList(input.stopConditions, 'stopConditions', { min: 1, max: 128 }),
  };
  return deepFreeze({ ...base, contractSha256: canonicalSha256(base) });
}

export function assertTaskActionAllowed(contractInput, action = {}) {
  const contract = contractInput?.schema === 'forge.task-contract.v1' ? contractInput : normalizeTaskContract(contractInput);
  const kind = text(action.kind, 'action.kind', 120);
  if (kind.startsWith('file.')) {
    const candidate = actionPath(action.path);
    if (contract.scope.deniedPaths.some((pattern) => matchGlob(pattern, candidate)) || !contract.scope.allowedPaths.some((pattern) => matchGlob(pattern, candidate))) {
      throw Object.assign(new Error(`Task action expands scope: ${candidate}`), { code: 'TASK_SCOPE_DENIED' });
    }
  }
  if (kind === 'process.run' && !contract.allowedCommands.includes(String(action.command ?? ''))) throw Object.assign(new Error(`Command is outside task contract: ${action.command ?? ''}`), { code: 'TASK_COMMAND_DENIED' });
  if (kind === 'network.request') {
    if (!contract.allowInternet || contract.networkPolicy.mode === 'deny') throw Object.assign(new Error('Network is denied by task contract'), { code: 'TASK_NETWORK_DENIED' });
    const url = new URL(String(action.url ?? ''));
    const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
    const domainAllowed = contract.networkPolicy.domains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
    const portAllowed = contract.networkPolicy.ports.length === 0 || contract.networkPolicy.ports.includes(port);
    if (!domainAllowed || !portAllowed) throw Object.assign(new Error(`Network target is outside task contract: ${url.hostname}:${port}`), { code: 'TASK_NETWORK_DENIED' });
  }
  if (kind === 'git.commit' && !contract.allowCommit) throw Object.assign(new Error('Commit is disabled by task contract'), { code: 'TASK_COMMIT_DENIED' });
  if (kind === 'deploy' && !contract.allowDeploy) throw Object.assign(new Error('Deploy is disabled by task contract'), { code: 'TASK_DEPLOY_DENIED' });
  if (kind === 'output.publish') {
    const artifact = actionPath(action.artifact);
    if (!contract.outputContract.requiredArtifacts.includes(artifact)) throw Object.assign(new Error(`Output is outside task contract: ${artifact}`), { code: 'TASK_OUTPUT_DENIED' });
  }
  return true;
}
