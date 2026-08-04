export interface NolaneAgentClientOptions {
  baseUrl: string;
  token?: string;
  organizationId?: string;
  workspaceId?: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

export declare class NolaneAgentRequestError extends Error {
  status: number | null;
  code: string | null;
  responseSha256: string | null;
}

export declare class NolaneAgentClient {
  constructor(options: NolaneAgentClientOptions);
  request(route: string, options?: Record<string, unknown>): Promise<any>;
  health(): Promise<any>;
  listProjects(): Promise<any[]>;
  createRun(input: Record<string, unknown>): Promise<any>;
  listRuns(projectId: string, options?: { limit?: number }): Promise<any[]>;
  getRun(runId: string): Promise<any>;
  controlRun(runId: string, action: 'pause' | 'resume' | 'stop' | 'retry'): Promise<any>;
  sendMessage(runId: string, content: string): Promise<any>;
  reviewRun(runId: string): Promise<any>;
  listActivities(runId: string): Promise<any>;
  paginate(route: string, options?: Record<string, unknown>): Promise<any[]>;
}
