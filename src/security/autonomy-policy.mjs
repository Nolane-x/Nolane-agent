const freeze = (value) => Object.freeze(value);

export const AUTONOMY_PROFILES = freeze({
  guided: freeze({
    id: 'guided',
    label: 'Hỏi trước khi thay đổi',
    description: 'Forge đọc và phân tích tự động nhưng hỏi trước khi sửa file hoặc chạy lệnh.',
  }),
  'workspace-autopilot': freeze({
    id: 'workspace-autopilot',
    label: 'Tự động trong workspace',
    description: 'Forge tự thực hiện các thay đổi có thể hoàn tác trong worktree và tự chạy quy trình phát triển.',
  }),
  'sandbox-autopilot': freeze({
    id: 'sandbox-autopilot',
    label: 'Tự động trong sandbox',
    description: 'Forge có quyền rộng hơn bên trong sandbox cô lập, vẫn chặn hành động bên ngoài hoặc không thể hoàn tác.',
  }),
});

const HARD_STOP_KINDS = new Set([
  'credential.export',
  'purchase',
  'message.send',
  'database.destroy',
  'account.create',
  'account.delete',
  'release.publish',
]);

const READ_ONLY_KINDS = new Set([
  'fs.read',
  'repository.search',
  'repository.index',
  'git.status',
  'git.diff',
  'memory.read',
  'web.fetch',
  'process.listManaged',
]);

const WORKSPACE_ALLOWED_KINDS = new Set([
  'fs.write',
  'fs.patch',
  'fs.patchSet',
  'fs.delete',
  'process.run',
  'process.startManaged',
  'process.stopManaged',
  'git.operation',
  'memory.write',
]);

const WORKSPACE_COMMANDS = new Set([
  'test',
  'build',
  'lint',
  'format',
  'typecheck',
  'dev-server',
  'dependency-install',
  'codegen',
  'git',
]);

function decision(decisionValue, reason, { hardStop = false, category = 'general' } = {}) {
  return freeze({ decision: decisionValue, reason, hardStop, category });
}

function profileOf(context) {
  const profile = String(context?.profile ?? 'guided');
  if (!Object.hasOwn(AUTONOMY_PROFILES, profile)) throw new TypeError(`Unknown autonomy profile: ${profile}`);
  return profile;
}

function isHardStop(action, context) {
  const kind = String(action?.kind ?? '');
  if (HARD_STOP_KINDS.has(kind)) return true;
  if (kind === 'deploy' && String(action.environment ?? '').toLowerCase() === 'production') return true;
  if (kind === 'database.destroy' || kind === 'credential.export') return true;
  if (kind === 'fs.delete' && (!context.withinWorkspace || action.reversible !== true)) return true;
  if (kind.startsWith('fs.') && context.withinWorkspace === false) return true;
  if ((kind === 'process.run' || kind === 'process.startManaged' || kind === 'process.stopManaged') && context.withinWorkspace === false && context.inSandbox !== true) return true;
  return false;
}

export class AutonomyPolicy {
  evaluate(action = {}, context = {}) {
    const profile = profileOf(context);
    const kind = String(action.kind ?? '').trim();
    if (!kind) throw new TypeError('action kind is required');
    const mode = context.modePolicy && typeof context.modePolicy === 'object' ? context.modePolicy : null;
    const readAction = READ_ONLY_KINDS.has(kind) || (kind === 'process.run' && action.readOnly === true);
    if (mode) {
      if (mode.readOnly === true && !readAction) return decision('deny', `Agent mode ${context.modeId ?? mode.id ?? 'selected'} is read-only.`, { hardStop: true, category: 'mode-read-only' });
      if (action.toolGroup && Array.isArray(mode.toolGroups) && !mode.toolGroups.includes(action.toolGroup)) return decision('deny', `Tool group ${action.toolGroup} is outside the selected agent mode.`, { hardStop: true, category: 'mode-tool-group' });
      if (kind === 'process.run' && mode.networkPolicy?.mode === 'deny' && action.network !== 'deny' && action.commandClass === 'dependency-install') return decision('deny', 'Network access is denied by the selected agent mode.', { hardStop: true, category: 'mode-network' });
      if (kind === 'process.run' && action.commandClass === 'git' && action.gitOperation === 'commit') {
        if (mode.commitPolicy === 'deny') return decision('deny', 'Git commit is denied by the selected agent mode.', { hardStop: true, category: 'mode-commit' });
        if (mode.commitPolicy === 'ask') return decision('ask', 'Git commit requires approval in the selected agent mode.', { category: 'mode-commit' });
      }
      if (!readAction && mode.approvalPolicy === 'always') return decision('ask', 'The selected agent mode requires approval for state changes.', { category: 'mode-approval' });
      if (!readAction && mode.approvalPolicy === 'state-change') return decision('ask', 'The selected agent mode requires approval for this state change.', { category: 'mode-approval' });
    }

    if (isHardStop(action, context)) {
      return decision('ask', 'Hành động có tác động bên ngoài hoặc không thể hoàn tác cần xác nhận trực tiếp.', { hardStop: true, category: 'external-or-destructive' });
    }

    if (READ_ONLY_KINDS.has(kind)) {
      return decision('allow', 'Đọc và phân tích trong phạm vi đã cấp được phép tự động.', { category: 'read' });
    }

    if (kind === 'process.run' && action.readOnly === true && action.commandClass === 'git-read') {
      return decision('allow', 'Lệnh Git chỉ đọc được phép tự động trong workspace.', { category: 'read-command' });
    }

    if (profile === 'guided') {
      return decision('ask', 'Chế độ có hướng dẫn yêu cầu xác nhận trước thao tác thay đổi trạng thái.', { category: 'state-change' });
    }

    if (profile === 'sandbox-autopilot') {
      if (context.inSandbox === true) return decision('allow', 'Hành động nằm trong sandbox cô lập đã được cấp quyền.', { category: 'sandbox' });
      return decision('ask', 'Sandbox Autopilot chỉ tự động khi tiến trình được cô lập trong sandbox.', { category: 'sandbox-boundary' });
    }

    if (!context.withinWorkspace || !context.inManagedWorktree) {
      return decision('ask', 'Workspace Autopilot chỉ tự động trong worktree được Forge quản lý.', { category: 'workspace-boundary' });
    }

    if (!WORKSPACE_ALLOWED_KINDS.has(kind)) {
      return decision('ask', 'Loại hành động này chưa được cấp quyền tự động cho workspace.', { category: 'unknown-action' });
    }

    if (kind === 'process.run' || kind === 'process.startManaged') {
      const commandClass = String(action.commandClass ?? 'arbitrary');
      if (!WORKSPACE_COMMANDS.has(commandClass)) return decision('ask', 'Lệnh không thuộc nhóm phát triển đã được cấp trước.', { category: 'command' });
      if (commandClass === 'dependency-install' && !['deny', 'allowlisted'].includes(String(action.network ?? 'deny'))) {
        return decision('ask', 'Cài dependency chỉ được tự động với mạng bị chặn hoặc allowlist.', { category: 'network' });
      }
    }

    if ((kind === 'fs.write' || kind === 'fs.patch' || kind === 'fs.patchSet' || kind === 'fs.delete' || kind === 'git.operation') && action.reversible !== true) {
      return decision('ask', 'Workspace Autopilot chỉ tự động với thay đổi có thể hoàn tác.', { category: 'reversibility' });
    }

    return decision('allow', 'Hành động nằm trong worktree, thuộc phạm vi cấp trước và có thể hoàn tác.', { category: 'workspace' });
  }
}
