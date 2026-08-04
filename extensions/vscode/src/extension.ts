const vscode: any = require('vscode');
import { NolaneAgentClient, type RunControlAction } from './client.js';
import { migratedSetting, readMigratedWorkspaceState, registerLegacyCommandAliases } from './legacy-migration.js';
import { openLocalWorktree, validateLocalTaskHandoff } from './local-worktree.js';
import { projectCollaborationMissionState, projectSecurityCertificationState } from './mission-state.js';

const ACTIVE_RUN_KEY = 'nolaneAgent.activeRunId';

function clientFor(context: any): NolaneAgentClient {
  return new NolaneAgentClient({
    baseUrl: migratedSetting(vscode, 'baseUrl', 'http://127.0.0.1:8787'),
    organizationId: migratedSetting(vscode, 'organizationId', 'local'),
    workspaceId: migratedSetting(vscode, 'workspaceId', 'default'),
    projectId: migratedSetting(vscode, 'projectId', ''),
  }, context.secrets);
}

class RunNode extends vscode.TreeItem {
  constructor(readonly snapshot: any) {
    const mission = snapshot.mission;
    super(mission.objective || mission.id, vscode.TreeItemCollapsibleState.None);
    this.description = mission.status ?? 'unknown';
    this.tooltip = `${mission.id}\n${mission.status ?? 'unknown'}`;
    this.contextValue = 'nolaneAgentRun';
    this.iconPath = new vscode.ThemeIcon(mission.status === 'running' ? 'sync~spin' : mission.status === 'failed' ? 'error' : 'circle-outline');
    this.command = { command: 'nolane.selectRun', title: 'Select Nolane Agent run', arguments: [mission.id] };
  }
}

class TaskTreeProvider {
  private readonly changed = new vscode.EventEmitter();
  readonly onDidChangeTreeData = this.changed.event;

  constructor(private readonly getClient: () => NolaneAgentClient) {}
  refresh(): void { this.changed.fire(undefined); }
  getTreeItem(element: any): any { return element; }
  async getChildren(): Promise<any[]> {
    const runs = await this.getClient().listRuns();
    return runs.map((snapshot) => new RunNode(snapshot));
  }
  dispose(): void { this.changed.dispose(); }
}

async function showJson(title: string, value: unknown): Promise<void> {
  const document = await vscode.workspace.openTextDocument({ language: 'json', content: `${JSON.stringify(value, null, 2)}\n` });
  await vscode.window.showTextDocument(document, { preview: true });
  void vscode.window.setStatusBarMessage(`Nolane Agent: ${title}`, 3_000);
}

async function guarded(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    void vscode.window.showErrorMessage(String(error instanceof Error ? error.message : error));
  }
}

export function activate(context: any): void {
  const getClient = () => clientFor(context);
  const tree = new TaskTreeProvider(getClient);
  const view = vscode.window.createTreeView('nolane.tasks', { treeDataProvider: tree, showCollapseAll: false });
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
  let activeRun = readMigratedWorkspaceState(context, ACTIVE_RUN_KEY);

  const setActiveRun = async (runId: string): Promise<void> => {
    activeRun = runId;
    await context.workspaceState.update(ACTIVE_RUN_KEY, runId);
    status.text = runId ? `$(hubot) Nolane: ${runId.slice(0, 12)}` : '$(hubot) Nolane Agent';
    status.tooltip = runId ? `Active run: ${runId}` : 'No active Nolane Agent run';
    status.command = 'nolane.showLogs';
    status.show();
  };
  void setActiveRun(activeRun);

  const requireRun = (): string => {
    if (!activeRun) throw new Error('No active Nolane Agent run. Select or start a task first.');
    return activeRun;
  };

  context.subscriptions.push(tree, view, status);
  context.subscriptions.push(vscode.commands.registerCommand('nolane.selectRun', (runId: string) => guarded(async () => { await setActiveRun(runId); })));
  context.subscriptions.push(vscode.commands.registerCommand('nolane.refresh', () => tree.refresh()));
  context.subscriptions.push(vscode.commands.registerCommand('nolane.connect', () => guarded(async () => {
    const token = await vscode.window.showInputBox({ prompt: 'Nolane Agent token', password: true, ignoreFocusOut: true });
    if (!token) return;
    await getClient().setToken(token);
    tree.refresh();
    void vscode.window.showInformationMessage('Nolane Agent connection saved in SecretStorage.');
  })));
  context.subscriptions.push(vscode.commands.registerCommand('nolane.runTask', () => guarded(async () => {
    const objective = await vscode.window.showInputBox({ prompt: 'Task objective', ignoreFocusOut: true });
    if (!objective?.trim()) return;
    status.text = '$(loading~spin) Nolane: starting task';
    status.show();
    const result = await getClient().runTask(objective.trim());
    await setActiveRun(result.mission.id);
    tree.refresh();
  })));
  for (const action of ['pause', 'resume', 'stop', 'retry'] as RunControlAction[]) {
    context.subscriptions.push(vscode.commands.registerCommand(`nolane.${action}`, () => guarded(async () => {
      await getClient().control(requireRun(), action);
      tree.refresh();
    })));
  }
  const decision = (approved: boolean) => guarded(async () => {
    const reason = await vscode.window.showInputBox({ prompt: approved ? 'Approval note (optional)' : 'Why reject this action?', ignoreFocusOut: true });
    if (!approved && !reason?.trim()) return;
    await getClient().sendMessage(requireRun(), approved ? `APPROVAL: ${reason?.trim() || 'Proceed with the pending governed action.'}` : `REJECTION: ${reason?.trim()}`);
    if (approved) await getClient().control(requireRun(), 'resume').catch(() => undefined);
    tree.refresh();
  });
  context.subscriptions.push(vscode.commands.registerCommand('nolane.approve', () => decision(true)));
  context.subscriptions.push(vscode.commands.registerCommand('nolane.reject', () => decision(false)));
  context.subscriptions.push(vscode.commands.registerCommand('nolane.showDiff', () => guarded(async () => showJson('review', await getClient().getDiff(requireRun())))));
  context.subscriptions.push(vscode.commands.registerCommand('nolane.showLogs', () => guarded(async () => showJson('activities', await getClient().getLogs(requireRun())))));
  context.subscriptions.push(vscode.commands.registerCommand('nolane.showCollaboration', () => guarded(async () => showJson('collaboration', projectCollaborationMissionState(await getClient().getCollaborationExperience())))));
  context.subscriptions.push(vscode.commands.registerCommand('nolane.showSecurityCertification', () => guarded(async () => showJson('security-certification', projectSecurityCertificationState(await getClient().getSecurityCertification())))));
  context.subscriptions.push(vscode.commands.registerCommand('nolane.reviewApprove', () => guarded(async () => {
    const state = await getClient().getCollaborationExperience();
    const pending = state?.reviewQueue?.items?.find((item: any) => item.state === 'pending');
    if (!pending) throw new Error('No pending Nolane Agent review item.');
    await getClient().decideReviewItem({ itemId: pending.itemId, decision: 'approve', receiptSha256: pending.receiptSha256 });
    void vscode.window.showInformationMessage(`Nolane Agent approved ${pending.itemId}.`);
  })));
  const steer = (action: 'pause' | 'resume') => guarded(async () => {
    const reason = await vscode.window.showInputBox({ prompt: `Reason to ${action} the mission`, ignoreFocusOut: true });
    if (!reason?.trim()) return;
    await getClient().steerMission({ missionId: requireRun(), action, expectedRevision: 0, capabilities: [`mission.${action}`], reason: reason.trim(), evidenceReceiptSha256: '0'.repeat(64) });
    tree.refresh();
  });
  context.subscriptions.push(vscode.commands.registerCommand('nolane.steerPause', () => steer('pause')));
  context.subscriptions.push(vscode.commands.registerCommand('nolane.steerResume', () => steer('resume')));
  context.subscriptions.push(vscode.commands.registerCommand('nolane.transferTaskLocal', () => guarded(async () => {
    const handoff = validateLocalTaskHandoff(await getClient().prepareLocalHandoff(requireRun()));
    void vscode.window.showInformationMessage(`Nolane Agent prepared ${handoff.taskId} in a managed local worktree.`);
    tree.refresh();
  })));
  context.subscriptions.push(vscode.commands.registerCommand('nolane.openWorktree', () => guarded(async () => {
    const handoff = await getClient().prepareLocalHandoff(requireRun());
    await openLocalWorktree(vscode, handoff);
  })));
  registerLegacyCommandAliases(vscode, context, Object.freeze(['nolane.connect','nolane.runTask','nolane.pause','nolane.resume','nolane.stop','nolane.approve','nolane.reject','nolane.showDiff','nolane.showLogs','nolane.retry','nolane.refresh','nolane.selectRun','nolane.transferTaskLocal','nolane.openWorktree','nolane.showCollaboration','nolane.showSecurityCertification','nolane.reviewApprove','nolane.steerPause','nolane.steerResume']));
}

export function deactivate(): void {}
