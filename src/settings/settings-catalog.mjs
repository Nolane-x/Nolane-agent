const freeze = (value) => Object.freeze(Array.isArray(value) ? value.map(freeze) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, freeze(child)])) : value);

const field = (path, title, type, extra = {}) => ({ path, title, type, level: 'standard', scope: ['user', 'project', 'local'], ...extra });

const CATEGORIES = [
  { id: 'general', title: 'General', icon: 'settings', level: 'standard', description: 'Core workspace behavior.', fields: [
    field('experience.level', 'Experience level', 'select', { options: ['everyday', 'workspace', 'studio', 'expert'], aliases: ['standard', 'research'], scope: ['user'], restart: false }),
    field('general.language', 'Interface language', 'select', { options: ['system', 'en', 'vi'], scope: ['user'] }),
    field('general.defaultIntent', 'Default intent', 'select', { options: ['ask', 'plan', 'build', 'verify'] }),
    field('general.notifications', 'Notifications', 'boolean', { scope: ['user'] }),
    field('general.fileOpenDestination', 'Open files with', 'select', { options: ['integrated', 'system', 'vscode', 'cursor'] }),
  ] },
  { id: 'appearance', title: 'Appearance', icon: 'appearance', level: 'standard', description: 'Theme, density, and layout behavior.', fields: [
    field('appearance.theme', 'Theme', 'select', { options: ['system', 'nocturne', 'obsidian', 'graphite', 'aurora', 'snow', 'paper'], aliases: ['dark', 'light'] }),
    field('appearance.accent', 'Accent color', 'select', { options: ['violet', 'blue', 'cyan', 'rose', 'amber', 'emerald'] }),
    field('appearance.density', 'Interface density', 'select', { options: ['comfortable', 'compact'] }),
    field('appearance.motion', 'Motion', 'select', { options: ['system', 'full', 'reduced'] }),
    field('appearance.codeFontSize', 'Code font size', 'number', { min: 11, max: 24, step: 1 }),
    field('appearance.zoom', 'Interface zoom', 'number', { min: 75, max: 200, step: 5, suffix: '%' }),
  ] },
  { id: 'accessibility', title: 'Language & accessibility', icon: 'accessibility', level: 'standard', description: 'Reading, keyboard, and contrast preferences.', fields: [
    field('accessibility.highContrast', 'High contrast', 'boolean'),
    field('accessibility.alwaysShowFocus', 'Always show keyboard focus', 'boolean'),
    field('accessibility.screenReaderAnnouncements', 'Detailed screen-reader announcements', 'boolean'),
    field('accessibility.keyboardResizeStep', 'Panel keyboard resize step', 'number', { min: 4, max: 64, step: 4, suffix: 'px' }),
  ] },
  { id: 'notifications', title: 'Notifications', icon: 'bell', level: 'standard', description: 'Choose which events interrupt you and how they are delivered.', fields: [
    field('notifications.desktop', 'Desktop notifications', 'boolean', { scope: ['user', 'local'] }),
    field('notifications.taskCompletion', 'Mission completed', 'boolean', { scope: ['user'] }),
    field('notifications.approvals', 'Approval required', 'boolean', { scope: ['user'] }),
    field('notifications.errors', 'Errors and blocked work', 'boolean', { scope: ['user'] }),
    field('notifications.sound', 'Notification sound', 'select', { options: ['off', 'important', 'all'], scope: ['user', 'local'] }),
    field('notifications.quietHours', 'Quiet hours', 'boolean', { scope: ['user'] }),
  ] },
  { id: 'shortcuts', title: 'Keyboard shortcuts', icon: 'keyboard', level: 'standard', description: 'Keyboard behavior for navigation, commands, and editor actions.', fields: [
    field('shortcuts.keymap', 'Keymap', 'select', { options: ['default', 'vscode', 'cursor', 'vim', 'emacs'], scope: ['user'] }),
    field('shortcuts.commandPalette', 'Command palette shortcut', 'text', { scope: ['user'] }),
    field('shortcuts.globalQuickOpen', 'Global quick open', 'boolean', { scope: ['user', 'local'] }),
    field('shortcuts.chordTimeoutMs', 'Shortcut chord timeout', 'number', { min: 250, max: 5000, step: 50, suffix: 'ms', scope: ['user'] }),
  ] },
  { id: 'personalization', title: 'Personalization', icon: 'person', level: 'standard', description: 'Tune how Nolane explains, asks, and presents its work.', fields: [
    field('personalization.explanationDepth', 'Explanation depth', 'select', { options: ['concise', 'balanced', 'detailed', 'research'], scope: ['user'] }),
    field('personalization.responseStyle', 'Response style', 'select', { options: ['direct', 'collaborative', 'teacher', 'reviewer'], scope: ['user'] }),
    field('personalization.askBeforeAmbiguousChanges', 'Ask before ambiguous changes', 'boolean', { scope: ['user'] }),
    field('personalization.showReasoningSummary', 'Show reasoning summaries', 'boolean', { scope: ['user'] }),
    field('personalization.preferredDocumentationLanguage', 'Documentation language', 'select', { options: ['system', 'en', 'vi'], scope: ['user'] }),
  ] },
  { id: 'permissions', title: 'Permissions & autonomy', icon: 'shield', level: 'standard', description: 'Control file, command, network, and approval behavior.', fields: [
    field('security.sandbox', 'Use sandbox', 'boolean', { locked: true }),
    field('security.redactSensitiveData', 'Redact sensitive data', 'boolean', { locked: true }),
    field('permissions.defaultMode', 'Default permission mode', 'select', { options: ['ask', 'workspace', 'full'] }),
    field('autopilot.profile', 'Autonomy profile', 'select', { options: ['supervised', 'workspace-autopilot', 'research-autopilot'] }),
    field('autopilot.autoApplyPlanPatches', 'Automatically apply approved plan patches', 'boolean'),
  ] },
  { id: 'terminal', title: 'Terminal & files', icon: 'terminal', level: 'standard', description: 'Shell, output, and file opening preferences.', fields: [
    field('terminal.shell', 'Integrated shell', 'select', { options: ['auto', 'powershell', 'pwsh', 'cmd', 'bash', 'zsh', 'fish'] }),
    field('terminal.scrollbackLines', 'Terminal scrollback', 'number', { min: 1000, max: 100000, step: 1000 }),
    field('terminal.confirmPasteMultipleLines', 'Confirm multi-line paste', 'boolean'),
    field('files.followActiveFile', 'Follow active file', 'boolean'),
    field('files.autoRevealGenerated', 'Reveal generated files', 'boolean'),
  ] },
  { id: 'git', title: 'Git & worktrees', icon: 'git', level: 'standard', description: 'Repository safety and worktree defaults.', fields: [
    field('git.defaultBranchAction', 'Default branch action', 'select', { options: ['ask', 'branch', 'worktree'] }),
    field('git.autoFetch', 'Automatically fetch', 'boolean'),
    field('git.requireCleanBeforeMission', 'Require clean tree before mission', 'boolean'),
    field('worktrees.location', 'Worktree location', 'select', { options: ['project', 'data-directory', 'custom'] }),
    field('worktrees.cleanupPolicy', 'Completed worktree cleanup', 'select', { options: ['ask', 'keep', 'remove-after-merge'] }),
  ] },
  { id: 'browser', title: 'Browser & computer use', icon: 'browser', level: 'standard', description: 'Browser sessions and interaction safety.', fields: [
    field('browser.headed', 'Show browser window', 'boolean'),
    field('browser.persistent', 'Keep browser profile', 'boolean'),
    field('browser.snapshotDepth', 'Snapshot depth', 'number', { min: 1, max: 10, step: 1 }),
    field('browser.downloadPolicy', 'Download policy', 'select', { options: ['ask', 'workspace-only', 'allow'] }),
    field('computerUse.requireConfirmation', 'Confirm computer actions', 'boolean'),
  ] },
  { id: 'voice', title: 'Voice & media', icon: 'voice', level: 'standard', description: 'Speech, transcription, and media defaults.', fields: [
    field('voice.enabled', 'Enable voice', 'boolean'),
    field('voice.inputDevice', 'Input device', 'text'),
    field('voice.outputDevice', 'Output device', 'text'),
    field('voice.bargeIn', 'Allow interruption while speaking', 'boolean'),
    field('media.saveGeneratedAssets', 'Save generated media to project', 'boolean'),
  ] },
  { id: 'memory', title: 'Memory & context', icon: 'memory', level: 'standard', description: 'Context packing and retained knowledge.', fields: [
    field('memory.enabled', 'Enable cross-session memory', 'boolean'),
    field('memory.retentionDays', 'Retention period', 'number', { min: 0, max: 3650, step: 1, suffix: 'days' }),
    field('context.strategy', 'Context strategy', 'select', { options: ['auto', 'focused', 'broad', 'research'] }),
    field('context.maxUtilizationPercent', 'Maximum context utilization', 'number', { min: 25, max: 95, step: 5, suffix: '%' }),
  ] },
  { id: 'models', title: 'Models & routing', icon: 'model', level: 'standard', description: 'Default model, discovery, fallback, and budgets.', fields: [
    field('agent.model', 'Default model', 'model'),
    field('models.autoDiscover', 'Discover available models', 'boolean'),
    field('models.preferLocal', 'Prefer local models when suitable', 'boolean'),
    field('models.maxCostPerMissionUsd', 'Mission cost limit', 'number', { min: 0, max: 10000, step: 0.1, suffix: 'USD' }),
    field('models.fallbackPolicy', 'Fallback policy', 'select', { options: ['off', 'same-provider', 'balanced', 'resilient'] }),
    field('models.showRoutingReasons', 'Show routing reasons', 'boolean', { level: 'research' }),
  ] },
  { id: 'integrations', title: 'MCP, plugins & hooks', icon: 'plug', level: 'standard', description: 'Extension and external tool behavior.', fields: [
    field('integrations.mcpAutoStart', 'Start enabled MCP servers', 'boolean'),
    field('integrations.pluginUpdates', 'Plugin update policy', 'select', { options: ['ask', 'notify', 'automatic'] }),
    field('integrations.hooksEnabled', 'Enable hooks', 'boolean'),
    field('integrations.showSourceHealth', 'Show source health in summary', 'boolean'),
  ] },
  { id: 'data', title: 'Data, storage & privacy', icon: 'database', level: 'standard', description: 'Local storage, retention, export, and telemetry.', fields: [
    field('data.telemetry', 'Anonymous diagnostics', 'boolean', { scope: ['user'] }),
    field('data.historyRetentionDays', 'Mission history retention', 'number', { min: 0, max: 3650, step: 1, suffix: 'days' }),
    field('data.maxCacheGb', 'Maximum cache size', 'number', { min: 0.25, max: 1024, step: 0.25, suffix: 'GB' }),
    field('data.autoBackup', 'Automatic local backup', 'boolean'),
  ] },
  { id: 'updates', title: 'Updates', icon: 'update', level: 'standard', description: 'Application and component updates.', fields: [
    field('updates.channel', 'Update channel', 'select', { options: ['stable', 'beta', 'nightly'] }),
    field('updates.autoDownload', 'Automatically download updates', 'boolean'),
    field('updates.includeModelCatalog', 'Refresh model catalog with updates', 'boolean'),
  ] },
  { id: 'diagnostics', title: 'Diagnostics', icon: 'diagnostics', level: 'standard', description: 'Logs, health checks, and troubleshooting.', fields: [
    field('diagnostics.logLevel', 'Log level', 'select', { options: ['error', 'warn', 'info', 'debug', 'trace'] }),
    field('diagnostics.keepReceiptsDays', 'Receipt retention', 'number', { min: 1, max: 3650, step: 1, suffix: 'days' }),
    field('diagnostics.includeSystemInfo', 'Include system information in reports', 'boolean'),
  ] },
  { id: 'research', title: 'Research controls', icon: 'flask', level: 'research', description: 'Expert routing, evidence, and experimental controls.', fields: [
    field('research.showRawReceipts', 'Show raw receipts', 'boolean', { level: 'research' }),
    field('research.showProviderScores', 'Show provider score decomposition', 'boolean', { level: 'research' }),
    field('research.enableExperimentalSystems', 'Enable experimental systems', 'boolean', { level: 'research' }),
    field('research.maxParallelAgents', 'Maximum parallel agents', 'number', { min: 1, max: 64, step: 1, level: 'research' }),
    field('research.evidenceStrictness', 'Evidence strictness', 'select', { options: ['standard', 'strict', 'forensic'], level: 'research' }),
  ] },
];

const EXPERIENCE_LEVELS = [
  { id: 'standard', title: 'Standard', description: 'Compatibility surface for the historical user experience.' },
  { id: 'research', title: 'Research', description: 'Compatibility surface for historical advanced controls.' },
];

const PROGRESSIVE_EXPERIENCE_LEVELS = [
  { id: 'everyday', title: 'Everyday', description: 'Chat, projects, and simple AI tools.' },
  { id: 'workspace', title: 'Workspace', description: 'Missions, approvals, and live progress.' },
  { id: 'studio', title: 'Studio', description: 'Files, terminal, diffs, and agent activity.' },
  { id: 'expert', title: 'Expert', description: 'All routing, evidence, resource, and experimental controls.' },
];

function flatten(value, prefix = '', output = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) { output.push([prefix, value]); return output; }
  for (const [key, child] of Object.entries(value)) flatten(child, prefix ? `${prefix}.${key}` : key, output);
  return output;
}

export function createSettingsCatalog() {
  return freeze({ schema: 'nolane.settings.catalog.v1', experienceLevels: EXPERIENCE_LEVELS, progressiveExperienceLevels: PROGRESSIVE_EXPERIENCE_LEVELS, categories: CATEGORIES });
}

export function filterSettingsCatalog(catalog, { experience = 'standard', query = '' } = {}) {
  const needle = String(query).trim().toLowerCase();
  const categories = catalog.categories
    .filter((category) => ['research','expert'].includes(experience) || category.level !== 'research')
    .map((category) => ({ ...category, fields: category.fields.filter((item) => (['research','expert'].includes(experience) || item.level !== 'research') && (!needle || `${category.title} ${category.description} ${item.title} ${item.path}`.toLowerCase().includes(needle))) }))
    .filter((category) => !needle || category.fields.length > 0 || `${category.title} ${category.description}`.toLowerCase().includes(needle));
  return freeze({ ...catalog, categories });
}

export function validateSettingsPatch(patch, catalog = createSettingsCatalog()) {
  const definitions = new Map(catalog.categories.flatMap((category) => category.fields.map((item) => [item.path, item])));
  const errors = [];
  for (const [path, value] of flatten(patch)) {
    const definition = definitions.get(path);
    if (!definition) { errors.push({ path, code: 'unknown-setting', message: `Unknown setting: ${path}` }); continue; }
    if (value === null) continue;
    if (definition.type === 'boolean' && typeof value !== 'boolean') errors.push({ path, code: 'invalid-type', message: 'Expected a boolean' });
    if (definition.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value) || value < definition.min || value > definition.max)) errors.push({ path, code: 'invalid-number', message: `Expected a number from ${definition.min} to ${definition.max}` });
    if (definition.type === 'select' && !definition.options.includes(value) && !(definition.aliases ?? []).includes(value)) errors.push({ path, code: 'invalid-option', message: `Expected one of: ${definition.options.join(', ')}` });
    if ((definition.type === 'text' || definition.type === 'model') && typeof value !== 'string') errors.push({ path, code: 'invalid-type', message: 'Expected text' });
  }
  return freeze(errors);
}
