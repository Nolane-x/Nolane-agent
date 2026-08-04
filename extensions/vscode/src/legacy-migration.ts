const LEGACY_CONFIGURATION_NAMESPACE = 'forgeStudio';
const LEGACY_SECRET_TOKEN_KEY = 'forgeStudio.token';
const LEGACY_ACTIVE_RUN_KEY = 'forgeStudio.activeRunId';
const LEGACY_COMMAND_PREFIX = 'forge.';
const LEGACY_COLLABORATION_SCHEMA = 'forge.collaboration-experience-plane.v1';
const LEGACY_SECURITY_SCHEMA = 'forge.security-certification-plane-snapshot.v1';
const LEGACY_HANDOFF_SCHEMA = 'forge.local-task-handoff.v1';

export const legacySchemas = Object.freeze({
  collaboration: LEGACY_COLLABORATION_SCHEMA,
  security: LEGACY_SECURITY_SCHEMA,
  handoff: LEGACY_HANDOFF_SCHEMA,
});

export async function readMigratedSecret(secrets: { get(key: string): Promise<string | undefined>; store(key: string, value: string): Promise<void>; delete(key: string): Promise<void> }, canonicalKey: string): Promise<string | undefined> {
  const canonical = await secrets.get(canonicalKey);
  if (canonical) return canonical;
  const legacy = await secrets.get(LEGACY_SECRET_TOKEN_KEY);
  if (!legacy) return undefined;
  await secrets.store(canonicalKey, legacy);
  await secrets.delete(LEGACY_SECRET_TOKEN_KEY);
  return legacy;
}

export function migratedSetting(vscode: any, key: string, fallback: string): string {
  const canonical = vscode.workspace.getConfiguration('nolaneAgent');
  const inspected = canonical.inspect?.(key);
  if (inspected?.workspaceFolderValue !== undefined || inspected?.workspaceValue !== undefined || inspected?.globalValue !== undefined) return canonical.get(key, fallback);
  return vscode.workspace.getConfiguration(LEGACY_CONFIGURATION_NAMESPACE).get(key, canonical.get(key, fallback));
}

export function readMigratedWorkspaceState(context: any, canonicalKey: string): string {
  const canonical = context.workspaceState.get(canonicalKey, '');
  if (canonical) return canonical;
  const legacy = context.workspaceState.get(LEGACY_ACTIVE_RUN_KEY, '');
  if (legacy) void context.workspaceState.update(canonicalKey, legacy);
  return legacy;
}

export function registerLegacyCommandAliases(vscode: any, context: any, canonicalCommands: readonly string[]): void {
  for (const canonical of canonicalCommands) {
    if (!canonical.startsWith('nolane.')) continue;
    const legacy = `${LEGACY_COMMAND_PREFIX}${canonical.slice('nolane.'.length)}`;
    context.subscriptions.push(vscode.commands.registerCommand(legacy, (...args: unknown[]) => vscode.commands.executeCommand(canonical, ...args)));
  }
}
