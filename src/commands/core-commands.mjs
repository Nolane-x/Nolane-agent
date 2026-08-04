function numberFlag(flags, key) {
  if (flags[key] == null) return undefined;
  const value = Number(Array.isArray(flags[key]) ? flags[key].at(-1) : flags[key]);
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`--${key} must be a non-negative number`);
  return value;
}

function required(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  return text;
}

function unavailable(feature, reason = 'not configured') { return { feature, available: false, reason }; }

export function registerCoreCommands(registry, services = {}) {
  const { goalService, goalRunService, store, replanner, runCoordinator, providerRegistry, pluginService, browserService, browserPermissionService, settingsService, diagnostics, memoryService } = services;

  registry.register({
    name: 'goal', aliases: ['g'], description: 'Create and manage durable goals', usage: '/goal new|list|show|run|pause|resume|complete',
    async execute({ args, flags }) {
      if (!goalService) return unavailable('goals');
      const action = String(args[0] ?? 'list').toLowerCase();
      if (action === 'new' || action === 'create') {
        const title = required(args[1] ?? flags.title, 'goal title');
        const projectId = required(flags.project, '--project');
        const objective = required(flags.objective ?? args.slice(2).join(' ') ?? title, '--objective');
        const budget = {};
        const maxTotalTokens = numberFlag(flags, 'max-tokens'); if (maxTotalTokens !== undefined) budget.maxTotalTokens = maxTotalTokens;
        const maxCostUsd = numberFlag(flags, 'max-cost'); if (maxCostUsd !== undefined) budget.maxCostUsd = maxCostUsd;
        return { goal: goalService.create({ projectId, title, objective, budget }) };
      }
      if (action === 'list') return { goals: goalService.list({ projectId: flags.project ?? null, status: flags.status ?? null }) };
      const goalId = required(args[1], 'goal id');
      if (action === 'show' || action === 'status') return { goal: goalService.get(goalId), facts: goalService.listFacts?.(goalId) ?? [], revisions: goalService.listPlanRevisions?.(goalId) ?? [] };
      if (action === 'run' || action === 'start') {
        if (!goalRunService?.start) return unavailable('goal runtime');
        return goalRunService.start(goalId, { providerId: flags.model ?? 'auto', autonomyProfile: flags.autonomy ?? 'workspace-autopilot', autoApplyPlanPatches: flags['auto-replan'] !== 'false' });
      }
      const nextStatus = action === 'pause' ? 'paused' : action === 'resume' ? 'active' : action === 'complete' ? 'completed' : action === 'cancel' ? 'cancelled' : null;
      if (!nextStatus) throw new Error(`Unsupported /goal action: ${action}`);
      return { goal: goalService.update(goalId, { status: nextStatus }) };
    },
  });

  registry.register({ name: 'status', description: 'Show goal, mission, and task status', usage: '/status <goal-id>', async execute({ args }) {
    if (!goalService) return unavailable('goals');
    const goal = goalService.get(required(args[0], 'goal id'));
    if (!goal) throw new Error(`Unknown goal: ${args[0]}`);
    return { goal, missions: store?.listMissions?.({ projectId: goal.projectId }) ?? [], tasks: goal.activeMissionId ? store?.listTasks?.({ missionId: goal.activeMissionId }) ?? [] : [] };
  } });

  registry.register({ name: 'budget', description: 'Inspect or change a goal budget', usage: '/budget <goal-id> --max-tokens N --max-cost N', async execute({ args, flags }) {
    if (!goalService) return unavailable('goals');
    const goalId = required(args[0], 'goal id'); const goal = goalService.get(goalId); if (!goal) throw new Error(`Unknown goal: ${goalId}`);
    const budget = { ...(goal.budget ?? {}) };
    const tokens = numberFlag(flags, 'max-tokens'); if (tokens !== undefined) budget.maxTotalTokens = tokens;
    const cost = numberFlag(flags, 'max-cost'); if (cost !== undefined) budget.maxCostUsd = cost;
    const elapsed = numberFlag(flags, 'max-elapsed-ms'); if (elapsed !== undefined) budget.maxElapsedMs = elapsed;
    return { goal: goalService.update(goalId, { budget }) };
  } });

  registry.register({ name: 'plan', description: 'Inspect or replan a goal', usage: '/plan show|replan <goal-id>', async execute({ args, flags }) {
    if (!goalService) return unavailable('goals');
    const action = String(args[0] ?? 'show'); const goalId = required(args[1] ?? args[0], 'goal id');
    if (action === 'show' || args.length === 1) return { goal: goalService.get(goalId), revisions: goalService.listPlanRevisions?.(goalId) ?? [], patches: store?.listGoalPlanPatches?.(goalId) ?? [] };
    if (action === 'replan') {
      if (!replanner) return unavailable('replanner');
      const patch = flags.patch ? JSON.parse(String(flags.patch)) : { addTasks: [], updateTasks: [], cancelTaskIds: [] };
      return { patch: replanner.propose({ goalId, reason: required(flags.reason ?? 'Operator requested replanning.', '--reason'), patch, idempotencyKey: flags.key ?? null }) };
    }
    throw new Error(`Unsupported /plan action: ${action}`);
  } });

  registry.register({ name: 'resume', description: 'Resume a paused or failed mission', usage: '/resume <mission-id>', async execute({ args }) { return runCoordinator?.resume ? { run: await runCoordinator.resume(required(args[0], 'mission id')) } : unavailable('run coordinator'); } });
  registry.register({ name: 'rewind', description: 'Rollback a managed candidate worktree', usage: '/rewind <run-id>', async execute({ args }) { return runCoordinator?.rollback ? { result: await runCoordinator.rollback(required(args[0], 'run id')) } : unavailable('rollback'); } });
  registry.register({ name: 'compact', description: 'Compact bounded conversation or memory context', usage: '/compact [goal-id]', async execute({ args }) { return memoryService?.compact ? { result: await memoryService.compact(args[0] ?? null) } : unavailable('context compaction', 'automatic bounded compaction is active'); } });
  registry.register({ name: 'agents', description: 'List active agents and providers', async execute() { return { providers: providerRegistry?.publicView?.() ?? [], agents: diagnostics?.agents?.() ?? [] }; } });
  registry.register({ name: 'plugins', description: 'List, install, and activate compatible plugins', usage: '/plugins list|marketplace|install|activate|deactivate', async execute({ args, flags }) {
    if (!pluginService) return unavailable('plugins');
    const action = String(args[0] ?? 'list').toLowerCase();
    if (action === 'list') return { plugins: pluginService.publicView?.() ?? pluginService.list?.() ?? [], marketplaces: pluginService.listMarketplaces?.() ?? [] };
    if (action === 'marketplace' || action === 'add-marketplace') return { marketplace: await pluginService.addMarketplace({ source: required(args[1] ?? flags.source, 'marketplace source') }) };
    if (action === 'install') return { plugin: await pluginService.install({ marketplaceId: required(flags.marketplace, '--marketplace'), pluginName: required(args[1], 'plugin name') }) };
    if (action === 'activate') return { plugin: await pluginService.activate(required(args[1], 'plugin id'), { projectId: required(flags.project, '--project'), requestedCapabilities: flags.capability ? (Array.isArray(flags.capability) ? flags.capability : [flags.capability]) : null, allowHooks: false }) };
    if (action === 'deactivate') return { plugin: await pluginService.deactivate(required(args[1], 'plugin id'), { projectId: required(flags.project, '--project') }) };
    throw new Error(`Unsupported /plugins action: ${action}`);
  } });
  registry.register({ name: 'browser', description: 'Control the governed browser agent', usage: '/browser open|goto|snapshot|find|click|fill|tabs|screenshot|close', async execute({ args, flags }) {
    if (!browserService) return unavailable('browser');
    const action = String(args[0] ?? 'status').toLowerCase();
    const projectId = required(flags.project, '--project');
    if (action === 'status') return { browser: await browserService.status({ projectId }) };
    if (action === 'open') return { browser: await browserService.open({ projectId, url: args[1] ?? 'about:blank', headed: flags.headed !== 'false', persistent: flags.persistent !== 'false', mobile: flags.mobile === 'true' }) };
    if (action === 'goto') return { browser: await browserService.goto({ projectId, url: required(args[1], 'URL') }) };
    if (action === 'snapshot') return { browser: await browserService.snapshot({ projectId, depth: numberFlag(flags, 'depth'), target: flags.target ?? null }) };
    if (action === 'find') return { browser: await browserService.find({ projectId, query: required(args.slice(1).join(' '), 'query'), regex: flags.regex === 'true' }) };
    if (action === 'click') return { browser: await browserService.click({ projectId, target: required(args[1], 'target'), button: flags.button ?? null }) };
    if (action === 'fill') return { browser: await browserService.fill({ projectId, target: required(args[1], 'target'), text: required(args.slice(2).join(' '), 'text'), submit: flags.submit === 'true' }) };
    if (action === 'press') return { browser: await browserService.press({ projectId, key: required(args[1], 'key') }) };
    if (action === 'tabs') return { browser: await browserService.tabs({ projectId }) };
    if (action === 'screenshot') return { browser: await browserService.screenshot({ projectId, target: flags.target ?? null, filename: flags.filename ?? 'page.png' }) };
    if (action === 'close') return { browser: await browserService.close({ projectId }) };
    throw new Error(`Unsupported /browser action: ${action}`);
  } });
  registry.register({ name: 'settings', aliases: ['config'], description: 'Inspect or update layered settings', usage: '/settings show|set --project ID --layer project --patch JSON', async execute({ args, flags }) {
    if (!settingsService) return unavailable('settings');
    const action = String(args[0] ?? 'show').toLowerCase();
    const projectId = flags.project ?? null;
    if (action === 'show') return { settings: await settingsService.effective(projectId) };
    if (action === 'set') {
      const patch = JSON.parse(required(flags.patch, '--patch'));
      return { settings: await settingsService.update({ layer: flags.layer ?? 'project', projectId, patch }) };
    }
    throw new Error(`Unsupported /settings action: ${action}`);
  } });
  registry.register({ name: 'help', aliases: ['commands'], description: 'List available Forge commands', usage: '/help [command]', async execute({ args }) { return { commands: args[0] ? registry.help(args[0]) : registry.list() }; } });
  registry.register({ name: 'model', description: 'Inspect model routing', async execute() { return { providers: providerRegistry?.publicView?.() ?? [] }; } });
  registry.register({
    name: 'permissions', description: 'Inspect or change explicit browser write permissions', usage: '/permissions show|grant|revoke --goal ID --browser click,fill,press',
    async execute({ args, flags }) {
      const action = String(args[0] ?? 'show').toLowerCase();
      if (browserPermissionService) {
        const goalId = required(flags.goal, '--goal');
        if (action === 'show') return { permissions: browserPermissionService.inspect({ goalId }) };
        const actions = String(Array.isArray(flags.browser) ? flags.browser.join(',') : flags.browser ?? '').split(',').map((item) => item.trim()).filter(Boolean);
        if (!actions.length) throw new TypeError('--browser must list one or more write actions');
        if (action === 'grant') return { permissions: browserPermissionService.grant({ goalId, actions }) };
        if (action === 'revoke') return { permissions: browserPermissionService.revoke({ goalId, actions }) };
        throw new Error(`Unsupported /permissions action: ${action}`);
      }
      return { projectId: flags.project ?? null, permissions: diagnostics?.permissions?.(flags.project ?? null) ?? null };
    },
  });
  registry.register({ name: 'doctor', description: 'Run platform diagnostics', async execute() { return diagnostics?.run ? diagnostics.run() : { ok: true, checks: [], note: 'No optional diagnostics service configured.' }; } });
}
