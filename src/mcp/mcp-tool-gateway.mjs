import { randomUUID } from 'node:crypto';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { redactSecrets } from '../security/redaction.mjs';

const stamp = () => new Date().toISOString();

function allowed(task, name) {
  const entries = Array.isArray(task?.metadata?.mcpAllowedTools) ? task.metadata.mcpAllowedTools.map(String) : [];
  return entries.some((entry) => entry === name || (entry.endsWith('*') && name.startsWith(entry.slice(0, -1))));
}

export class McpToolGateway {
  constructor({ registry } = {}) {
    if (!registry?.listTools || !registry?.callTool) throw new TypeError('McpToolGateway registry is required');
    this.registry = registry;
  }

  async schemasForTask(task) {
    const tools = await this.registry.listTools();
    return Object.freeze(tools
      .filter((tool) => allowed(task, tool.name))
      .map((tool) => Object.freeze({
        type: 'function',
        function: Object.freeze({
          name: tool.name,
          description: `[MCP ${tool.serverId ?? 'server'}] ${String(tool.description ?? '')}`.slice(0, 2_000),
          parameters: Object.freeze(tool.inputSchema ?? { type: 'object' }),
        }),
      })));
  }

  async execute(task, name, args = {}, context = {}) {
    const tool = String(name);
    if (!allowed(task, tool)) throw new Error(`MCP tool is not allowlisted for task ${task?.id ?? 'unknown'}: ${tool}`);
    const startedAt = stamp(); const started = Date.now();
    const output = await this.registry.callTool(tool, structuredClone(args), { signal: context.signal });
    const safeOutput = redactSecrets(output, { secretValues: context.secretValues ?? [] });
    const finishedAt = stamp();
    const base = {
      schema: 'forge.mcp.receipt.v1',
      id: `receipt_${randomUUID().replaceAll('-', '').slice(0, 24)}`,
      tool,
      status: output?.isError === true ? 'fail' : 'pass',
      startedAt,
      finishedAt,
      durationMs: Date.now() - started,
      requestSha256: canonicalSha256(redactSecrets({ tool, arguments: args }, { secretValues: context.secretValues ?? [] })),
      outputSha256: canonicalSha256(safeOutput),
      refs: redactSecrets({ ...(context.refs ?? {}), taskId: task?.id ?? context.refs?.taskId }, { secretValues: context.secretValues ?? [] }),
    };
    const receipt = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
    return Object.freeze({ status: base.status, output: Object.freeze(safeOutput), receipt });
  }
}
