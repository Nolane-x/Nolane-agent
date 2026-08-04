import test from 'node:test';
import assert from 'node:assert/strict';

import { CommandRegistry } from '../src/commands/command-registry.mjs';
import { registerCoreCommands } from '../src/commands/core-commands.mjs';

test('CommandRegistry parses quoted arguments, flags, aliases, and suggests unknown commands', async () => {
  const registry = new CommandRegistry();
  registry.register({ name: 'goal', aliases: ['g'], description: 'Manage goals', execute: async ({ args, flags }) => ({ args, flags }) });
  const parsed = registry.parse('/g new "Reduce token use" --project=p1 --auto false --tag fast --tag safe');
  assert.equal(parsed.name, 'goal');
  assert.deepEqual(parsed.args, ['new', 'Reduce token use']);
  assert.deepEqual(parsed.flags, { project: 'p1', auto: 'false', tag: ['fast', 'safe'] });
  const result = await registry.execute('/g status --project p1');
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.args, ['status']);
  assert.equal(result.value.flags.project, 'p1');
  await assert.rejects(() => registry.execute('/goa'), /Did you mean \/goal/i);
});

test('core commands create and inspect goals and update budget through typed services', async () => {
  const calls = [];
  const goals = new Map();
  const goalService = {
    create(input) { calls.push(['create', input]); const goal = { id: 'goal_1', projectId: input.projectId, title: input.title, objective: input.objective, status: 'active', budget: input.budget ?? {}, revision: 1 }; goals.set(goal.id, goal); return goal; },
    get(id) { return goals.get(id) ?? null; },
    list({ projectId } = {}) { return [...goals.values()].filter((goal) => !projectId || goal.projectId === projectId); },
    update(id, changes) { calls.push(['update', id, changes]); const next = { ...goals.get(id), ...changes, revision: goals.get(id).revision + 1 }; goals.set(id, next); return next; },
    listFacts() { return []; }, listPlanRevisions() { return []; },
  };
  const registry = new CommandRegistry();
  registerCoreCommands(registry, { goalService, store: { listTasks: () => [], listMissions: () => [] } });

  const created = await registry.execute('/goal new "Token reducer" --project project_1 --objective "Reduce prompt tokens" --max-tokens 500000');
  assert.equal(created.value.goal.id, 'goal_1');
  assert.equal(created.value.goal.budget.maxTotalTokens, 500000);
  const budget = await registry.execute('/budget goal_1 --max-tokens 250000 --max-cost 12.5');
  assert.equal(budget.value.goal.budget.maxCostUsd, 12.5);
  const status = await registry.execute('/status goal_1');
  assert.equal(status.value.goal.title, 'Token reducer');
  assert.deepEqual(status.value.tasks, []);
  assert.deepEqual(calls.map((call) => call[0]), ['create', 'update']);
});

test('core registry exposes the complete documented command surface', () => {
  const registry = new CommandRegistry();
  registerCoreCommands(registry, { goalService: { list: () => [] }, store: { listTasks: () => [], listMissions: () => [] } });
  assert.deepEqual(registry.list().map((item) => item.name), ['agents', 'browser', 'budget', 'compact', 'doctor', 'goal', 'help', 'model', 'permissions', 'plan', 'plugins', 'resume', 'rewind', 'settings', 'status']);
});

test('extended Goal OS commands start goals, control browser, install plugins, and manage layered settings', async () => {
  const calls = [];
  const goal = { id: 'goal_1', projectId: 'p1', title: 'Ship', objective: 'Ship it', status: 'active', budget: {}, revision: 1 };
  const registry = new CommandRegistry();
  registerCoreCommands(registry, {
    goalService: { get: () => goal, list: () => [goal], update: (id, patch) => ({ ...goal, ...patch }), listFacts: () => [], listPlanRevisions: () => [] },
    goalRunService: { start(id, input) { calls.push(['goal-run', id, input]); return { goal, run: { mission: { id: 'm1' } } }; } },
    store: { listTasks: () => [], listMissions: () => [], listGoalPlanPatches: () => [] },
    browserService: {
      async goto(input) { calls.push(['goto', input]); return input; }, async click(input) { calls.push(['click', input]); return input; }, async fill(input) { calls.push(['fill', input]); return input; }, async tabs(input) { calls.push(['tabs', input]); return input; }, async screenshot(input) { calls.push(['screenshot', input]); return input; },
    },
    pluginService: {
      publicView: () => [], listMarketplaces: () => [], async addMarketplace(input) { calls.push(['market', input]); return { id: 'market_1' }; }, async install(input) { calls.push(['install', input]); return { id: 'plugin_1' }; },
    },
    settingsService: { async effective(id) { calls.push(['settings', id]); return { value: { agent: { model: 'auto' } } }; }, async update(input) { calls.push(['settings-update', input]); return input; } },
  });
  assert.equal((await registry.execute('/goal run goal_1')).value.run.mission.id, 'm1');
  assert.equal((await registry.execute('/browser goto https://example.com --project p1')).value.browser.url, 'https://example.com');
  assert.equal((await registry.execute('/browser click e42 --project p1')).value.browser.target, 'e42');
  assert.equal((await registry.execute('/plugins marketplace /tmp/market')).value.marketplace.id, 'market_1');
  assert.equal((await registry.execute('/plugins install feature-dev --marketplace market_1')).value.plugin.id, 'plugin_1');
  assert.equal((await registry.execute('/settings show --project p1')).value.settings.value.agent.model, 'auto');
  await registry.execute('/settings set --project p1 --layer project --patch "{\\"agent\\":{\\"model\\":\\"codex\\"}}"');
  assert.equal(calls.some((item) => item[0] === 'settings-update'), true);
});

test('/permissions grants and revokes explicit browser write actions for a durable goal', async () => {
  const calls = [];
  const permissions = {
    inspect(input) { calls.push(['inspect', input]); return { allowedActions: ['open', 'snapshot'] }; },
    grant(input) { calls.push(['grant', input]); return { allowedActions: ['open', 'snapshot', ...input.actions] }; },
    revoke(input) { calls.push(['revoke', input]); return { allowedActions: ['open', 'snapshot'] }; },
  };
  const registry = new CommandRegistry();
  registerCoreCommands(registry, { goalService: { list: () => [] }, store: { listTasks: () => [], listMissions: () => [] }, browserPermissionService: permissions });
  assert.deepEqual((await registry.execute('/permissions show --goal goal_1')).value.permissions.allowedActions, ['open', 'snapshot']);
  assert.deepEqual((await registry.execute('/permissions grant --goal goal_1 --browser click,fill,press')).value.permissions.allowedActions, ['open', 'snapshot', 'click', 'fill', 'press']);
  await registry.execute('/permissions revoke --goal goal_1 --browser click');
  assert.deepEqual(calls.map((item) => item[0]), ['inspect', 'grant', 'revoke']);
});
