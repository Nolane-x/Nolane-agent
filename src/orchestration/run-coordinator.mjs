import { createEvent } from '../protocol/events.mjs';
import { AUTONOMY_PROFILES } from '../security/autonomy-policy.mjs';
import { redactSecrets } from '../security/redaction.mjs';

function required(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  return text;
}

function uniqueStrings(value, max = 128) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))].slice(0, max);
}

const FORGEOS_CAPABILITIES = new Set(['remote-sandbox.run']);

function forgeOsCapabilities(value) {
  return uniqueStrings(value, 8).filter((item) => FORGEOS_CAPABILITIES.has(item));
}

function remoteSandboxApproval(value) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('remoteSandboxApproval must be an object');
  const id = required(value.id, 'remoteSandboxApproval.id');
  if (id.length > 160) throw new TypeError('remoteSandboxApproval.id is too long');
  const expiresAt = new Date(value.expiresAt);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) throw new TypeError('remoteSandboxApproval.expiresAt must be in the future');
  if (expiresAt.getTime() - Date.now() > 10 * 60_000) throw new TypeError('remoteSandboxApproval may last at most 10 minutes');
  return Object.freeze({ id, expiresAt: expiresAt.toISOString() });
}

function boundedMaxTasks(value) {
  const number = value === undefined ? 32 : Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 128) throw new TypeError('maxTasks must be an integer between 1 and 128');
  return number;
}

function assistantCompletion(result) {
  const count = Number(result?.completedTasks ?? 0);
  return count > 0
    ? `Đã hoàn thành nhiệm vụ và kiểm chứng ${count} bước công việc. Bạn có thể xem kết quả, thay đổi và kiểm thử ở bảng bên phải.`
    : 'Đã hoàn thành nhiệm vụ và vượt qua cổng kiểm chứng.';
}

function failureStage(error) {
  const code = String(error?.code ?? '');
  if (code === 'VERIFICATION_FAILED') return 'verification';
  if (code.startsWith('PROVIDER_') || /provider|model/i.test(String(error?.message ?? ''))) return 'model';
  if (code.startsWith('AUTONOMY_')) return 'permission';
  if (/plan|planner/i.test(String(error?.message ?? ''))) return 'planning';
  return 'execution';
}

function failureCopy(stage, reason) {
  const safeReason = String(reason).slice(0, 700);
  if (stage === 'verification') return `Forge đã dừng ở bước kiểm chứng: ${safeReason} Gửi thêm hướng dẫn hoặc nhấn Thử lại; Forge sẽ tiếp tục từ checkpoint gần nhất.`;
  if (stage === 'model') return `Kết nối AI không thể tiếp tục: ${safeReason} Forge đã giữ nguyên checkpoint để tự tiếp tục sau khi kết nối ổn định.`;
  if (stage === 'permission') return `Forge cần quyền cho một hành động bị khóa: ${safeReason}`;
  return `Forge gặp lỗi ở bước thực hiện: ${safeReason} Trạng thái đã được giữ lại để tiếp tục, không cần làm lại từ đầu.`;
}

export class RunCoordinator {
  constructor({ store, missionRunner, plannerService, autopilot, activityProjection, reviewSummary = null, workspaceService = null, providerReadiness = null, contextHistoryArchive = null, agentModes = null, providerInventory = null } = {}) {
    if (!store?.createMission || !missionRunner?.plan || !plannerService?.plan || !autopilot?.run || !activityProjection?.snapshot) {
      throw new TypeError('RunCoordinator store, missionRunner, plannerService, autopilot, and activityProjection are required');
    }
    this.store = store;
    this.missionRunner = missionRunner;
    this.plannerService = plannerService;
    this.autopilot = autopilot;
    this.activityProjection = activityProjection;
    this.reviewSummary = reviewSummary;
    this.workspaceService = workspaceService;
    this.providerReadiness = providerReadiness;
    this.contextHistoryArchive = contextHistoryArchive;
    this.agentModes = agentModes;
    this.providerInventory = typeof providerInventory === 'function' ? providerInventory : null;
    this.active = new Map();
    this.closed = false;
  }

  #event(type, payload, refs) { return this.store.appendEvent(createEvent(type, payload, refs)); }

  async #archiveConversation(missionId) {
    if (!this.contextHistoryArchive?.archiveConversation) return null;
    const mission = this.store.getMission(missionId);
    if (!mission) return null;
    try {
      const result = await this.contextHistoryArchive.archiveConversation({ projectId: mission.projectId, missionId, sessionId: missionId, messages: this.store.listMessages({ missionId, limit: 5_000 }) });
      this.#event('run.context-history.archived', { created: result.created === true, itemCount: Number(result.itemCount ?? 0), archiveId: result.id ?? null }, { projectId: mission.projectId, missionId });
      return result;
    } catch (error) {
      this.#event('run.context-history.failed', { code: error?.code ?? 'CONTEXT_HISTORY_ARCHIVE_FAILED', error: String(error?.message ?? error).slice(0, 500) }, { projectId: mission.projectId, missionId });
      return null;
    }
  }

  createRun({ projectId, objective, autonomyProfile = undefined, modeId = undefined, modeOverrides = undefined, providerId = 'auto', budgets = undefined, maxTasks = undefined, mcpAllowedTools = [], forgeOsCapabilities: requestedForgeOsCapabilities = [], remoteSandboxApproval: requestedRemoteSandboxApproval = null } = {}) {
    if (this.closed) throw new Error('RunCoordinator is closed');
    const project = this.store.getProject(required(projectId, 'projectId'));
    if (!project) throw new Error(`Unknown project: ${projectId}`);
    const normalizedObjective = required(objective, 'objective');
    const inventory = this.providerInventory ? this.providerInventory() : undefined;
    const inferredMode = modeId ?? (autonomyProfile === 'guided' ? 'edit-approved' : autonomyProfile === 'sandbox-autopilot' ? 'deep' : 'auto-edit');
    const modeResolution = this.agentModes ? this.agentModes.resolve({ modeId: inferredMode, overrides: modeOverrides ?? {}, providers: inventory }) : null;
    const effectiveAutonomyProfile = autonomyProfile ?? modeResolution?.policy?.autonomyProfile ?? 'workspace-autopilot';
    if (modeId && autonomyProfile && autonomyProfile !== modeResolution?.policy?.autonomyProfile) {
      throw Object.assign(new Error('autonomyProfile conflicts with the selected agent mode'), { code: 'AGENT_MODE_AUTONOMY_CONFLICT' });
    }
    if (!Object.hasOwn(AUTONOMY_PROFILES, effectiveAutonomyProfile)) throw new TypeError(`Unknown autonomy profile: ${effectiveAutonomyProfile}`);
    let effectiveProviderId = String(providerId ?? 'auto');
    if (modeResolution?.policy?.localOnly) {
      const localProviders = Array.isArray(inventory) ? inventory.filter((item) => item?.local === true && item?.available !== false && item?.healthy !== false) : [];
      if (effectiveProviderId === 'auto') effectiveProviderId = String(localProviders[0]?.id ?? '');
      if (!localProviders.some((item) => String(item.id) === effectiveProviderId)) throw Object.assign(new Error('Offline mode requires an available local provider'), { code: 'AGENT_MODE_LOCAL_PROVIDER_REQUIRED' });
    }
    const readiness = this.providerReadiness?.readiness?.({ providerId: effectiveProviderId, requiredCapabilities: ['coding', 'governed-actions'] });
    if (readiness && !readiness.ready) {
      throw Object.assign(new Error('Kết nối một AI provider trước khi bắt đầu nhiệm vụ.'), {
        statusCode: 409,
        code: 'provider_setup_required',
        readiness,
      });
    }
    const requestedMaxTasks = maxTasks === undefined ? (modeResolution?.policy?.maxTasks ?? 32) : maxTasks;
    const safeMaxTasks = Math.min(boundedMaxTasks(requestedMaxTasks), modeResolution?.policy?.maxTasks ?? 128);
    const tools = uniqueStrings(mcpAllowedTools);
    const forgeCapabilities = forgeOsCapabilities(requestedForgeOsCapabilities);
    const sandboxApproval = forgeCapabilities.includes('remote-sandbox.run') ? remoteSandboxApproval(requestedRemoteSandboxApproval) : null;
    if (forgeCapabilities.includes('remote-sandbox.run') && !sandboxApproval) throw new TypeError('remote-sandbox.run requires remoteSandboxApproval');
    const grant = this.store.getAutonomyGrant(project.id);
    if (!grant || grant.profile !== effectiveAutonomyProfile) {
      this.store.createAutonomyGrant({
        projectId: project.id,
        profile: effectiveAutonomyProfile,
        actor: 'human:workspace-owner',
        scope: {
          allowedPaths: ['**'],
          deniedPaths: ['.env', '.env.*', '**/*.pem', '**/*.key', '**/*.p12', '**/*.pfx'],
          network: modeResolution?.policy?.networkPolicy?.mode === 'allowlist' || effectiveAutonomyProfile === 'sandbox-autopilot' ? 'allowlisted' : 'deny',
          managedWorktreesOnly: effectiveAutonomyProfile !== 'guided',
        },
      });
    }
    const mission = this.store.createMission({
      projectId: project.id,
      objective: normalizedObjective,
      status: 'planning',
      metadata: {
        autonomyProfile: effectiveAutonomyProfile,
        modeId: modeResolution?.modeId ?? null,
        modePolicy: modeResolution?.policy ?? null,
        modeReceiptSha256: modeResolution?.receiptSha256 ?? null,
        providerId: effectiveProviderId,
        budgets: budgets && typeof budgets === 'object' ? structuredClone(budgets) : null,
        maxTasks: safeMaxTasks,
        mcpAllowedTools: tools,
        forgeOsCapabilities: forgeCapabilities,
        remoteSandboxApproval: sandboxApproval,
        followUps: [],
        dynamicToolDiscovery: true,
        createdFrom: 'simple-autopilot-ui',
      },
    });
    this.store.createMessage({ projectId: project.id, missionId: mission.id, role: 'user', content: normalizedObjective, metadata: { kind: 'objective' } });
    this.#event('run.created', { autonomyProfile: effectiveAutonomyProfile, modeId: modeResolution?.modeId ?? null, providerId: effectiveProviderId }, { projectId: project.id, missionId: mission.id });
    queueMicrotask(() => this.#launch(mission.id));
    return this.snapshot(mission.id);
  }

  #plannerFor(mission) {
    const requestedTools = uniqueStrings(mission.metadata?.mcpAllowedTools);
    const browserAllowedActions = uniqueStrings(mission.metadata?.browserAllowedActions);
    const sharedMetadata = {
      dynamicToolDiscovery: mission.metadata?.dynamicToolDiscovery !== false,
      ...(mission.metadata?.goalId ? { goalId: mission.metadata.goalId, goalAutoApplyPlanPatches: mission.metadata?.goalAutoApplyPlanPatches === true } : {}),
      ...(requestedTools.length ? { mcpAllowedTools: requestedTools } : {}),
      ...(browserAllowedActions.length ? { browserAllowedActions } : {}),
      ...(Array.isArray(mission.metadata?.forgeOsCapabilities) && mission.metadata.forgeOsCapabilities.length ? { forgeOsCapabilities: [...mission.metadata.forgeOsCapabilities] } : {}),
      ...(mission.metadata?.remoteSandboxApproval ? { remoteSandboxApproval: structuredClone(mission.metadata.remoteSandboxApproval) } : {}),
      ...(mission.metadata?.modeId ? { modeId: mission.metadata.modeId } : {}),
      ...(mission.metadata?.modePolicy ? { modePolicy: structuredClone(mission.metadata.modePolicy) } : {}),
      ...(mission.metadata?.modeReceiptSha256 ? { modeReceiptSha256: mission.metadata.modeReceiptSha256 } : {}),
    };
    return async (input) => {
      const plan = await this.plannerService.plan({ ...input, providerId: mission.metadata?.providerId ?? 'auto' });
      if (!Object.keys(sharedMetadata).length) return plan;
      return {
        ...plan,
        tasks: plan.tasks.map((task) => ({ ...task, metadata: { ...(task.metadata ?? {}), ...sharedMetadata } })),
      };
    };
  }

  #launch(missionId) {
    if (this.closed) return Promise.resolve(null);
    const existing = this.active.get(missionId);
    if (existing) return existing.promise;
    const mission = this.store.getMission(missionId);
    if (!mission) throw new Error(`Unknown mission: ${missionId}`);
    const controller = new AbortController();
    const promise = Promise.resolve().then(async () => {
      let current = this.store.getMission(missionId);
      if (current.status === 'planning') {
        this.#event('run.planning.started', {}, { projectId: current.projectId, missionId });
        await this.missionRunner.plan({ missionId, projectId: current.projectId, objective: current.objective, planner: this.#plannerFor(current) });
      }
      current = this.store.getMission(missionId);
      if (current.status !== 'running') return { missionId, status: current.status };
      this.#event('run.autopilot.started', { autonomyProfile: current.metadata?.autonomyProfile ?? 'guided' }, { projectId: current.projectId, missionId });
      const result = await this.autopilot.run({
        missionId,
        providerId: current.metadata?.providerId ?? 'auto',
        workerId: `autopilot-${missionId}`,
        maxTasks: current.metadata?.maxTasks ?? 32,
        budgets: current.metadata?.budgets ?? undefined,
        signal: controller.signal,
      });
      const latest = this.store.getMission(missionId);
      if (latest.status !== 'completed') this.store.updateMission(missionId, { status: 'completed' });
      this.store.createMessage({ projectId: current.projectId, missionId, role: 'assistant', content: assistantCompletion(result), metadata: { kind: 'completion', completedTasks: result.completedTasks ?? 0 } });
      this.#event('run.autopilot.completed', { completedTasks: result.completedTasks ?? 0 }, { projectId: current.projectId, missionId });
      await this.#archiveConversation(missionId);
      return result;
    }).catch(async (error) => {
      const current = this.store.getMission(missionId);
      if (!current) throw error;
      if (['paused', 'stopped'].includes(current.status) || controller.signal.aborted) return { missionId, status: current.status, interrupted: true };
      const reason = redactSecrets(String(error.message ?? error).slice(0, 1_000));
      const stage = failureStage(error);
      const failedTaskId = error?.taskId ? String(error.taskId) : null;
      this.store.updateMission(missionId, { status: 'failed', metadata: { ...current.metadata, failureReason: reason, failureCode: error?.code ?? null, failureStage: stage, failedTaskId } });
      const approvalRequired = error?.code === 'AUTONOMY_APPROVAL_REQUIRED' || error?.code === 'AUTONOMY_HARD_STOP';
      const content = approvalRequired
        ? `Forge đã dừng trước một hành động nằm ngoài quyền tự động đã cấp: ${reason.slice(0, 500)} Bạn có thể điều chỉnh yêu cầu hoặc thực hiện bước đó thủ công rồi nhấn Thử lại.`
        : failureCopy(stage, reason);
      this.store.createMessage({ projectId: current.projectId, missionId, role: 'assistant', content, status: 'error', metadata: { kind: approvalRequired ? 'approval-required' : 'failure', code: error?.code ?? null, stage, taskId: failedTaskId } });
      this.#event('run.autopilot.failed', { error: reason.slice(0, 500), code: error?.code ?? null, stage, taskId: failedTaskId }, { projectId: current.projectId, missionId, taskId: failedTaskId });
      await this.#archiveConversation(missionId);
      return { missionId, status: 'failed', error };
    }).finally(() => {
      const current = this.active.get(missionId);
      if (current?.controller === controller) this.active.delete(missionId);
    });
    this.active.set(missionId, { controller, promise });
    return promise;
  }

  snapshot(missionId) {
    const mission = this.store.getMission(required(missionId, 'missionId'));
    if (!mission) throw new Error(`Unknown mission: ${missionId}`);
    return Object.freeze({
      mission,
      project: this.store.getProject(mission.projectId),
      messages: Object.freeze(this.store.listMessages({ missionId: mission.id })),
      autonomyGrant: this.store.getAutonomyGrant(mission.projectId),
      activities: this.activityProjection.snapshot({ missionId: mission.id }),
      failure: mission.status === 'failed' ? (() => {
        const taskId = mission.metadata?.failedTaskId ?? this.store.listTasks({ missionId: mission.id }).find((task) => task.status === 'failed')?.id ?? null;
        const task = taskId ? this.store.getTask(taskId) : null;
        return Object.freeze({
          stage: String(mission.metadata?.failureStage ?? 'execution'),
          code: mission.metadata?.failureCode ?? null,
          reason: String(mission.metadata?.failureReason ?? task?.metadata?.verificationFailure?.summary ?? 'Forge gặp lỗi chưa xác định.'),
          taskId,
          taskTitle: task?.title ?? null,
          verification: task?.metadata?.verificationFailure ?? null,
          recoverable: true,
        });
      })() : null,
      running: this.active.has(mission.id),
    });
  }

  #recoverFailedRun(missionId, { reason = 'operator-retry' } = {}) {
    const mission = this.store.getMission(missionId);
    if (!mission) throw new Error(`Unknown mission: ${missionId}`);
    let recoveredTasks = 0;
    for (const task of this.store.listTasks({ missionId })) {
      const verificationFailed = task.status === 'review' && task.metadata?.verificationFailure;
      if (['failed', 'cancelled'].includes(task.status) || verificationFailed) {
        this.store.updateTask(task.id, {
          status: 'ready',
          leaseOwner: null,
          leaseExpiresAt: null,
          metadata: { ...task.metadata, recoveredAt: new Date().toISOString(), recoveryReason: reason },
        });
        recoveredTasks += 1;
      }
    }
    this.store.updateMission(missionId, {
      status: 'running',
      metadata: {
        ...mission.metadata,
        failureReason: null,
        failureCode: null,
        failureStage: null,
        recoveredAt: new Date().toISOString(),
        recoveryReason: reason,
      },
    });
    this.#event('run.recovery.started', { reason, recoveredTasks }, { projectId: mission.projectId, missionId });
    return recoveredTasks;
  }

  sendMessage(missionId, content) {
    const mission = this.store.getMission(required(missionId, 'missionId'));
    if (!mission) throw new Error(`Unknown mission: ${missionId}`);
    if (mission.status === 'completed') throw new Error('Completed missions accept a new run, not an in-flight follow-up');
    const message = this.store.createMessage({ projectId: mission.projectId, missionId, role: 'user', content: required(content, 'message content'), metadata: { kind: 'follow-up' } });
    const followUps = Array.isArray(mission.metadata?.followUps) ? [...mission.metadata.followUps] : [];
    followUps.push({ id: message.id, content: message.content, createdAt: message.createdAt });
    this.store.updateMission(missionId, { metadata: { ...mission.metadata, followUps } });
    this.#event('run.follow-up.queued', { messageId: message.id }, { projectId: mission.projectId, missionId });
    if (mission.status === 'failed') {
      this.#recoverFailedRun(missionId, { reason: 'follow-up-after-failure' });
      void this.#launch(missionId);
    }
    return message;
  }

  pause(missionId) {
    const mission = this.missionRunner.pause(required(missionId, 'missionId'), 'Paused from Forge Studio');
    this.active.get(mission.id)?.controller.abort('paused');
    return this.snapshot(mission.id);
  }

  resume(missionId) {
    const mission = this.missionRunner.resume(required(missionId, 'missionId'));
    const active = this.active.get(mission.id);
    if (active) void active.promise.finally(() => this.#launch(mission.id)).catch(() => {});
    else queueMicrotask(() => this.#launch(mission.id));
    return this.snapshot(mission.id);
  }

  stop(missionId) {
    const mission = this.missionRunner.stop(required(missionId, 'missionId'), 'Stopped from Forge Studio');
    this.active.get(mission.id)?.controller.abort('stopped');
    return this.snapshot(mission.id);
  }

  retry(missionId) {
    const mission = this.store.getMission(required(missionId, 'missionId'));
    if (!mission) throw new Error(`Unknown mission: ${missionId}`);
    this.#recoverFailedRun(missionId, { reason: 'operator-retry' });
    this.store.updateMission(missionId, { metadata: { ...this.store.getMission(missionId).metadata, retriedAt: new Date().toISOString() } });
    const active = this.active.get(missionId);
    if (active) active.controller.abort('retry');
    if (active) void active.promise.finally(() => this.#launch(missionId)).catch(() => {});
    else void this.#launch(missionId);
    return this.snapshot(missionId);
  }

  async review(missionId) {
    if (!this.reviewSummary?.snapshot) throw new Error('Review summary is not configured');
    return this.reviewSummary.snapshot(required(missionId, 'missionId'));
  }

  async rollback(missionId) {
    if (!this.workspaceService?.rollbackMission || !this.reviewSummary?.snapshot) throw new Error('Rollback is not configured');
    const id = required(missionId, 'missionId');
    const mission = this.store.getMission(id);
    if (!mission) throw new Error(`Unknown mission: ${id}`);
    const active = this.active.get(id);
    if (active) {
      this.missionRunner.stop(id, 'Rollback requested from Forge Studio');
      active.controller.abort('rollback');
      await active.promise;
    }
    const review = await this.reviewSummary.snapshot(id);
    if (!review.canRollback) throw new Error('This mission has no managed candidate to roll back');
    const rollback = await this.workspaceService.rollbackMission(id);
    const latest = this.store.getMission(id);
    this.store.createMessage({ projectId: latest.projectId, missionId: id, role: 'assistant', content: 'Đã hoàn tác các thay đổi của nhiệm vụ trong worktree cô lập. Dự án chính vẫn được giữ nguyên.', metadata: { kind: 'rollback', removedWorktrees: rollback.removedWorktrees } });
    this.#event('run.rolled-back', { removedWorktrees: rollback.removedWorktrees }, { projectId: latest.projectId, missionId: id });
    return Object.freeze({ ...this.snapshot(id), review: await this.reviewSummary.snapshot(id), rollback });
  }

  whenSettled(missionId) {
    const id = required(missionId, 'missionId');
    const active = this.active.get(id);
    if (active) return active.promise;
    const mission = this.store.getMission(id);
    if (!mission) return Promise.reject(new Error(`Unknown mission: ${id}`));
    if (['planning', 'running'].includes(mission.status) && !this.closed) return this.#launch(id);
    return Promise.resolve(this.snapshot(id));
  }

  async close() {
    this.closed = true;
    const pending = [];
    for (const { controller, promise } of this.active.values()) { controller.abort('shutdown'); pending.push(promise); }
    await Promise.allSettled(pending);
    this.active.clear();
  }
}
