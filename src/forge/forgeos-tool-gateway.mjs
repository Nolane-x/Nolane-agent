import { randomUUID } from 'node:crypto';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { redactSecrets } from '../security/redaction.mjs';

const object = (properties = {}, required = []) => Object.freeze({
  type: 'object',
  additionalProperties: false,
  required,
  properties,
});

const string = (options = {}) => Object.freeze({ type: 'string', ...options });
const array = (items, options = {}) => Object.freeze({ type: 'array', items, ...options });

const READ_ONLY_SCHEMAS = Object.freeze([
  Object.freeze({ type: 'function', function: Object.freeze({ name: 'forge.status', description: 'Inspect the synchronized ForgeOS runtime, evidence benchmarks, universal lanes, and remote sandbox readiness.', parameters: object() }) }),
  Object.freeze({ type: 'function', function: Object.freeze({ name: 'forge.lanes.list', description: 'List the 12 governed universal work lanes and their truthful execution boundaries.', parameters: object() }) }),
  Object.freeze({ type: 'function', function: Object.freeze({ name: 'forge.skills.route', description: 'Route an intent through ForgeOS outcome retrieval, anti-triggers, policy filters, and provider resolution. This returns a frozen RoutePlan and does not execute it.', parameters: object({
    query: string({ minLength: 3, maxLength: 20_000 }),
    domains: array(string({ minLength: 1, maxLength: 120 }), { maxItems: 32 }),
    taskClass: string({ maxLength: 120 }),
    targetOutcomeIds: array(string({ minLength: 1, maxLength: 160 }), { maxItems: 64 }),
    maxOutcomes: Object.freeze({ type: 'integer', minimum: 1, maximum: 32 }),
    model: string({ maxLength: 120 }),
    tools: array(string({ minLength: 1, maxLength: 160 }), { maxItems: 128 }),
    assurance: string({ enum: ['A0', 'A1', 'A2', 'A3'] }),
    allowExternal: Object.freeze({ type: 'boolean' }),
    operation: string({ maxLength: 120 }),
    routeBudgetTokens: Object.freeze({ type: 'integer', minimum: 128, maximum: 100_000 }),
  }, ['query']) }) }),
  Object.freeze({ type: 'function', function: Object.freeze({ name: 'forge.context.compile', description: 'Route the task, materialize only required skill sections, and compile one globally budgeted context pack with omission receipts.', parameters: object({
    query: string({ minLength: 3, maxLength: 20_000 }),
    model: string({ maxLength: 120 }),
    maxSkills: Object.freeze({ type: 'integer', minimum: 1, maximum: 8 }),
    skillHardTokens: Object.freeze({ type: 'integer', minimum: 128, maximum: 32_000 }),
    code: array(Object.freeze({ type: 'object', additionalProperties: true }), { maxItems: 256 }),
    artifacts: array(Object.freeze({ type: 'object', additionalProperties: true }), { maxItems: 128 }),
    memory: array(Object.freeze({ type: 'object', additionalProperties: true }), { maxItems: 128 }),
    toolOutput: array(Object.freeze({ type: 'object', additionalProperties: true }), { maxItems: 128 }),
    references: array(Object.freeze({ type: 'object', additionalProperties: true }), { maxItems: 128 }),
  }, ['query']) }) }),
  Object.freeze({ type: 'function', function: Object.freeze({ name: 'forge.execution.compile', description: 'Compile a deterministic ForgeOS execution graph for bounded work units. This plans execution but does not run commands.', parameters: object({
    skillId: string({ minLength: 3, maxLength: 120 }),
    workUnits: array(object({ unitId: string({ minLength: 1, maxLength: 120 }), files: array(string({ maxLength: 2_000 }), { maxItems: 128 }) }, ['unitId']), { minItems: 1, maxItems: 64 }),
    retryBudget: Object.freeze({ type: 'integer', minimum: 0, maximum: 8 }),
  }, ['skillId', 'workUnits']) }) }),
  Object.freeze({ type: 'function', function: Object.freeze({ name: 'forge.review.scope', description: 'Compile a complete review scope for changed files without silently omitting them.', parameters: object({
    changedFiles: array(string({ minLength: 1, maxLength: 2_000 }), { minItems: 1, maxItems: 512 }),
    policy: object({ excludeGenerated: Object.freeze({ type: 'boolean' }), excludeDeleted: Object.freeze({ type: 'boolean' }) }),
  }, ['changedFiles']) }) }),
  Object.freeze({ type: 'function', function: Object.freeze({ name: 'forge.context.work_units', description: 'Compile isolated, budgeted context packs for work units and record omissions.', parameters: object({
    model: string({ maxLength: 120 }),
    hardInputLimit: Object.freeze({ type: 'integer', minimum: 256, maximum: 2_000_000 }),
    outputReserve: Object.freeze({ type: 'integer', minimum: 0, maximum: 1_000_000 }),
    safetyReserve: Object.freeze({ type: 'integer', minimum: 0, maximum: 1_000_000 }),
    shared: Object.freeze({ type: 'object', additionalProperties: true }),
    workUnits: array(Object.freeze({ type: 'object', additionalProperties: true }), { minItems: 1, maxItems: 64 }),
  }, ['workUnits']) }) }),
  Object.freeze({ type: 'function', function: Object.freeze({ name: 'forge.harness.plan', description: 'Compile a truthful host harness plan and capability boundary.', parameters: object({
    host: string({ minLength: 1, maxLength: 120 }),
    profile: Object.freeze({ type: 'object', additionalProperties: true }),
    hostCapabilities: Object.freeze({ type: 'object', additionalProperties: true }),
  }, ['host']) }) }),
  Object.freeze({ type: 'function', function: Object.freeze({ name: 'forge.harness.capabilities', description: 'Compile a host capability matrix that marks every ForgeOS harness feature supported or unsupported instead of claiming false parity.', parameters: object({
    host: string({ minLength: 1, maxLength: 120 }),
    hostCapabilities: Object.freeze({ type: 'object', additionalProperties: { type: 'boolean' } }),
  }, ['host']) }) }),
  Object.freeze({ type: 'function', function: Object.freeze({ name: 'forge.security.scan_surface', description: 'Scan untrusted agent instructions, hooks, MCP servers, commands, and permissions for security boundary violations.', parameters: object({
    surface: Object.freeze({ type: 'object', additionalProperties: true }),
  }, ['surface']) }) }),
  Object.freeze({ type: 'function', function: Object.freeze({ name: 'forge.skill.assess_intake', description: 'Assess an uploaded skill bundle for provenance, license, injection, unsafe content, duplicates, and quarantine status. This never activates the skill.', parameters: object({
    source: Object.freeze({ type: 'object', additionalProperties: false, required: ['sourceId', 'sourceCoordinate', 'snapshotSha256', 'license'], properties: {
      sourceId: string({ minLength: 3, maxLength: 120 }),
      sourceCoordinate: string({ minLength: 8, maxLength: 2_000 }),
      snapshotSha256: string({ pattern: '^[a-fA-F0-9]{64}$' }),
      license: string({ minLength: 1, maxLength: 120 }),
      permissions: array(string({ maxLength: 120 }), { maxItems: 32 }),
    } }),
    files: array(Object.freeze({ type: 'object', additionalProperties: false, required: ['path', 'content'], properties: { path: string({ minLength: 1, maxLength: 2_000 }), content: string({ minLength: 1, maxLength: 1_000_000 }) } }), { minItems: 1, maxItems: 32 }),
    existingContentDigests: array(string({ pattern: '^[a-fA-F0-9]{64}$' }), { maxItems: 2_000 }),
  }, ['source', 'files']) }) }),
  Object.freeze({ type: 'function', function: Object.freeze({ name: 'forge.sandbox.probe', description: 'Inspect whether a compatible HTTPS remote microVM provider is configured and ready. This does not execute anything.', parameters: object() }) }),
]);

const REMOTE_RUN_SCHEMA = Object.freeze({ type: 'function', function: Object.freeze({
  name: 'forge.sandbox.run',
  description: 'Run one bounded command through a configured remote microVM provider using a one-time human approval and a signed request-bound receipt.',
  parameters: object({
    approvalId: string({ minLength: 3, maxLength: 160 }),
    command: string({ minLength: 1, maxLength: 512 }),
    args: array(string({ maxLength: 4_096 }), { maxItems: 64 }),
    cwd: string({ minLength: 1, maxLength: 2_000 }),
    timeoutMs: Object.freeze({ type: 'integer', minimum: 1, maximum: 3_600_000 }),
    input: Object.freeze({ type: 'object', additionalProperties: true }),
  }, ['approvalId', 'command', 'args', 'timeoutMs']),
}) });

function capabilitySet(task) {
  return new Set(Array.isArray(task?.metadata?.forgeOsCapabilities) ? task.metadata.forgeOsCapabilities.map(String) : []);
}

function approvalFor(task) {
  const value = task?.metadata?.remoteSandboxApproval;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const id = String(value.id ?? '').trim();
  const expiresAt = Date.parse(value.expiresAt);
  if (!id || !Number.isFinite(expiresAt)) return null;
  return Object.freeze({ id, expiresAt });
}

export class ForgeOsToolGateway {
  constructor({ bridge, now = () => Date.now() } = {}) {
    if (!bridge?.runtimeStatus || !bridge?.listUniversalLanes || !bridge?.route || !bridge?.buildContextPack || !bridge?.compileHarnessCapabilityMatrix || !bridge?.runRemoteSandbox) throw new TypeError('ForgeOsToolGateway bridge is required');
    this.bridge = bridge;
    this.now = now;
    this.usedApprovals = new Set();
  }

  #remoteAuthorization(task, approvalId = null) {
    if (!capabilitySet(task).has('remote-sandbox.run')) return { allow: false, reason: 'remote sandbox execution is not authorized for this task' };
    const approval = approvalFor(task);
    if (!approval) return { allow: false, reason: 'remote sandbox approval is missing' };
    if (approval.expiresAt <= this.now()) return { allow: false, reason: 'remote sandbox approval is expired' };
    if (approvalId !== null && approval.id !== String(approvalId)) return { allow: false, reason: 'remote sandbox approval does not match the task grant' };
    if (this.usedApprovals.has(approval.id)) return { allow: false, reason: 'remote sandbox approval was already used' };
    return { allow: true, approval };
  }

  schemasForTask(task) {
    const remote = this.#remoteAuthorization(task);
    return remote.allow ? Object.freeze([...READ_ONLY_SCHEMAS, REMOTE_RUN_SCHEMA]) : READ_ONLY_SCHEMAS;
  }

  async execute(task, name, args = {}, context = {}) {
    const tool = String(name);
    const startedAt = new Date(this.now()).toISOString();
    const started = this.now();
    let output;

    if (tool === 'forge.status') output = await this.bridge.runtimeStatus();
    else if (tool === 'forge.lanes.list') output = await this.bridge.listUniversalLanes();
    else if (tool === 'forge.skills.route') output = await this.bridge.route(args);
    else if (tool === 'forge.context.compile') output = await this.bridge.buildContextPack(args);
    else if (tool === 'forge.execution.compile') output = await this.bridge.compileExecutionGraph(args);
    else if (tool === 'forge.review.scope') output = this.bridge.compileReviewScope(args);
    else if (tool === 'forge.context.work_units') output = await this.bridge.compileWorkUnitContexts(args);
    else if (tool === 'forge.harness.plan') output = this.bridge.compileHarnessProfile(args);
    else if (tool === 'forge.harness.capabilities') output = this.bridge.compileHarnessCapabilityMatrix(args);
    else if (tool === 'forge.security.scan_surface') output = this.bridge.scanAgentSurface(args.surface);
    else if (tool === 'forge.skill.assess_intake') output = this.bridge.assessSkillIntake(args);
    else if (tool === 'forge.sandbox.probe') output = await this.bridge.probeRemoteSandbox();
    else if (tool === 'forge.sandbox.run') {
      const auth = this.#remoteAuthorization(task, args.approvalId);
      if (!auth.allow) throw new Error(auth.reason);
      this.usedApprovals.add(auth.approval.id);
      output = await this.bridge.runRemoteSandbox({
        command: args.command,
        args: args.args,
        cwd: args.cwd ?? '.',
        timeoutMs: args.timeoutMs,
        input: args.input ?? {},
      });
    } else throw new Error(`Unsupported ForgeOS tool: ${tool}`);

    const safeOutput = redactSecrets(output, { secretValues: context.secretValues ?? [] });
    const finishedAt = new Date(this.now()).toISOString();
    const refs = redactSecrets({ ...(context.refs ?? {}), projectId: task?.projectId ?? null, taskId: task?.id ?? null });
    const safeRequest = redactSecrets({ tool, args }, { secretValues: context.secretValues ?? [] });
    const base = {
      schema: 'forge.forgeos-tool.receipt.v1',
      id: `receipt_${randomUUID().replaceAll('-', '').slice(0, 24)}`,
      tool,
      status: 'pass',
      startedAt,
      finishedAt,
      durationMs: Math.max(0, this.now() - started),
      requestSha256: canonicalSha256(safeRequest),
      outputSha256: canonicalSha256(safeOutput),
      refs,
    };
    const receipt = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
    return Object.freeze({ status: 'pass', output: Object.freeze(safeOutput), receipt });
  }
}
