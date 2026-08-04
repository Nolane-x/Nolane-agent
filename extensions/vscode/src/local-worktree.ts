import { legacySchemas } from './legacy-migration.js';

export interface LocalTaskHandoff {
  schema: 'nolane.agent.local-task-handoff.v1';
  projectId?: string;
  missionId: string;
  taskId: string;
  localWorkspace: string;
  receiptSha256: string;
}

function requiredString(value: unknown, label: string): string {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.includes('\0')) throw new Error(`${label} cannot contain NUL bytes.`);
  return text;
}

function isAbsoluteLocalPath(value: string): boolean {
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || /^\\\\[^\\]/.test(value);
}

export function validateLocalTaskHandoff(value: unknown): LocalTaskHandoff {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Local task handoff must be an object.');
  const input = value as Record<string, unknown>;
  if (input.schema !== 'nolane.agent.local-task-handoff.v1' && input.schema !== legacySchemas.handoff) throw new Error('Unsupported local task handoff schema.');
  const missionId = requiredString(input.missionId, 'missionId');
  const taskId = requiredString(input.taskId, 'taskId');
  const localWorkspace = requiredString(input.localWorkspace, 'localWorkspace');
  if (!isAbsoluteLocalPath(localWorkspace)) throw new Error('localWorkspace must be an absolute local path.');
  const receiptSha256 = requiredString(input.receiptSha256, 'receiptSha256');
  if (!/^[a-f0-9]{64}$/i.test(receiptSha256)) throw new Error('receiptSha256 must be a SHA-256 digest.');
  return Object.freeze({
    schema: 'nolane.agent.local-task-handoff.v1',
    projectId: input.projectId == null ? undefined : requiredString(input.projectId, 'projectId'),
    missionId,
    taskId,
    localWorkspace,
    receiptSha256: receiptSha256.toLowerCase(),
  });
}

export async function openLocalWorktree(vscode: any, value: unknown): Promise<LocalTaskHandoff> {
  const handoff = validateLocalTaskHandoff(value);
  const uri = vscode.Uri.file(handoff.localWorkspace);
  await vscode.commands.executeCommand('vscode.openFolder', uri, true);
  return handoff;
}
