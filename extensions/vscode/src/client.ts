import { readMigratedSecret } from './legacy-migration.js';

export interface NolaneAgentClientConfig {
  baseUrl: string;
  organizationId: string;
  workspaceId: string;
  projectId: string;
}

export interface SecretStorageLike {
  get(key: string): Promise<string | undefined>;
  store(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export type RunControlAction = 'pause' | 'resume' | 'stop' | 'retry';
const TOKEN_KEY = 'nolaneAgent.token';

function normalizedBaseUrl(value: string): URL {
  const url = new URL(value);
  const local = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    throw new Error('Nolane Agent requires HTTPS except for a loopback endpoint.');
  }
  url.pathname = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  return url;
}

export class NolaneAgentClient {
  constructor(
    private readonly config: NolaneAgentClientConfig,
    private readonly secrets: SecretStorageLike,
  ) {}

  async setToken(token: string): Promise<void> {
    const value = token.trim();
    if (!value) throw new Error('Nolane Agent token cannot be empty.');
    await this.secrets.store(TOKEN_KEY, value);
  }

  async clearToken(): Promise<void> {
    await this.secrets.delete(TOKEN_KEY);
  }

  private async request<T>(route: string, init: RequestInit = {}): Promise<T> {
    const token = await readMigratedSecret(this.secrets, TOKEN_KEY);
    if (!token) throw new Error('Nolane Agent token is not configured. Run “Nolane Agent: Connect”.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(new URL(route.replace(/^\//, ''), normalizedBaseUrl(this.config.baseUrl)), {
        ...init,
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
          'x-nolane-organization': this.config.organizationId,
          'x-nolane-workspace': this.config.workspaceId,
          ...(init.headers ?? {}),
        },
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Nolane Agent request failed (${response.status}): ${detail.slice(0, 500)}`);
      }
      return (response.status === 204 ? null : await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  runTask(objective: string): Promise<any> {
    if (!this.config.projectId) throw new Error('Set nolaneAgent.projectId before running a task.');
    return this.request('/api/agent/runs', { method: 'POST', body: JSON.stringify({ projectId: this.config.projectId, objective, autonomyProfile: 'guided' }) });
  }
  listRuns(limit = 30): Promise<any[]> { if (!this.config.projectId) return Promise.resolve([]); const bounded = Math.max(1, Math.min(100, limit)); return this.request(`/api/agent/runs?projectId=${encodeURIComponent(this.config.projectId)}&limit=${bounded}`); }
  getRun(runId: string): Promise<any> { return this.request(`/api/agent/runs/${encodeURIComponent(runId)}`); }
  control(runId: string, action: RunControlAction): Promise<any> { return this.request(`/api/agent/runs/${encodeURIComponent(runId)}/${action}`, { method: 'POST', body: '{}' }); }
  sendMessage(runId: string, content: string): Promise<any> { return this.request(`/api/agent/runs/${encodeURIComponent(runId)}/messages`, { method: 'POST', body: JSON.stringify({ content }) }); }
  getDiff(runId: string): Promise<any> { return this.request(`/api/agent/runs/${encodeURIComponent(runId)}/review`); }
  getLogs(runId: string): Promise<any> { return this.request(`/api/agent/runs/${encodeURIComponent(runId)}/activities`); }
  getCollaborationExperience(): Promise<any> { return this.request('/api/collaboration-experience/snapshot'); }
  getSecurityCertification(): Promise<any> { return this.request('/api/security-certification/snapshot'); }
  decideReviewItem(input: { itemId: string; decision: 'approve' | 'reject' | 'request-changes'; receiptSha256: string }): Promise<any> { return this.request('/api/collaboration-experience/review/decisions', { method: 'POST', body: JSON.stringify(input) }); }
  steerMission(input: { missionId: string; action: 'pause' | 'resume' | 'redirect' | 'reprioritize' | 'revoke'; expectedRevision: number; capabilities: string[]; reason: string; target?: string | null; evidenceReceiptSha256: string }): Promise<any> { return this.request('/api/collaboration-experience/steering', { method: 'POST', body: JSON.stringify(input) }); }
  prepareLocalHandoff(missionId: string, taskId?: string): Promise<any> { const mission = String(missionId ?? '').trim(); if (!mission) throw new Error('missionId is required to transfer a task locally.'); const task = String(taskId ?? '').trim(); return this.request('/api/local-task-handoffs', { method: 'POST', body: JSON.stringify({ missionId: mission, ...(task ? { taskId: task } : {}) }) }); }
  getLocalHandoff(taskId: string): Promise<any> { const task = String(taskId ?? '').trim(); if (!task) throw new Error('taskId is required to read a local handoff.'); return this.request(`/api/local-task-handoffs/${encodeURIComponent(task)}`); }
}
