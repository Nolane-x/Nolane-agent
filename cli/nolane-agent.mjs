#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

import { NolaneAgentClient } from '../src/client/nolane-agent-client.mjs';
import { createNolaneEnvironment } from '../src/config/nolane-environment.mjs';
import { runInteractiveCli } from './interactive.mjs';

const nolaneEnvironment = createNolaneEnvironment(process.env);

function fail(message, code = 1) {
  const safe = String(message)
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]{8,}/gi, 'Bearer [REDACTED]')
    .replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, '[REDACTED]')
    .replace(/\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/g, '[REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTED]');
  process.stderr.write(`${safe}\n`);
  process.exitCode = code;
}

function option(args, name, fallback = undefined) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  if (index === args.length - 1 || args[index + 1].startsWith('--')) throw new Error(`${name} requires a value`);
  const value = args[index + 1];
  args.splice(index, 2);
  return value;
}

function flag(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return false;
  args.splice(index, 1);
  return true;
}

function print(value, jsonMode) {
  if (jsonMode || typeof value !== 'string') process.stdout.write(`${JSON.stringify(value, null, jsonMode ? 0 : 2)}\n`);
  else process.stdout.write(`${value}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--token')) throw new Error('Plaintext --token is forbidden; use NOLANE_AGENT_TOKEN or --token-file');
  const jsonMode = flag(args, '--json');
  const tokenFile = option(args, '--token-file', null);
  const baseUrl = option(args, '--url', nolaneEnvironment.get('URL') ?? 'http://127.0.0.1:3737');
  const organizationId = option(args, '--organization', nolaneEnvironment.get('ORGANIZATION_ID') ?? '');
  const workspaceId = option(args, '--workspace', nolaneEnvironment.get('WORKSPACE_ID') ?? '');
  const token = tokenFile ? (await readFile(tokenFile, 'utf8')).trim() : String(nolaneEnvironment.get('TOKEN') ?? '').trim();
  const client = new NolaneAgentClient({ baseUrl, token, organizationId, workspaceId });
  if (args.length === 0 || args[0] === 'interactive') {
    if (args[0] === 'interactive') args.shift();
    if (args.length) throw new Error(`Unknown option: ${args[0]}`);
    await runInteractiveCli({ client });
    return;
  }
  const [group, action, id] = args;
  let result;
  if (group === 'health' && !action) result = await client.health();
  else if (group === 'projects' && action === 'list') result = await client.listProjects();
  else if (group === 'runs' && action === 'create') {
    const projectId = option(args, '--project', nolaneEnvironment.get('PROJECT_ID') ?? '');
    const objective = option(args, '--objective', '');
    const autonomyProfile = option(args, '--autonomy', 'guided');
    if (!projectId || !objective) throw new Error('runs create requires --project/NOLANE_AGENT_PROJECT_ID and --objective');
    result = await client.createRun({ projectId, objective, autonomyProfile });
  } else if (group === 'runs' && action === 'list') {
    const projectId = option(args, '--project', nolaneEnvironment.get('PROJECT_ID') ?? '');
    const limit = Number(option(args, '--limit', '30'));
    if (!projectId) throw new Error('runs list requires --project or NOLANE_AGENT_PROJECT_ID');
    result = await client.listRuns(projectId, { limit });
  } else if (group === 'runs' && action === 'get' && id) result = await client.getRun(id);
  else if (group === 'runs' && ['pause', 'resume', 'stop', 'retry'].includes(action) && id) result = await client.controlRun(id, action);
  else if (group === 'runs' && action === 'review' && id) result = await client.reviewRun(id);
  else if (group === 'runs' && action === 'logs' && id) result = await client.listActivities(id);
  else if (group === 'runs' && action === 'message' && id) {
    const content = option(args, '--content', '');
    if (!content) throw new Error('runs message requires --content');
    result = await client.sendMessage(id, content);
  } else throw new Error('Usage: nolane-agent [interactive] | nolane-agent [--json] health | projects list | runs create/list/get/pause/resume/stop/retry/review/logs/message');
  if (args.some((value) => value.startsWith('--'))) throw new Error(`Unknown option: ${args.find((value) => value.startsWith('--'))}`);
  print(result, jsonMode);
}

main().catch((error) => fail(error?.message ?? error));
